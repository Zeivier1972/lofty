export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — allow time for sync + AI calls

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerMatchAlert } from "@/lib/trigger-match-alert"

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  if (!secret) return true // no secret configured — open (dev only)
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const url = new URL(req.url)
  const param = url.searchParams.get("secret")
  return header === secret || param === secret
}

// ─── Step 1: Sync fresh listings from Bridge API ──────────────────────────────
// ─── Main cron handler ────────────────────────────────────────────────────────
// Hourly auto property alerts. Loops eligible buyers and reuses triggerMatchAlert
// (live Bridge MLS + Activity-based 60-day dedup + Sofia email) — the same proven
// path used by manual sends and inbound replies. No local-DB sync required.

async function runMatchAlerts(): Promise<Response> {
  const log: string[] = []
  let emailsSent = 0
  try {
    // Respect the email provider's daily cap so we never blast thousands of
    // bounces. Count property-alert emails already sent today (ET) and only
    // send up to the remaining budget this run. Rotates: contacts not reached
    // today get picked up on a later run once budget frees up next day.
    const DAILY_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT || 100)
    // leave a little headroom for welcome/drip/Sofia emails sharing the quota
    const RESERVE = Number(process.env.EMAIL_ALERT_RESERVE || 10)
    const budget = Math.max(0, DAILY_LIMIT - RESERVE)

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)
    const alreadyToday = await prisma.activity.count({
      where: { type: "PROPERTY_ALERT_SENT", createdAt: { gte: todayStart } },
    })
    const remaining = Math.max(0, budget - alreadyToday)
    log.push(`Daily budget ${budget} (limit ${DAILY_LIMIT} − reserve ${RESERVE}); already sent today ${alreadyToday}; remaining ${remaining}`)

    if (remaining === 0) {
      log.push("Daily email budget reached — skipping this run to avoid bounces.")
      return NextResponse.json({ success: true, emailsSent: 0, remaining: 0, log })
    }

    // Oldest-first so everyone eventually gets served across runs (fairness)
    const contacts = await prisma.contact.findMany({
      where: {
        matchPrefsCompletedAt: { not: null },
        email: { not: null },
        doNotEmail: false,
      },
      select: { id: true, firstName: true, email: true },
      orderBy: { lastContacted: "asc" },
    })
    log.push(`Eligible buyers with prefs + email: ${contacts.length}`)

    for (const contact of contacts) {
      if (emailsSent >= remaining) {
        log.push(`Reached daily budget (${remaining}) — stopping. Remaining buyers will be picked up on later runs.`)
        break
      }
      try {
        const result = await triggerMatchAlert(contact.id)
        if (result.sent) {
          emailsSent++
          // Mark as contacted so fairness rotation advances them to the back
          await prisma.contact.update({ where: { id: contact.id }, data: { lastContacted: new Date() } }).catch(() => {})
        }
      } catch (e) {
        log.push(`✗ ${contact.firstName}: ${(e as Error).message}`)
      }
    }

    log.push(`Done. Emails sent: ${emailsSent}`)
    return NextResponse.json({ success: true, emailsSent, eligible: contacts.length, remaining: remaining - emailsSent, log })
  } catch (e) {
    console.error("[match-alerts cron] Fatal error:", e)
    return NextResponse.json({ error: (e as Error).message, log }, { status: 500 })
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return runMatchAlerts()
}

// Railway's cron calls POST — support both so the hourly job actually runs.
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return runMatchAlerts()
}
