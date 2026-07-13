export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// "HOT properties in the market" blast.
//   GET  → { ok, recipientCount }   — how many engaged buyers would receive it
//   POST { propertyIds } → sends the email to those buyers, returns { ok, sent }
//
// Audience = ENGAGED buyers only: contacts with 3+ saves/views (the same
// "Compradores calientes" signal shown on the dashboard) who are emailable.
// Deliberately NOT a blast to the whole list — keeps cost down and reply rate up.

async function engagedBuyerIds(): Promise<string[]> {
  const [savesByContact, viewsByContact] = await Promise.all([
    prisma.propertySave.groupBy({ by: ["contactId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.propertyView.groupBy({ by: ["contactId"], where: { contactId: { not: null } }, _count: { _all: true } }),
  ])
  const map = new Map<string, number>()
  for (const r of [...savesByContact, ...viewsByContact] as any[]) {
    const id = r.contactId
    if (!id) continue
    map.set(id, (map.get(id) || 0) + r._count._all)
  }
  return Array.from(map.entries()).filter(([, n]) => n >= 3).map(([id]) => id)
}

async function emailableRecipients() {
  const ids = await engagedBuyerIds()
  if (!ids.length) return []
  return prisma.contact.findMany({
    where: { id: { in: ids }, email: { not: null }, doNotEmail: false },
    select: { id: true, firstName: true, email: true },
  })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const recipients = await emailableRecipients()
  return NextResponse.json({ ok: true, recipientCount: recipients.length })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { propertyIds } = await req.json().catch(() => ({ propertyIds: [] }))
  const ids: string[] = Array.isArray(propertyIds) ? propertyIds.filter(Boolean) : []
  if (!ids.length) return NextResponse.json({ error: "No hay propiedades seleccionadas" }, { status: 400 })

  const properties = await prisma.property.findMany({
    where: { id: { in: ids } },
    select: { id: true, mlsId: true, address: true, city: true, price: true, bedrooms: true, bathrooms: true, sqft: true, images: true },
  })
  if (!properties.length) return NextResponse.json({ error: "No se encontraron esas propiedades" }, { status: 400 })

  const recipients = await emailableRecipients()
  if (!recipients.length) return NextResponse.json({ ok: true, sent: 0, reason: "No hay compradores interesados con email disponible." })

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true } }).catch(() => null)
  const agentName = cfg?.realtorName || "Catherine Gomez"
  const agentPhone = cfg?.realtorPhone || "305-283-0872"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  const priceStr = (p: number | null) =>
    p == null ? "" : (p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M` : `$${p.toLocaleString()}`)
  const firstImage = (images: string | null): string => {
    if (!images) return ""
    try { const arr = JSON.parse(images); return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : "" } catch { return "" }
  }

  const cards = properties.map(p => {
    const url = p.mlsId ? `${appUrl}/homes/${encodeURIComponent(p.mlsId)}` : `${appUrl}/homes`
    const photo = firstImage(p.images)
    const specs = [
      p.bedrooms != null ? `${p.bedrooms} bd` : "",
      p.bathrooms != null ? `${p.bathrooms} ba` : "",
      p.sqft != null ? `${p.sqft.toLocaleString()} sqft` : "",
    ].filter(Boolean).join(" · ")
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <tr><td>
          <a href="${url}" target="_blank" style="text-decoration:none;color:inherit">
            ${photo ? `<img src="${photo}" alt="Property" width="580" style="width:100%;max-width:580px;height:200px;object-fit:cover;display:block"/>` : ""}
            <div style="padding:16px">
              ${p.price != null ? `<p style="font-size:22px;font-weight:800;color:#059669;margin:0 0 4px">${priceStr(p.price)}</p>` : ""}
              <p style="font-weight:700;color:#111827;font-size:15px;margin:0 0 2px">${p.address}</p>
              ${p.city ? `<p style="color:#6b7280;font-size:13px;margin:0 0 6px">${p.city}</p>` : ""}
              ${specs ? `<p style="color:#6b7280;font-size:13px;margin:0 0 10px">${specs}</p>` : ""}
              <span style="display:inline-block;background:#0e1f3d;color:#fff;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700">Ver fotos y detalles →</span>
            </div>
          </a>
        </td></tr>
      </table>`
  }).join("")

  const buildHtml = (firstName: string) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1a2f50 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">🔥 PROPIEDADES HOT EN EL MERCADO</p>
    <h1 style="color:white;font-size:26px;font-weight:900;margin:0 0 6px">Lo más buscado en Miami ahora mismo</h1>
    <p style="color:#8fa3c4;font-size:14px;margin:0">Estas propiedades están generando mucho interés 🏡</p>
  </td></tr>
  <tr><td style="background:white;padding:24px 20px">
    <p style="color:#374151;font-size:15px;margin:0 0 12px">¡Hola <strong>${firstName || "!"}</strong>!</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      Soy Sofía, la asistente de ${agentName}. Estas son de las propiedades más populares del mercado en este momento — toca cualquiera para ver todas las fotos y detalles:
    </p>
    ${cards}
    <div style="text-align:center;margin:8px 0 24px">
      <a href="${appUrl}/homes" style="display:inline-block;background:#0e1f3d;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Ver todo el inventario →</a>
    </div>
    <div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center">
      <p style="color:#374151;font-size:14px;margin:0 0 4px"><strong>${agentName}</strong></p>
      <p style="color:#6b7280;font-size:13px;margin:0">${agentPhone} · Luxury Real Estate Miami</p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

  let sent = 0
  for (const r of recipients) {
    if (!r.email) continue
    const ok = await sendEmail({
      to: r.email,
      subject: "🔥 Propiedades HOT en el mercado de Miami",
      html: buildHtml(r.firstName || ""),
    }).catch(() => false)
    if (ok) {
      sent++
      prisma.activity.create({
        data: { type: "EMAIL_SENT", title: "Email de Propiedades HOT enviado", description: `${properties.length} propiedades`, contactId: r.id },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, sent, recipients: recipients.length, properties: properties.length })
}
