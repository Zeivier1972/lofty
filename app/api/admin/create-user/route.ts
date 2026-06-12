export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// One-time endpoint to create the first user.
// Protected by ADMIN_SETUP_KEY env var.
// POST { name, email, password, key }
export async function POST(req: Request) {
  const setupKey = process.env.ADMIN_SETUP_KEY
  if (!setupKey) {
    return NextResponse.json({ error: "ADMIN_SETUP_KEY not configured in Railway" }, { status: 503 })
  }

  const { name, email, password, key } = await req.json()

  if (key !== setupKey) {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 401 })
  }

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    // Update password instead
    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { email }, data: { password: hashed, name } })
    return NextResponse.json({ success: true, action: "updated", email })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "AGENT" },
  })

  return NextResponse.json({ success: true, action: "created", email: user.email })
}
