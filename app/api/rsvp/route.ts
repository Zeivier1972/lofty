export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyTagAndEnroll } from "@/lib/lead-ingest"
import { findEventByTag } from "@/lib/events"

// Self-serve event RSVP. Leads click a link from the reminder email/SMS to
// confirm attendance without needing to answer Catherine's call.
//   /api/rsvp?c=<contactId>&ev=<eventTag>            → shows Sí / No buttons
//   /api/rsvp?c=<contactId>&ev=<eventTag>&a=yes|no   → records the answer

function page(title: string, inner: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f0f2f5"><div style="max-width:520px;margin:36px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.08)"><div style="background:#1E3A5F;padding:26px;text-align:center"><div style="color:#C9A84C;font-weight:800;font-size:20px">Catherine Gómez Realtor</div><div style="color:#fff;opacity:.85;font-size:12px;margin-top:4px">Evento de Inversión en Miami</div></div><div style="padding:32px 28px;text-align:center">${inner}</div></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const contactId = url.searchParams.get("c") || ""
  const evTag = url.searchParams.get("ev") || ""
  const answer = (url.searchParams.get("a") || "").toLowerCase()
  const ev = findEventByTag(evTag)

  if (!contactId || !ev) {
    return page("Enlace inválido", `<p style="color:#555;line-height:1.6">Este enlace de confirmación no es válido o expiró. Escríbenos y con gusto te ayudamos.</p>`)
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true, firstName: true } }).catch(() => null)
  if (!contact) {
    return page("No encontrado", `<p style="color:#555;line-height:1.6">No encontramos tu registro. Escríbenos y te ayudamos a confirmar.</p>`)
  }
  const first = (contact.firstName || "").split(" ")[0]
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
  const link = (a: string) => `${base}/api/rsvp?c=${encodeURIComponent(contactId)}&ev=${encodeURIComponent(ev.tag)}&a=${a}`

  // No answer yet → show the choice.
  if (answer !== "yes" && answer !== "no") {
    return page("Confirma tu asistencia",
      `<h2 style="color:#1E3A5F;margin:0 0 8px">${first ? `Hola ${first},` : "Hola,"} ¿nos acompañas?</h2>
       <p style="color:#555;line-height:1.6">Evento de Inversión en Miami — <strong>${ev.city}</strong> (${ev.dateLabel})${ev.venue ? `, ${ev.venue}` : ""}.</p>
       <div style="margin-top:24px">
         <a href="${link("yes")}" style="background:#059669;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block;margin:6px">✅ Sí, asistiré</a>
         <a href="${link("no")}" style="background:#e5e7eb;color:#374151;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block;margin:6px">No podré</a>
       </div>`)
  }

  const going = answer === "yes"
  // Record the RSVP: a tag Catherine can filter by + an activity marker the
  // reminder cron reads (so it stops nagging people who already answered).
  await applyTagAndEnroll(contact.id, going ? `Asiste: ${ev.city}` : `No asiste: ${ev.city}`).catch(() => {})
  await prisma.activity.create({
    data: {
      type: "EVENT_RSVP",
      title: going ? `✅ Confirmó asistencia — ${ev.city}` : `❌ No asistirá — ${ev.city}`,
      description: `rsvp:${ev.tag}:${answer}`,
      contactId: contact.id,
    },
  }).catch(() => {})

  // Someone declining is worth a heads-up so Catherine can try to recover them.
  if (!going) {
    await prisma.aINotification.create({
      data: {
        type: "ACTION",
        priority: "MEDIUM",
        title: `${first || "Un lead"} no asistirá al evento de ${ev.city}`,
        body: `Marcó "No podré" por el enlace de confirmación. Buen momento para un seguimiento personal.`,
        contactId: contact.id,
      },
    }).catch(() => {})
  }

  return going
    ? page("¡Confirmado!",
        `<div style="font-size:40px">🎉</div><h2 style="color:#1E3A5F;margin:8px 0">¡Gracias ${first}!</h2>
         <p style="color:#555;line-height:1.6">Tu asistencia al <strong>Evento de Inversión en Miami</strong> en ${ev.city} (${ev.dateLabel}) está <strong>confirmada</strong>.${ev.venue ? ` Nos vemos en <strong>${ev.venue}</strong>.` : ""}</p>
         <p style="margin-top:20px"><a href="${ev.link}" style="background:#1E3A5F;color:#C9A84C;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Ver mi ticket</a></p>`)
    : page("Gracias por avisar",
        `<h2 style="color:#1E3A5F;margin:0 0 8px">Entendido, ${first}</h2>
         <p style="color:#555;line-height:1.6">Gracias por avisarnos que no podrás asistir al evento de ${ev.city}. Si cambias de opinión, tu lugar sigue disponible.</p>
         <p style="color:#555;line-height:1.6">Catherine te contactará para ayudarte con tu inversión cuando estés listo(a). 🙌</p>`)
}
