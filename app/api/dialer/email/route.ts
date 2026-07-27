export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendEmail, wrapEmail } from "@/lib/email"

// Send a quick follow-up email to a lead straight from the dialer — used when a
// lead has no phone number to call. Personal 1:1, so it lands in Primary.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { contactId } = await req.json().catch(() => ({}))
  if (!contactId) return NextResponse.json({ ok: false, error: "contactId requerido" }, { status: 400 })

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, email: true, doNotEmail: true },
  })
  if (!contact) return NextResponse.json({ ok: false, error: "Contacto no encontrado" }, { status: 404 })
  if (!contact.email) return NextResponse.json({ ok: false, error: "El lead no tiene email" }, { status: 400 })
  if (contact.doNotEmail) return NextResponse.json({ ok: false, error: "Este lead está marcado como no-email" }, { status: 400 })

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true, realtorEmail: true } }).catch(() => null)
  const agentName = cfg?.realtorName || "Catherine Gomez"
  const agentPhone = cfg?.realtorPhone || "305-283-0872"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  const html = wrapEmail(`
    <p style="color:#374151;font-size:15px;margin:0 0 12px">¡Hola ${contact.firstName || ""}! 👋</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      Soy ${agentName}. Intenté comunicarme contigo sobre tu búsqueda de propiedades en Miami y quería asegurarme de darte seguimiento.
      ¿Te gustaría que te envíe opciones que se ajusten a lo que buscas, o prefieres agendar una llamada rápida?
    </p>
    <a href="${appUrl}/book" style="background:#c9a84c;color:#0a0e1a;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 0 16px">Agendar una llamada →</a>
    <p style="color:#6b7280;font-size:14px;margin:0">O respóndeme a este correo — con gusto te ayudo. 📞 ${agentPhone}</p>
  `, { agentName, agentPhone, agentEmail: cfg?.realtorEmail || "" })

  const ok = await sendEmail({
    to: contact.email,
    transactional: true,
    subject: `Seguimiento — ${agentName}, Catherine Gomez Realtor`,
    html,
  }).catch(() => false)

  if (ok) {
    await prisma.activity.create({
      data: { type: "EMAIL_SENT", title: "Email de seguimiento enviado desde el marcador", contactId, userId: session.user?.id },
    }).catch(() => {})
  }

  return NextResponse.json({ ok })
}
