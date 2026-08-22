import { prisma } from "@/lib/prisma"
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail } from "@/lib/email"
import type { CheckResult } from "@/lib/health-checks"

// Persists each check's state and alerts Catherine ONLY on a transition:
// a service going DOWN (was ok → now failing) or RECOVERING (was down → now ok).
// This is what stops silent outages without daily-report alert fatigue.

const REALERT_AFTER_MS = 6 * 60 * 60 * 1000 // if still down, remind at most every 6h

export interface HealthTransition {
  name: string
  kind: "down" | "recovered"
  detail?: string
}

export async function persistAndAlert(checks: CheckResult[]): Promise<{ transitions: HealthTransition[]; alerted: boolean }> {
  const now = new Date()
  const downTransitions: HealthTransition[] = []
  const recoveries: HealthTransition[] = []
  const staleDown: HealthTransition[] = [] // still down, due for a reminder

  for (const c of checks) {
    let prev: any = null
    try {
      prev = await prisma.integrationHealth.findUnique({ where: { name: c.name } })
    } catch { /* table may not exist yet on first deploy — treat as new */ }

    const prevOk = prev ? prev.ok : true // unknown → treat as previously healthy, so a currently-down check alerts once
    const nowOk = c.ok

    const justWentDown = prevOk && !nowOk
    const justRecovered = !!prev && !prev.ok && nowOk
    const stillDown = !!prev && !prev.ok && !nowOk

    if (c.critical) {
      if (justWentDown) downTransitions.push({ name: c.name, kind: "down", detail: c.detail })
      else if (justRecovered) recoveries.push({ name: c.name, kind: "recovered", detail: c.detail })
      else if (stillDown) {
        const last = prev.lastAlertedAt ? new Date(prev.lastAlertedAt).getTime() : 0
        if (now.getTime() - last > REALERT_AFTER_MS) staleDown.push({ name: c.name, kind: "down", detail: c.detail })
      }
    }

    const willAlert = c.critical && (justWentDown || justRecovered || (stillDown && staleDown.some(s => s.name === c.name)))
    const data = {
      ok: nowOk,
      detail: c.detail || null,
      lastCheckedAt: now,
      ...(nowOk ? { lastOkAt: now } : {}),
      ...(justWentDown ? { lastDownAt: now } : {}),
      consecutiveFailures: nowOk ? 0 : (prev?.consecutiveFailures || 0) + 1,
      ...(willAlert ? { lastAlertedAt: now } : {}),
    }

    try {
      await prisma.integrationHealth.upsert({
        where: { name: c.name },
        update: data,
        create: { name: c.name, ...data, lastDownAt: nowOk ? null : now },
      })
    } catch { /* table missing on very first run before migration — skip persistence */ }
  }

  const toAlertDown = [...downTransitions, ...staleDown]
  if (toAlertDown.length === 0 && recoveries.length === 0) {
    return { transitions: [], alerted: false }
  }

  // Build one combined alert (avoid multiple texts).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const cfg = await prisma.aIConfig.findFirst({ select: { realtorEmail: true, realtorPhone: true, realtorName: true } }).catch(() => null)
  const phone = cfg?.realtorPhone || process.env.AGENT_PHONE
  const email = cfg?.realtorEmail || process.env.AGENT_EMAIL

  const downLine = toAlertDown.length ? `⚠️ CAÍDO: ${toAlertDown.map(d => d.name).join(", ")}` : ""
  const upLine = recoveries.length ? `✅ RESTABLECIDO: ${recoveries.map(d => d.name).join(", ")}` : ""

  // SMS — short
  if (phone) {
    const sms = [`CASAi — estado de sistemas:`, downLine, upLine, `Detalle: ${appUrl}/health`].filter(Boolean).join("\n")
    sendSMS(toE164(phone), sms).catch(e => console.error("[health-monitor] SMS failed:", e?.message || e))
  }

  // Email — with detail
  if (email) {
    const rows = [...toAlertDown, ...recoveries].map(t => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${t.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
          <span style="padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${t.kind === "down" ? "#fee2e2" : "#d1fae5"};color:${t.kind === "down" ? "#991b1b" : "#065f46"}">${t.kind === "down" ? "CAÍDO" : "OK"}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#6b7280">${t.detail || ""}</td>
      </tr>`).join("")
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0a1628;padding:22px 26px;border-radius:12px 12px 0 0">
        <p style="color:#c9a84c;font-size:11px;letter-spacing:2px;margin:0 0 4px">CASAi · ALERTA DE SISTEMAS</p>
        <h2 style="color:#fff;margin:0;font-size:19px">${toAlertDown.length ? "⚠️ Un servicio necesita atención" : "✅ Servicio restablecido"}</h2>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-top:0">${rows}</table>
      <div style="background:#f9fafb;padding:14px 20px;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:0">
        <a href="${appUrl}/health" style="color:#2563eb;font-size:13px">Ver estado completo en CASAi →</a>
      </div>
    </div>`
    sendEmail({
      to: email,
      subject: toAlertDown.length ? `⚠️ CASAi: ${toAlertDown.map(d => d.name).join(", ")} caído` : `✅ CASAi: servicio restablecido`,
      html,
    }).catch(e => console.error("[health-monitor] email failed:", e?.message || e))
  }

  return { transitions: [...toAlertDown, ...recoveries], alerted: !!(phone || email) }
}
