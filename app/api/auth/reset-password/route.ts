export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })

  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)

  await Promise.all([
    prisma.user.update({ where: { email: record.email }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ success: true })
}
