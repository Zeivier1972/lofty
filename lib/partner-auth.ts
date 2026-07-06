// Auth for the referral-partner portal — magic-link token → JWT cookie,
// mirroring the client portal pattern in lib/portal-auth.ts.

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { prisma } from "./prisma"

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "portal-secret-fallback-change-in-prod"
)
const COOKIE = "partner_session"

export async function signPartnerJWT(partnerId: string): Promise<string> {
  return new SignJWT({ partnerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret)
}

export async function verifyPartnerJWT(token: string): Promise<{ partnerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return { partnerId: payload.partnerId as string }
  } catch {
    return null
  }
}

export async function getPartnerSession() {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  return verifyPartnerJWT(token)
}

export async function getPartner() {
  const session = await getPartnerSession()
  if (!session) return null
  return prisma.referralPartner.findUnique({ where: { id: session.partnerId } })
}

export function partnerCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  }
}
