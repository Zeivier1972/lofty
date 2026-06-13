export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cancelSubscription } from "@/lib/stripe"

// PATCH — update loan officer
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const data: any = {}
  if (typeof body.isActive === "boolean") data.isActive = body.isActive
  if (body.monthlyFee !== undefined) data.monthlyFee = Number(body.monthlyFee)
  if (body.name) data.name = body.name
  if (body.company !== undefined) data.company = body.company || null
  if (body.phone !== undefined) data.phone = body.phone || null

  let tempPassword: string | undefined
  if (body.resetPassword) {
    tempPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
    data.passwordHash = await bcrypt.hash(tempPassword, 10)
  }

  // Admin can manually cancel the Stripe subscription
  if (body.cancelSubscription) {
    const partner = await prisma.loanOfficer.findUnique({ where: { id: params.id } })
    if (partner?.stripeSubscriptionId) {
      await cancelSubscription(partner.stripeSubscriptionId).catch(() => {})
    }
    data.subscriptionStatus = "canceled"
    data.stripeSubscriptionId = null
    data.subscriptionEndDate = null
  }

  const partner = await prisma.loanOfficer.update({ where: { id: params.id }, data })
  return NextResponse.json({
    partner: {
      id: partner.id,
      name: partner.name,
      isActive: partner.isActive,
      monthlyFee: partner.monthlyFee,
      subscriptionStatus: partner.subscriptionStatus,
    },
    ...(tempPassword && { tempPassword }),
  })
}

// DELETE — remove loan officer (and their shares via cascade)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const partner = await prisma.loanOfficer.findUnique({ where: { id: params.id } })
  if (partner?.stripeSubscriptionId) {
    await cancelSubscription(partner.stripeSubscriptionId).catch(() => {})
  }

  await prisma.loanOfficer.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
