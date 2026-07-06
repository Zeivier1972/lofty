export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signPartnerJWT, partnerCookieOptions } from "@/lib/partner-auth"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { token, preview } = await req.json()
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

  const partner = await prisma.referralPartner.findUnique({ where: { token } })
  if (!partner || !partner.isActive) {
    return NextResponse.json({ error: "Invalid or expired access link. Contact your referring agent." }, { status: 401 })
  }

  // Admin previews don't count as a partner login
  if (!preview) {
    await prisma.referralPartner.update({
      where: { id: partner.id },
      data: { lastLoginAt: new Date() },
    })
  }

  const jwt = await signPartnerJWT(partner.id)
  const opts = partnerCookieOptions()
  cookies().set(opts.name, jwt, opts)

  return NextResponse.json({ success: true, partnerName: partner.name })
}
