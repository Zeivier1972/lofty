import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { prisma } from "./prisma"

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "portal-secret-fallback-change-in-prod"
)
const COOKIE = "lender_session"

export async function signLenderJWT(loanOfficerId: string): Promise<string> {
  return new SignJWT({ loanOfficerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret)
}

export async function verifyLenderJWT(token: string): Promise<{ loanOfficerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return { loanOfficerId: payload.loanOfficerId as string }
  } catch {
    return null
  }
}

export async function getLenderSession() {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  return verifyLenderJWT(token)
}

export async function getLoanOfficer() {
  const session = await getLenderSession()
  if (!session) return null
  const lo = await prisma.loanOfficer.findUnique({ where: { id: session.loanOfficerId } })
  if (!lo || !lo.isActive) return null
  return lo
}

export function lenderCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  }
}
