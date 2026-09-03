export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// One-time backfill: link EXISTING Facebook Messenger bot conversations to their
// contact so they show up as repliable threads in the CASAi Inbox. For each
// conversation, resolve the contact (its stored contactId, else match by the
// conversation's email/phone), set contact.facebookPsid, link the conversation,
// and attach its inbound messages. Safe to re-run.
//   GET /api/admin/backfill-messenger-links          → preview counts
//   GET /api/admin/backfill-messenger-links?apply=1  → apply
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const apply = new URL(req.url).searchParams.get("apply") === "1"

  const convos = await prisma.facebookBotConversation.findMany({
    select: { psid: true, contactId: true, email: true, phone: true },
  })

  let matchedByContact = 0
  let matchedByEmailPhone = 0
  let alreadyLinked = 0
  let unmatched = 0
  let psidSet = 0
  let messagesLinked = 0

  for (const c of convos) {
    let contactId = c.contactId || null

    if (!contactId) {
      if (c.email) {
        const byEmail = await prisma.contact.findFirst({ where: { email: c.email }, select: { id: true } })
        if (byEmail) contactId = byEmail.id
      }
      if (!contactId && c.phone) {
        const digits = c.phone.replace(/\D/g, "").slice(-10)
        if (digits) {
          const byPhone = await prisma.contact.findFirst({ where: { phone: { contains: digits } }, select: { id: true } })
          if (byPhone) contactId = byPhone.id
        }
      }
      if (contactId) matchedByEmailPhone++
    } else {
      matchedByContact++
    }

    if (!contactId) { unmatched++; continue }

    const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { facebookPsid: true } })
    if (!contact) { unmatched++; continue }
    if (contact.facebookPsid === c.psid) alreadyLinked++

    if (apply) {
      if (!contact.facebookPsid) {
        const conflict = await prisma.contact.findFirst({ where: { facebookPsid: c.psid }, select: { id: true } })
        if (!conflict) {
          await prisma.contact.update({ where: { id: contactId }, data: { facebookPsid: c.psid } }).catch(() => {})
          psidSet++
        }
      }
      if (!c.contactId) {
        await prisma.facebookBotConversation.update({ where: { psid: c.psid }, data: { contactId } }).catch(() => {})
      }
      const r = await prisma.facebookMessage.updateMany({ where: { psid: c.psid, contactId: null }, data: { contactId } })
      messagesLinked += r.count
    }
  }

  return NextResponse.json({
    ok: true,
    apply,
    conversations: convos.length,
    matchedByContact,
    matchedByEmailPhone,
    alreadyLinked,
    unmatched,
    psidSet: apply ? psidSet : "(dry run — add ?apply=1)",
    messagesLinked: apply ? messagesLinked : "(dry run — add ?apply=1)",
  })
}
