export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// One-time endpoint to create Catherine's admin account.
// Remove after use.
export async function GET() {
  const email = "info@catherinegomezrealtor.com"
  const password = "Lofty2024!"
  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name: "Catherine Gomez", role: "ADMIN" },
    create: {
      email,
      password: hashed,
      name: "Catherine Gomez",
      role: "ADMIN",
      phone: "+13052830872",
      title: "Realtor",
    },
  })

  return NextResponse.json({ ok: true, email, password, userId: user.id })
}
