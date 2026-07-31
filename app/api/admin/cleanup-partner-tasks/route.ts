export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ACTIVE_REFERRAL_STATUSES } from "@/lib/referral"

// One-time sweep: cancel any PENDING task tied to a lead that's currently
// assigned to a partner realtor. Cancelling (not deleting) keeps it reversible.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pending = await prisma.task.findMany({
    where: { status: "PENDING", contactId: { not: null } },
    select: { id: true, contactId: true },
  })
  const contactIds = Array.from(new Set(pending.map(t => t.contactId).filter(Boolean))) as string[]
  if (contactIds.length === 0) return NextResponse.json({ cancelled: 0 })

  const refs = await prisma.leadReferral.findMany({
    where: { contactId: { in: contactIds }, status: { in: ACTIVE_REFERRAL_STATUSES } },
    select: { contactId: true },
  })
  const partnerSet = new Set(refs.map(r => r.contactId))
  const taskIds = pending.filter(t => t.contactId && partnerSet.has(t.contactId)).map(t => t.id)
  if (taskIds.length === 0) return NextResponse.json({ cancelled: 0 })

  const res = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: { status: "CANCELLED" },
  })
  return NextResponse.json({ cancelled: res.count })
}
