export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const { firstName, lastName, email, phone } = await req.json()
    if (!firstName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "First name and email are required." }, { status: 400 })
    }

    const em = email.trim().toLowerCase()
    const ph = phone?.trim() || null

    // Find or create contact
    let contact = await prisma.contact.findFirst({ where: { email: em } })
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName?.trim() || "",
          email: em,
          phone: ph,
          source: "PORTAL_REGISTER",
          status: "NEW_LEAD",
        },
      })
    }

    // Get or create portal access
    let access = await prisma.clientPortalAccess.findUnique({ where: { contactId: contact.id } })
    if (!access) {
      access = await prisma.clientPortalAccess.create({ data: { contactId: contact.id } })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const portalUrl = `${appUrl}/portal/login?token=${access.token}`

    // Send magic-link welcome email
    await sendEmail({
      to: em,
      subject: "¡Bienvenido(a) al Portal del Cliente! 🏠 Welcome to Your Client Portal",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:32px 16px">
          <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
            <div style="background:linear-gradient(135deg,#1a3a5c,#c9a84c);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
              <p style="color:white;font-size:28px;margin:0">🏠</p>
              <h1 style="color:white;margin:8px 0 0;font-size:20px">Client Portal Access</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:4px 0 0">Catherine Gomez Realtor</p>
            </div>
            <p style="color:#374151;font-size:15px;margin:0 0 8px">¡Hola <strong>${contact.firstName}</strong>! 👋</p>
            <p style="color:#374151;font-size:14px;margin:0 0 16px">
              Tu cuenta del portal ha sido creada. Haz clic abajo para acceder a tu portal y:
            </p>
            <ul style="color:#6b7280;font-size:14px;margin:0 0 24px;padding-left:20px;line-height:2">
              <li>Ver propiedades guardadas y recomendadas</li>
              <li>Actualizar tus preferencias de búsqueda</li>
              <li>Recibir alertas de nuevas propiedades</li>
              <li>Seguir el proceso de tu compra</li>
            </ul>
            <div style="text-align:center;margin:0 0 20px">
              <a href="${portalUrl}" style="display:inline-block;background:#1a3a5c;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
                Acceder a Mi Portal →
              </a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
              Este enlace es solo para ti. Si no creaste esta cuenta, puedes ignorar este correo.
            </p>
          </div>
        </div>
      `,
    })

    // Notify agent
    await prisma.aINotification.create({
      data: {
        type: "NEW_LEAD",
        title: `🆕 Nuevo registro en el portal: ${contact.firstName} ${contact.lastName || ""}`.trim(),
        body: `${em}${ph ? ` · ${ph}` : ""} se registró en el portal web.`,
        priority: "MEDIUM",
        contactId: contact.id,
      },
    }).catch(() => {})

    await prisma.activity.create({
      data: {
        type: "NOTE",
        title: "Se registró en el portal web",
        description: "El cliente creó su cuenta desde la página principal.",
        contactId: contact.id,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true, contactId: contact.id })
  } catch (e: any) {
    console.error("[portal/register]", e)
    return NextResponse.json({ error: e.message || "Registration failed" }, { status: 500 })
  }
}
