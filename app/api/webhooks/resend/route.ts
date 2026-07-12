export const dynamic = "force-dynamic"

// Resend delivery webhook. Configure in Resend → Webhooks with this URL:
//   {NEXT_PUBLIC_APP_URL}/api/webhooks/resend
// On a HARD bounce or spam complaint we flag the contact doNotEmail so the
// central guard in sendEmail never emails that address again (stops wasting
// sends + protects sender reputation). Soft/transient bounces are ignored.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

async function flagDoNotEmail(email: string, reason: string) {
  const addr = (email || "").trim().toLowerCase()
  if (!addr) return
  const contacts = await prisma.contact.findMany({
    where: { email: { equals: addr, mode: "insensitive" }, doNotEmail: false },
    select: { id: true, firstName: true, lastName: true },
  })
  if (contacts.length === 0) return
  await prisma.contact.updateMany({
    where: { id: { in: contacts.map(c => c.id) } },
    data: { doNotEmail: true },
  })
  for (const c of contacts) {
    prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: "📪 Email desactivado automáticamente",
        description: `El correo ${addr} ${reason}. No se enviarán más emails a esta dirección; usa teléfono o texto.`,
        contactId: c.id,
      },
    }).catch(() => {})
  }
  // Mark recent emails to this address as BOUNCED for accurate reporting
  await prisma.email.updateMany({
    where: { toAddress: { equals: addr, mode: "insensitive" }, direction: "OUTBOUND", status: "SENT" },
    data: { status: "BOUNCED" },
  }).catch(() => {})
  console.log(`[resend-webhook] doNotEmail set on ${contacts.length} contact(s) for ${addr} (${reason})`)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const type: string = body?.type || ""
    const to: string = Array.isArray(body?.data?.to) ? body.data.to[0] : body?.data?.to || ""

    if (type === "email.bounced") {
      // Resend marks permanent bounces; treat any bounce as address-dead only
      // when it's not explicitly transient/soft.
      const bounceType = (body?.data?.bounce?.type || body?.data?.bounce_type || "").toLowerCase()
      if (bounceType.includes("transient") || bounceType.includes("soft")) {
        console.log(`[resend-webhook] soft bounce for ${to} — ignoring`)
      } else {
        await flagDoNotEmail(to, "rebotó de forma permanente (la dirección no existe o rechaza el correo)")
      }
    } else if (type === "email.complained") {
      await flagDoNotEmail(to, "marcó el correo como spam")
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[resend-webhook] error:", e)
    return NextResponse.json({ ok: true }) // never make Resend retry-storm us
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "Resend webhook endpoint — POST only" })
}
