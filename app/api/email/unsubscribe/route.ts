export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// One-click List-Unsubscribe target (RFC 8058). Gmail/Yahoo POST here directly;
// a person clicking the link hits GET. Either way we flag the contact
// doNotEmail so we stop mailing them — and having this endpoint materially
// improves inbox placement for everyone else.
async function unsubscribe(email: string) {
  const addr = (email || "").trim().toLowerCase()
  if (!addr) return
  await prisma.contact.updateMany({
    where: { email: { equals: addr, mode: "insensitive" } },
    data: { doNotEmail: true },
  }).catch(() => {})
}

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("e") || ""
  await unsubscribe(email)
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
     <body style="font-family:Arial,sans-serif;text-align:center;padding:48px 24px;color:#333">
       <h2 style="color:#1a1a2e">Listo ✓</h2>
       <p>No recibirás más correos de Catherine Gomez Realtor.</p>
       <p style="color:#888;font-size:13px">Si fue un error, escríbenos a info@catherinegomezrealtor.com.</p>
     </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
  )
}

export async function POST(req: Request) {
  const email = new URL(req.url).searchParams.get("e") || ""
  await unsubscribe(email)
  return NextResponse.json({ ok: true })
}
