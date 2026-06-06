import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { prisma } from "./prisma"

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "portal-secret-fallback-change-in-prod"
)
const COOKIE = "portal_session"

export async function signPortalJWT(contactId: string): Promise<string> {
  return new SignJWT({ contactId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret)
}

export async function verifyPortalJWT(token: string): Promise<{ contactId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return { contactId: payload.contactId as string }
  } catch {
    return null
  }
}

export async function getPortalSession() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyPortalJWT(token)
}

export async function getPortalContact() {
  const session = await getPortalSession()
  if (!session) return null
  const contact = await prisma.contact.findUnique({
    where: { id: session.contactId },
    include: {
      transactions: {
        include: { milestones: { orderBy: { order: "asc" } }, documents: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      appointments: {
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 5,
      },
      propertySaves: {
        include: { property: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      portalMessages: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      tasks: {
        where: { status: "PENDING" },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
    },
  })
  return contact
}

export function portalCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  }
}
