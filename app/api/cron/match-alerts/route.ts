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
    const contacts = await prisma.contact.findMany({
      where: {
        matchPrefsCompletedAt: { not: null },
        email: { not: null },
        doNotEmail: false,
      },
      select: { id: true, firstName: true, email: true },
    })
    log.push(`Eligible buyers with prefs + email: ${contacts.length}`)

    for (const contact of contacts) {
      try {
        const result = await triggerMatchAlert(contact.id)
        if (result.sent) {
          emailsSent++
          log.push(`✓ Sent to ${contact.firstName} (${contact.email})`)
        }
      } catch (e) {
        log.push(`✗ ${contact.firstName}: ${(e as Error).message}`)
      }
    }

    log.push(`Done. Emails sent: ${emailsSent}`)
    return NextResponse.json({ success: true, emailsSent, eligible: contacts.length, log })
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
