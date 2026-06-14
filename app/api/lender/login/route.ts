export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { signLenderJWT, lenderCookieOptions } from "@/lib/lender-auth"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 })
  }

  const partner = await prisma.loanOfficer.findUnique({ where: { email: email.toLowerCase() } })
  if (!partner || !partner.isActive) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, partner.passwordHash)
  if (!valid) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })

  const token = await signLenderJWT(partner.id)
  const opts = lenderCookieOptions()
  cookies().set(opts.name, token, opts)

  return NextResponse.json({ success: true, name: partner.name })
}
