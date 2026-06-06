export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signPortalJWT, portalCookieOptions } from "@/lib/portal-auth"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

  const access = await prisma.clientPortalAccess.findUnique({
    where: { token },
    include: { contact: true },
  })

  if (!access || !access.isActive) {
    return NextResponse.json({ error: "Invalid or expired access link. Contact your agent." }, { status: 401 })
  }

  // Update last login
  await prisma.clientPortalAccess.update({
    where: { id: access.id },
    data: { lastLoginAt: new Date() },
  })

  const jwt = await signPortalJWT(access.contactId)
  const opts = portalCookieOptions()
  cookies().set(opts.name, jwt, opts)

  return NextResponse.json({ success: true, contactName: `${access.contact.firstName} ${access.contact.lastName}` })
}
