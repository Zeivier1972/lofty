export const dynamic = "force-dynamic"
export const maxDuration = 120

// Diagnose (and optionally run) the property auto-alert pipeline.
// GET  /api/admin/alert-diagnostics        → why alerts are/aren't sending
// GET  /api/admin/alert-diagnostics?run=1  → actually send alerts now (capped)
// Session-protected — just visit it while logged in as the agent.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { triggerMatchAlert } from "@/lib/trigger-match-alert"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const run = new URL(req.url).searchParams.get("run") === "1"

  // 1. Email provider config — the #1 reason "sends" don't actually deliver
  const emailConfig = {
    resendApiKey: !!process.env.RESEND_API_KEY,
    resendFrom: !!process.env.RESEND_FROM,
    smtp: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  }
  const canSendEmail = (emailConfig.resendApiKey && emailConfig.resendFrom) || emailConfig.smtp

  // 2. MLS connection
  const bridgeToken = !!process.env.BRIDGE_SERVER_TOKEN

  // 3. Eligible buyers (what the cron loops over)
  const [totalContacts, withPrefs, eligible, withEmailNoPrefs] = await Promise.all([
    prisma.contact.count({ where: { isArchived: false } }),
    prisma.contact.count({ where: { matchPrefsCompletedAt: { not: null } } }),
    prisma.contact.count({ where: { matchPrefsCompletedAt: { not: null }, email: { not: null }, doNotEmail: false } }),
    prisma.contact.count({ where: { matchPrefsCompletedAt: null, email: { not: null }, buyerLocation: { not: null } } }),
  ])

  // 4. Have alerts ever fired? Last PROPERTY_ALERT_SENT activity
  const lastAlert = await prisma.activity.findFirst({
    where: { type: "PROPERTY_ALERT_SENT" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  const alertsLast7d = await prisma.activity.count({
    where: { type: "PROPERTY_ALERT_SENT", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  })

  // 5. Real email delivery outcome (after the SENT/FAILED fix)
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [emailSent7d, emailFailed7d] = await Promise.all([
    prisma.email.count({ where: { direction: "OUTBOUND", status: "SENT", createdAt: { gte: since7 } } }),
    prisma.email.count({ where: { direction: "OUTBOUND", status: "FAILED", createdAt: { gte: since7 } } }),
  ])

  const diagnosis: string[] = []
  if (!canSendEmail) diagnosis.push("❌ No email provider is fully configured — set RESEND_API_KEY + RESEND_FROM (or SMTP_USER/SMTP_PASS) in Railway. Nothing can be delivered until this is fixed.")
  else diagnosis.push("✅ Email provider is configured.")
  if (!bridgeToken) diagnosis.push("❌ BRIDGE_SERVER_TOKEN not set — MLS search returns nothing, so no matches can be found.")
  else diagnosis.push("✅ MLS (Bridge) token is set.")
  if (eligible === 0) diagnosis.push(`❌ 0 buyers are eligible (need matchPrefsCompletedAt + email + not doNotEmail). ${withEmailNoPrefs} contacts have an email + location but no matchPrefsCompletedAt — re-import or edit them to set buyer criteria.`)
  else diagnosis.push(`✅ ${eligible} buyers are eligible for alerts.`)
  if (!lastAlert) diagnosis.push("⚠️ No property alert has EVER been recorded — the automation hadn't run successfully before now.")
  else diagnosis.push(`ℹ️ Last alert recorded: ${lastAlert.createdAt.toISOString()} · ${alertsLast7d} in the last 7 days.`)
  if (emailFailed7d > 0) diagnosis.push(`⚠️ ${emailFailed7d} email sends FAILED in the last 7 days (vs ${emailSent7d} delivered) — check the email provider config/limits.`)

  const report: any = {
    emailConfig,
    canSendEmail,
    bridgeToken,
    contacts: { total: totalContacts, withPrefs, eligibleForAlerts: eligible, hasEmailAndLocationButNoPrefs: withEmailNoPrefs },
    lastAlertAt: lastAlert?.createdAt || null,
    alertsLast7Days: alertsLast7d,
    emailDelivery7Days: { sent: emailSent7d, failed: emailFailed7d },
    diagnosis,
  }

  // Optionally run alerts now (capped to protect the request timeout)
  if (run) {
    if (!canSendEmail) {
      report.run = { skipped: true, reason: "No email provider configured — fix that first." }
      return NextResponse.json(report)
    }
    const contacts = await prisma.contact.findMany({
      where: { matchPrefsCompletedAt: { not: null }, email: { not: null }, doNotEmail: false },
      select: { id: true, firstName: true, email: true },
      take: 50,
    })
    let sent = 0
    const results: any[] = []
    for (const c of contacts) {
      try {
        const r = await triggerMatchAlert(c.id)
        if (r.sent) sent++
        results.push({ name: c.firstName, email: c.email, sent: r.sent, reason: r.reason || null })
      } catch (e: any) {
        results.push({ name: c.firstName, email: c.email, sent: false, reason: e?.message })
      }
    }
    report.run = { processed: contacts.length, emailsSent: sent, results }
  }

  return NextResponse.json(report)
}
