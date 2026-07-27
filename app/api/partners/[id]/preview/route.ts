export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { signLenderJWT, lenderCookieOptions } from "@/lib/lender-auth"

// Agent-only: open a loan officer's portal exactly as they see it (no password).
// Mints a lender session for that LO and redirects to /lender. Open in a NEW tab
// so it doesn't disturb the agent's CRM session.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const session = await auth()
  if (!session) return NextResponse.redirect(`${appUrl}/login`)

  const lo = await prisma.loanOfficer.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!lo) return NextResponse.redirect(`${appUrl}/partners`)

  const token = await signLenderJWT(lo.id)
  const opts = lenderCookieOptions()
  const res = NextResponse.redirect(`${appUrl}/lender?preview=1`)
  res.cookies.set(opts.name, token, opts)
  return res
}
