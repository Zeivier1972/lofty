export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Email click tracker. Property links in emails point here; we log which lead
// clicked what (a high-intent signal), then redirect to the real page. Only
// redirects to our own site (no open-redirect abuse).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get("c") || ""
  const target = searchParams.get("u") || ""
  const label = searchParams.get("a") || ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  // Resolve a safe destination: must be on our own domain.
  let dest = `${appUrl}/homes`
  try {
    const t = new URL(target, appUrl)
    const base = new URL(appUrl)
    if (t.hostname === base.hostname) dest = t.toString()
  } catch { /* keep default */ }

  if (contactId) {
    prisma.activity.create({
      data: {
        type: "EMAIL_CLICK",
        title: `🖱️ Hizo clic en el email${label ? `: ${label}` : ""}`,
        description: label || dest,
        contactId,
      },
    }).catch(() => {})
  }

  return NextResponse.redirect(dest, 302)
}
