export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { partnerCookieOptions } from "@/lib/partner-auth"

export async function POST() {
  const opts = partnerCookieOptions()
  cookies().set(opts.name, "", { ...opts, maxAge: 0 })
  return NextResponse.json({ success: true })
}
