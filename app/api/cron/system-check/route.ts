export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchIdxListings } from "@/lib/bridge"
import { sendEmail } from "@/lib/email"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
  ms?: number
}

async function checkDatabase(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const count = await prisma.contact.count()
    return { name: "Database (Prisma/PostgreSQL)", ok: true, detail: `${count} contacts`, ms: Date.now() - t }
  } catch (e: any) {
    return { name: "Database (Prisma/PostgreSQL)", ok: false, detail: e.message, ms: Date.now() - t }
  }
}

async function checkBridgeMLS(): Promise<CheckResult> {
  const t = Date.now()
  try {
    if (!process.env.BRIDGE_SERVER_TOKEN) {
      return { name: "Bridge MLS API", ok: false, detail: "BRIDGE_SERVER_TOKEN not set", ms: 0 }
    }
    const listings = await searchIdxListings({ city: "Miami", limit: 3 })
    return { name: "Bridge MLS API", ok: listings.length > 0, detail: `${listings.length} listings returned`, ms: Date.now() - t }
  } catch (e: any) {
    return { name: "Bridge MLS API", ok: false, detail: e.message, ms: Date.now() - t }
  }
}

async function checkEmail(): Promise<CheckResult> {
  const hasResend = !!process.env.RESEND_API_KEY
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  const ok = hasResend || hasSMTP
  return {
    name: "Email (Resend/SMTP)",
    ok,
    detail: ok
      ? (hasResend ? "Resend configured" : "SMTP configured")
      : "Neither RESEND_API_KEY nor SMTP_USER/SMTP_PASS are set",
  }
}

async function checkSMS(): Promise<CheckResult> {
  const ok = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
  return {
    name: "SMS (Twilio)",
    ok,
    detail: ok ? "Twilio credentials configured" : "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing",
  }
}

async function checkAI(): Promise<CheckResult> {
  const ok = !!process.env.ANTHROPIC_API_KEY
  return {
    name: "AI (Anthropic)",
    ok,
    detail: ok ? "ANTHROPIC_API_KEY set" : "ANTHROPIC_API_KEY not set — Sofia AI will not work",
  }
}

async function checkLeadFlow(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const recent = await prisma.contact.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })
    const total = await prisma.contact.count()
    return { name: "Lead Flow (last 24h)", ok: true, detail: `${recent} new leads · ${total} total contacts`, ms: Date.now() - t }
  } catch (e: any) {
    return { name: "Lead Flow (last 24h)", ok: false, detail: e.message, ms: Date.now() - t }
  }
}

async function checkEmailVolume(): Promise<CheckResult> {
  const t = Date.now()
  try {
    // Midnight ET → UTC
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)
    const count = await prisma.email.count({
      where: { direction: "OUTBOUND", status: "SENT", createdAt: { gte: todayStart } },
    })
    const LIMIT = Number(process.env.EMAIL_DAILY_LIMIT || 100) // Resend free tier
    return {
      name: "Email volume (today)",
      ok: count < LIMIT * 0.9,
      detail: `${count} sent · provider limit ~${LIMIT}/day${count >= LIMIT * 0.9 ? " — NEAR/OVER LIMIT, emails may be blocked" : ""}`,
      ms: Date.now() - t,
    }
  } catch (e: any) {
    return { name: "Email volume (today)", ok: false, detail: e.message, ms: Date.now() - t }
  }
}

async function checkActivities(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const count = await prisma.activity.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })
    return { name: "CRM Activity (last 24h)", ok: true, detail: `${count} activities logged`, ms: Date.now() - t }
  } catch (e: any) {
    return { name: "CRM Activity (last 24h)", ok: false, detail: e.message, ms: Date.now() - t }
  }
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

  const checks = await Promise.all([
    checkDatabase(),
    checkBridgeMLS(),
    checkEmail(),
    checkSMS(),
    checkAI(),
    checkLeadFlow(),
    checkActivities(),
    checkEmailVolume(),
  ])

  const allOk = checks.every(c => c.ok)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  // Send report email to agent
  const aiConfig = await prisma.aIConfig.findFirst({
    select: { realtorEmail: true, realtorName: true },
  }).catch(() => null)

  const toEmail = aiConfig?.realtorEmail
    || process.env.REALTOR_EMAIL
    || process.env.AGENT_EMAIL

  if (toEmail) {
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
    emailSent: !!toEmail,
  })
}
