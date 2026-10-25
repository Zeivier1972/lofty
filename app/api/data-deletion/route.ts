export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { clientIp, rateLimit } from "@/lib/spam-guard"

/**
 * Public data-deletion request endpoint, backing /data-deletion.
 *
 * Meta requires a documented way for a person to ask us to delete the data the
 * app collected about them. This records the request, stops every outbound
 * channel for the matching contacts immediately, and alerts Catherine so the
 * purge happens inside the 30 days the page promises. The purge itself is
 * deliberately NOT automatic here: a contact may be tied to a closed
 * transaction that Florida law requires us to retain, so a person reviews it.
 *
 * The Meta callback at /api/facebook/data-deletion is the automatic path — it
 * deletes the Facebook/Instagram message data outright, since that is the data
 * the app itself collected.
 */

const MAX = 300

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX) : ""
}

export async function POST(req: Request) {
  const ip = clientIp(req)
  const limited = rateLimit(`data-deletion:${ip}`, 5, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 })
  }

  const email = clean(body.email).toLowerCase()
  const phone = clean(body.phone)
  const handle = clean(body.handle).replace(/^@/, "")
  const note = clean(body.note)

  if (!email && !phone && !handle) {
    return NextResponse.json(
      { ok: false, error: "Indica al menos un correo, teléfono o usuario de Instagram." },
      { status: 400 },
    )
  }

  // Digits only, so "(786) 290-5831" matches a stored "7862905831".
  const phoneDigits = phone.replace(/\D/g, "")

  const or: any[] = []
  if (email) or.push({ email: { equals: email, mode: "insensitive" } })
  if (phoneDigits.length >= 7) or.push({ phone: { contains: phoneDigits.slice(-10) } })
  if (handle) {
    or.push({ socialInstagram: { contains: handle, mode: "insensitive" } })
    or.push({ instagramIgsid: handle })
    or.push({ facebookPsid: handle })
  }

  let matches: { id: string; firstName: string; lastName: string }[] = []
  if (or.length) {
    matches = await prisma.contact
      .findMany({ where: { OR: or }, select: { id: true, firstName: true, lastName: true }, take: 25 })
      .catch(() => [])
  }

  // Stop every outbound channel right now. The cron jobs and the Smart Plan
  // runner all gate on these flags, so this takes effect on the next tick
  // rather than waiting for the manual purge.
  if (matches.length) {
    await prisma.contact
      .updateMany({
        where: { id: { in: matches.map(m => m.id) } },
        data: { doNotCall: true, doNotEmail: true, doNotText: true },
      })
      .catch(e => console.error("[DATA DELETION] opt-out failed:", e))
  }

  const identifiers = [
    email ? `email: ${email}` : "",
    phone ? `phone: ${phone}` : "",
    handle ? `handle: @${handle}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const notification = await prisma.aINotification.create({
    data: {
      type: "DATA_DELETION",
      priority: "HIGH",
      title: "Solicitud de eliminación de datos",
      body: `${identifiers}${note ? ` — "${note}"` : ""}${
        matches.length
          ? ` — ${matches.length} contacto(s) encontrados y dados de baja automáticamente.`
          : " — sin coincidencias en el CRM."
      }`,
      contactId: matches[0]?.id ?? null,
      metadata: JSON.stringify({
        source: "WEB_FORM",
        email: email || null,
        phone: phone || null,
        handle: handle || null,
        note: note || null,
        matchedContactIds: matches.map(m => m.id),
        requestedAt: new Date().toISOString(),
      }),
    },
  })

  // The notification id doubles as the confirmation code, so Catherine can find
  // the request from a code the person quotes back.
  const confirmationCode = notification.id

  for (const m of matches) {
    await prisma.activity
      .create({
        data: {
          contactId: m.id,
          type: "NOTE",
          title: `Solicitud de eliminación de datos recibida (código ${confirmationCode}). Contacto dado de baja de SMS, email y llamadas.`,
        },
      })
      .catch(() => {})
  }

  const config = await prisma.aIConfig
    .findFirst({ select: { realtorEmail: true } })
    .catch(() => null)
  const agentEmail =
    config?.realtorEmail || process.env.REALTOR_EMAIL || process.env.AGENT_EMAIL

  if (agentEmail) {
    const rows = matches.length
      ? matches
          .map(
            m =>
              `<tr><td style="padding:4px 12px 4px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL}/contacts/${m.id}" style="color:#1a2744">${m.firstName} ${m.lastName}</a></td></tr>`,
          )
          .join("")
      : `<tr><td style="padding:4px 0;color:#666">Ningún contacto coincide en el CRM.</td></tr>`

    sendEmail({
      to: agentEmail,
      subject: `⚠️ Solicitud de eliminación de datos — ${identifiers}`,
      transactional: true,
      html: `
        <h2 style="margin:0 0 12px;font-size:18px">Solicitud de eliminación de datos</h2>
        <p style="margin:0 0 16px;font-size:14px">
          Alguien pidió que elimináramos sus datos desde
          <a href="https://www.catherinegomezrealtor.com/data-deletion">la página de eliminación</a>.
          Tenemos <strong>30 días</strong> para completarla.
        </p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 16px 6px 0;color:#666">Identificadores</td><td>${identifiers}</td></tr>
          ${note ? `<tr><td style="padding:6px 16px 6px 0;color:#666;vertical-align:top">Comentario</td><td><em>"${note}"</em></td></tr>` : ""}
          <tr><td style="padding:6px 16px 6px 0;color:#666">Código</td><td><code>${confirmationCode}</code></td></tr>
        </table>
        <h3 style="margin:20px 0 8px;font-size:15px">Contactos encontrados</h3>
        <table style="border-collapse:collapse;font-size:14px">${rows}</table>
        <p style="margin-top:16px;font-size:13px;color:#666">
          Ya los dimos de baja automáticamente de SMS, email y llamadas. Falta borrar
          los registros, salvo los que debas conservar por una transacción cerrada.
        </p>
      `,
    }).catch(e => console.error("[DATA DELETION] agent email failed:", e))
  }

  console.log(
    `[DATA DELETION] request ${confirmationCode} — ${identifiers} — ${matches.length} contact(s) opted out`,
  )

  return NextResponse.json({ ok: true, confirmationCode, matched: matches.length })
}
