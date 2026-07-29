export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Fast, authoritative check used by the dialer right before placing a call:
// is this lead currently assigned to a partner realtor? Catches assignments
// made after the dialer page loaded (stale in-memory queue).
const ACTIVE = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"]

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ref = await prisma.leadReferral.findFirst({
    where: { contactId: params.id, status: { in: ACTIVE } },
    orderBy: { sentAt: "desc" },
    select: { partner: { select: { name: true } } },
  }).catch(() => null)

  return NextResponse.json({ partner: ref?.partner?.name || null })
}
