export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET — list loan officers with subscription status and share stats
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const partners = await prisma.loanOfficer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      leadShares: {
        select: { id: true, status: true, price: true, loStatus: true, createdAt: true },
      },
    },
  })

  const result = partners.map(p => {
    const paidShares = p.leadShares.filter(s => s.status === "PAID")
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      company: p.company,
      phone: p.phone,
      isActive: p.isActive,
      monthlyFee: p.monthlyFee,
      subscriptionStatus: p.subscriptionStatus,
      subscriptionEndDate: p.subscriptionEndDate?.toISOString() || null,
      createdAt: p.createdAt,
      totalShares: p.leadShares.length,
      paidShares: paidShares.length,
      legacyRevenue: paidShares.reduce((sum, s) => sum + s.price, 0),
    }
  })

  return NextResponse.json({ partners: result })
}

// POST — create a loan officer, returns the temporary password once
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, email, company, phone, monthlyFee } = await req.json()
  if (!name || !email) {
    return NextResponse.json({ error: "Nombre y email son requeridos" }, { status: 400 })
  }

  const exists = await prisma.loanOfficer.findUnique({ where: { email: email.toLowerCase() } })
  if (exists) return NextResponse.json({ error: "Ya existe un loan officer con ese email" }, { status: 409 })

  const tempPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const partner = await prisma.loanOfficer.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      company: company || undefined,
      phone: phone || undefined,
      monthlyFee: monthlyFee ? Number(monthlyFee) : 99,
    },
  })

  return NextResponse.json({
    partner: { id: partner.id, name: partner.name, email: partner.email },
    tempPassword,
    portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/lender/login`,
  })
}
