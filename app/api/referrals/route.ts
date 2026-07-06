export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import crypto from "crypto"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

// GET — list lead referrals with contact + partner info
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const partnerId = searchParams.get("partnerId") || undefined
  const status = searchParams.get("status") || undefined

  const referrals = await prisma.leadReferral.findMany({
    where: {
      ...(partnerId && { partnerId }),
      ...(status && { status }),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, buyerLocation: true, buyerBudgetMax: true } },
      partner: { select: { id: true, name: true, brokerage: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  })
  return NextResponse.json(referrals)
}

function buildReferralEmail(opts: {
  partnerName: string
  contact: any
  note: string | null
  agentName: string
  agentPhone: string
  portalUrl: string
}): string {
  const { partnerName, contact: c, note, agentName, agentPhone, portalUrl } = opts
  const prefs = [
    c.buyerLocation ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Área de interés</td><td style="color:#111827">${c.buyerLocation}</td></tr>` : "",
    c.buyerBudgetMax ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Presupuesto</td><td style="color:#111827">${c.buyerBudgetMin ? "$" + Number(c.buyerBudgetMin).toLocaleString() + " – " : "hasta "}$${Number(c.buyerBudgetMax).toLocaleString()}</td></tr>` : "",
    c.buyerBedroomsMin ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Habitaciones</td><td style="color:#111827">${c.buyerBedroomsMin}+</td></tr>` : "",
    c.buyerPropertyType ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Tipo</td><td style="color:#111827">${c.buyerPropertyType}</td></tr>` : "",
  ].join("")

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="background:#0a1628;border-radius:14px 14px 0 0;padding:26px 30px">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px">REFERIDO DE LEAD</p>
    <h1 style="color:white;font-size:21px;font-weight:900;margin:0">Nuevo lead para ti 🤝</h1>
  </td></tr>
  <tr><td style="background:white;padding:26px 30px">
    <p style="color:#374151;font-size:15px;margin:0 0 14px">Hola <strong>${partnerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;margin:0 0 18px">${agentName} te está refiriendo este lead. Por favor contáctalo lo antes posible:</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:0 0 18px">
      <p style="font-size:17px;font-weight:800;color:#111827;margin:0 0 8px">${c.firstName} ${c.lastName || ""}</p>
      <table style="font-size:14px">
        ${c.phone ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Teléfono</td><td><a href="tel:${c.phone}" style="color:#0e1f3d;font-weight:700">${c.phone}</a></td></tr>` : ""}
        ${c.email ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td><a href="mailto:${c.email}" style="color:#0e1f3d">${c.email}</a></td></tr>` : ""}
        ${prefs}
      </table>
    </div>
    ${note ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:0 0 18px"><p style="color:#92400e;font-size:13px;margin:0"><strong>Nota de ${agentName}:</strong> ${note}</p></div>` : ""}
    <div style="text-align:center;margin:0 0 18px">
      <a href="${portalUrl}" style="display:inline-block;background:#0e1f3d;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Ver mis leads y dar seguimiento →
      </a>
      <p style="color:#9ca3af;font-size:11px;margin:8px 0 0">En tu portal puedes actualizar el estado, agregar notas y registrar llamadas.</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0">Cualquier pregunta, contáctame: <strong>${agentName}</strong> · ${agentPhone}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// POST — refer a lead to a partner (creates record + notifies partner)
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, partnerId, note } = await req.json()
  if (!contactId || !partnerId) {
    return NextResponse.json({ error: "contactId and partnerId are required" }, { status: 400 })
  }

  const [contact, partner, aiConfig] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId } }),
    prisma.referralPartner.findUnique({ where: { id: partnerId } }),
    prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true } }).catch(() => null),
  ])
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })

  const agentName = aiConfig?.realtorName || "Catherine Gomez"
  const agentPhone = aiConfig?.realtorPhone || "305-283-0872"

  // Ensure the partner has a portal access token (magic link)
  let portalToken = partner.token
  if (!portalToken) {
    portalToken = crypto.randomBytes(24).toString("hex")
    await prisma.referralPartner.update({ where: { id: partner.id }, data: { token: portalToken } })
  }
  const portalUrl = `${APP_URL}/partner/login?token=${portalToken}`

  const referral = await prisma.leadReferral.create({
    data: { contactId, partnerId, notes: note?.trim() || null },
  })

  // Notify the partner — email and/or SMS with the lead's details
  let emailSent = false
  let smsSent = false
  if (partner.email) {
    emailSent = await sendEmail({
      to: partner.email,
      subject: `🤝 Nuevo lead referido: ${contact.firstName} ${contact.lastName || ""}`.trim(),
      html: buildReferralEmail({ partnerName: partner.name, contact, note: note?.trim() || null, agentName, agentPhone, portalUrl }),
    }).catch(() => false)
  }
  // SMS notification intentionally disabled — partners are notified by email only.

  // Log on the contact's timeline
  await prisma.activity.create({
    data: {
      contactId,
      userId: session.user?.id,
      type: "LEAD_REFERRED",
      title: `Lead referred to ${partner.name}${partner.brokerage ? ` (${partner.brokerage})` : ""}`,
      description: note?.trim() || undefined,
      metadata: JSON.stringify({ referralId: referral.id, partnerId, emailSent, smsSent }),
    },
  }).catch(() => {})

  return NextResponse.json({ ...referral, emailSent, smsSent })
}
