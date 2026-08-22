export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { runAllChecks, type CheckResult } from "@/lib/health-checks"
import { persistAndAlert } from "@/lib/health-monitor"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

function buildReportEmail(checks: CheckResult[], runAt: string, appUrl: string): string {
  const failed = checks.filter(c => !c.ok)
  const allOk = failed.length === 0
  const statusColor = allOk ? "#059669" : "#dc2626"
  const statusLabel = allOk ? "All Systems Operational ✅" : `${failed.length} Issue${failed.length > 1 ? "s" : ""} Detected ⚠️`

  const rows = checks.map(c => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${c.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:center">
        <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;
          background:${c.ok ? "#d1fae5" : "#fee2e2"};color:${c.ok ? "#065f46" : "#991b1b"}">
          ${c.ok ? "OK" : "FAIL"}
        </span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${c.detail || ""}</td>
      ${c.ms !== undefined ? `<td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#9ca3af;text-align:right">${c.ms}ms</td>` : "<td></td>"}
    </tr>`).join("")

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#f3f4f6">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%">
  <tr><td style="background:#0a1628;border-radius:14px 14px 0 0;padding:28px 32px">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px">LOFTY CRM · DAILY SYSTEM REPORT</p>
    <h1 style="color:white;font-size:22px;font-weight:900;margin:0 0 4px">${statusLabel}</h1>
    <p style="color:#8fa3c4;font-size:13px;margin:0">${runAt}</p>
  </td></tr>
  <tr><td style="background:white;padding:0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="background:#f9fafb">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">System</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Status</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Detail</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Response</th>
      </tr>
      ${rows}
    </table>
  </td></tr>
  ${failed.length > 0 ? `
  <tr><td style="background:#fef2f2;border:1px solid #fecaca;padding:16px 24px">
    <p style="color:#991b1b;font-size:13px;font-weight:700;margin:0 0 6px">⚠️ Issues require attention:</p>
    <ul style="margin:0;padding-left:18px;color:#b91c1c;font-size:13px">
      ${failed.map(f => `<li>${f.name}: ${f.detail || "failed"}</li>`).join("")}
    </ul>
  </td></tr>` : ""}
  <tr><td style="background:#f9fafb;border-radius:0 0 14px 14px;padding:16px 24px;text-align:center">
    <a href="${appUrl}" style="color:#6b7280;font-size:12px;text-decoration:none">${appUrl}</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  })

  const checks = await runAllChecks()

  // ALWAYS persist state + fire instant SMS/email alerts on any transition
  // (a service breaking or recovering). This is what catches outages fast.
  const monitor = await persistAndAlert(checks).catch(e => {
    console.error("[system-check] persistAndAlert failed:", e?.message || e)
    return { transitions: [], alerted: false }
  })

  const allOk = checks.every(c => c.ok)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  // The full status-report email is opt-in (?report=1, e.g. the daily run) so the
  // frequent 20-min checks don't email a report every time — they only alert on
  // transitions above. Default keeps the old behavior for existing callers.
  const sendReport = new URL(req.url).searchParams.get("report") !== "0"

  const aiConfig = await prisma.aIConfig.findFirst({
    select: { realtorEmail: true, realtorName: true },
  }).catch(() => null)

  const toEmail = aiConfig?.realtorEmail
    || process.env.REALTOR_EMAIL
    || process.env.AGENT_EMAIL

  if (sendReport && toEmail) {
    try {
      await sendEmail({
        to: toEmail,
        subject: allOk
          ? `✅ Daily System Check — All OK (${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" })})`
          : `⚠️ Daily System Check — Issues Detected (${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" })})`,
        html: buildReportEmail(checks, runAt, appUrl),
      })
    } catch (e: any) {
      console.error("[system-check] Failed to send report email:", e.message)
    }
  }

  return NextResponse.json({
    ok: allOk,
    runAt,
    checks,
    transitions: monitor.transitions,
    alerted: monitor.alerted,
    reportEmailSent: sendReport && !!toEmail,
  })
}
