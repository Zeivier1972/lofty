export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

// GET — list referral partners with lead counts
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const partners = await prisma.referralPartner.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      referrals: { select: { id: true, status: true } },
    },
  })

  const ACTIVE = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"]
  return NextResponse.json(partners.map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    brokerage: p.brokerage,
    feePct: p.feePct,
    isActive: p.isActive,
    notes: p.notes,
    portalUrl: p.token ? `${APP_URL}/partner/login?token=${p.token}` : null,
    totalReferrals: p.referrals.length,
    activeReferrals: p.referrals.filter((r: { status: string }) => ACTIVE.includes(r.status)).length,
    closedReferrals: p.referrals.filter((r: { status: string }) => r.status === "CLOSED").length,
  })))
}

// POST — add a referral partner
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, email, phone, brokerage, feePct, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const partner = await prisma.referralPartner.create({
    data: {
      token: crypto.randomBytes(24).toString("hex"),
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      brokerage: brokerage?.trim() || null,
      feePct: typeof feePct === "number" ? feePct : null,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json(partner)
}
