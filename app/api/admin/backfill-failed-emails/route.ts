export const dynamic = "force-dynamic"
export const maxDuration = 120

// Look at emails that FAILED and stop emailing the truly-bad addresses.
// A FAILED row is only a reason to block if it's a PERMANENT problem
// (invalid address / mailbox doesn't exist / rejected recipient). Rate-limit
// and timeout failures are TRANSIENT and must NOT block a real address.
//
//   GET  /api/admin/backfill-failed-emails          → preview, grouped by reason
//   GET  /api/admin/backfill-failed-emails?apply=1  → flag the permanent ones doNotEmail
// Session-protected.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Reason fragments that mean "this address will never receive mail"
const PERMANENT = [
  "invalid", "no existe", "does not exist", "no such", "mailbox unavailable",
  "recipient rejected", "user unknown", "address rejected", "not found",
  "550", "5.1.1", "unable to lookup", "domain not found",
]
// Reason fragments that are TRANSIENT — never block on these
const TRANSIENT = ["rate", "429", "timeout", "timed out", "temporarily", "too many", "no email provider"]

function isPermanent(reason: string): boolean {
  const r = reason.toLowerCase()
  if (TRANSIENT.some(t => r.includes(t))) return false
  return PERMANENT.some(p => r.includes(p))
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"

  // Failed + already-known bounces (from the Resend webhook)
  const failed = await prisma.email.findMany({
    where: { direction: "OUTBOUND", status: { in: ["FAILED", "BOUNCED"] } },
    select: { toAddress: true, body: true, status: true },
    take: 5000,
    orderBy: { createdAt: "desc" },
  })

  // Best address → its worst reason
  const reasonByAddr = new Map<string, string>()
  const byReason: Record<string, number> = {}
  for (const e of failed) {
    const addr = (e.toAddress || "").trim().toLowerCase()
    if (!addr) continue
    const reason = e.status === "BOUNCED"
      ? "bounced (address dead)"
      : (e.body.match(/^\[SEND FAILED: ([^\]]+)\]/)?.[1] || "unknown")
    if (!reasonByAddr.has(addr) || isPermanent(reason)) reasonByAddr.set(addr, reason)
  }

  // Which addresses are permanent-bad AND belong to a contact still emailable?
  const permAddrs: string[] = []
  for (const [addr, reason] of Array.from(reasonByAddr.entries())) {
    const key = isPermanent(reason) ? reason.slice(0, 40) : "transient/other (kept emailable)"
    byReason[key] = (byReason[key] || 0) + 1
    if (isPermanent(reason)) permAddrs.push(addr)
  }

  const contacts = permAddrs.length
    ? await prisma.contact.findMany({
        where: { email: { in: permAddrs, mode: "insensitive" }, doNotEmail: false },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : []

  if (!apply) {
    return NextResponse.json({
      preview: true,
      failedEmailRowsScanned: failed.length,
      distinctFailedAddresses: reasonByAddr.size,
      permanentBadAddresses: permAddrs.length,
      contactsToFlag: contacts.length,
      breakdownByReason: byReason,
      sample: contacts.slice(0, 20).map(c => ({ name: `${c.firstName} ${c.lastName || ""}`.trim(), email: c.email })),
      message: `${contacts.length} contacts have a PERMANENT email failure (invalid/nonexistent) and would be set doNotEmail. Transient failures (rate limits, timeouts) are kept emailable. Add ?apply=1 to apply.`,
    })
  }

  let flagged = 0
  if (contacts.length > 0) {
    const r = await prisma.contact.updateMany({
      where: { id: { in: contacts.map(c => c.id) } },
      data: { doNotEmail: true },
    })
    flagged = r.count
    for (const c of contacts) {
      prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          title: "📪 Email desactivado automáticamente",
          description: `El correo ${c.email} falló de forma permanente (dirección inválida o inexistente). No se enviarán más emails; usa teléfono o texto.`,
          contactId: c.id,
        },
      }).catch(() => {})
    }
  }

  return NextResponse.json({
    applied: true,
    contactsFlaggedDoNotEmail: flagged,
    message: `Marked ${flagged} contacts doNotEmail — their address permanently failed. They'll never be emailed again (call/text instead). Transient failures were left alone.`,
  })
}
