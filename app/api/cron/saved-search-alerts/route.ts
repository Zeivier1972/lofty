export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchIdxListings } from "@/lib/bridge"
import { sendEmail } from "@/lib/email"

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`
}

function buildEmail(firstName: string, count: number, label: string, link: string, appUrl: string): string {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#0a1628,#1a2f50);border-radius:16px 16px 0 0;padding:28px;text-align:center">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px">Nueva alerta de propiedades</p>
    <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0">${count} nueva${count > 1 ? "s" : ""} propiedad${count > 1 ? "es" : ""}</h1>
  </td></tr>
  <tr><td style="background:#fff;padding:28px;text-align:center">
    <p style="color:#374151;font-size:15px;margin:0 0 6px">¡Hola ${firstName}! 👋</p>
    <p style="color:#374151;font-size:14px;margin:0 0 4px">Aparecieron <strong>${count} nueva${count > 1 ? "s" : ""}</strong> que coinciden con tu búsqueda guardada:</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px"><strong>${label}</strong></p>
    <a href="${link}" style="display:inline-block;background:#0e1f3d;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Ver las propiedades →</a>
    <p style="color:#9ca3af;font-size:12px;margin:18px 0 0">Fotos, precios y detalles en el sitio.</p>
  </td></tr>
  <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:8px 28px 26px;text-align:center">
    <p style="color:#374151;font-size:14px;margin:16px 0 2px"><strong>Catherine Gomez, Realtor</strong></p>
    <p style="color:#6b7280;font-size:12px;margin:0">(305) 283-0872 · <a href="${appUrl}/homes" style="color:#6b7280">catherinegomezrealtor.com</a></p>
  </td></tr>
</table></td></tr></table></body></html>`
}

// Daily: email each saved search's lead about new matching active listings.
export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const searches = await prisma.savedSearch.findMany({ where: { isActive: true }, include: { contact: true } })

  let emailsSent = 0
  const log: string[] = []

  for (const s of searches) {
    if (!s.contact?.email || s.contact.doNotEmail) continue
    try {
      const listings = await searchIdxListings({
        city: s.city || undefined,
        zip: s.zip || undefined,
        minPrice: s.minPrice || undefined,
        maxPrice: s.maxPrice || undefined,
        minBeds: s.minBeds || undefined,
        minBaths: s.minBaths || undefined,
        propertySubType: s.propertySubType || undefined,
        limit: 50,
      })

      const since = s.lastNotifiedAt.getTime()
      const fresh = listings.filter((l: any) => {
        const d = l.OnMarketDate || l.ListingContractDate
        return d && new Date(d).getTime() >= since
      })
      if (fresh.length === 0) continue

      // Link back to /homes pre-filtered (no listing details in the email — IDX-compliant)
      const qp = new URLSearchParams()
      if (s.zip) qp.set("city", s.zip)
      else if (s.city) qp.set("city", s.city)
      if (s.minPrice) qp.set("minPrice", String(s.minPrice))
      if (s.maxPrice) qp.set("maxPrice", String(s.maxPrice))
      if (s.minBeds) qp.set("minBeds", String(s.minBeds))
      if (s.propertySubType) qp.set("type", s.propertySubType)
      const link = `${appUrl}/homes?${qp.toString()}`

      await sendEmail({
        to: s.contact.email,
        subject: `🏠 ${fresh.length} nueva${fresh.length > 1 ? "s" : ""} propiedad${fresh.length > 1 ? "es" : ""} para tu búsqueda`,
        html: buildEmail(s.contact.firstName, fresh.length, s.label, link, appUrl),
      })
      await prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } })
      await prisma.activity.create({
        data: { type: "EMAIL_SENT", title: `Alerta: ${fresh.length} nuevas propiedades`, description: s.label, contactId: s.contactId },
      }).catch(() => {})

      emailsSent++
      log.push(`✓ ${fresh.length} → ${s.contact.email}`)
    } catch (e: any) {
      log.push(`✗ ${s.id}: ${e.message}`)
    }
  }

  return NextResponse.json({ ok: true, searches: searches.length, emailsSent, log })
}
