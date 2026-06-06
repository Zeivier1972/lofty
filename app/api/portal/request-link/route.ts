export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const contact = await prisma.contact.findFirst({ where: { email } })
  if (!contact) return NextResponse.json({ error: "No account found. Contact your agent." }, { status: 404 })

  // Get or create portal access
  let access = await prisma.clientPortalAccess.findUnique({ where: { contactId: contact.id } })
  if (!access) {
    access = await prisma.clientPortalAccess.create({ data: { contactId: contact.id } })
  }

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/login?token=${access.token}`

  await sendEmail({
    to: email,
    subject: "Your Client Portal Access / Acceso a Tu Portal de Cliente",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #f9fafb; padding: 32px 16px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🏠 Lofty Client Portal</h1>
            <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Your Real Estate Journey, All in One Place</p>
          </div>
          <p style="color: #374151; font-size: 16px;">Hi ${contact.firstName},</p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            Click the button below to access your secure client portal where you can track your deal progress, view documents, save favorite homes, and message your agent directly.
          </p>
          <p style="color: #9ca3af; font-size: 13px; font-style: italic; line-height: 1.6;">
            Haga clic en el botón para acceder a su portal de cliente donde puede rastrear su progreso, ver documentos y comunicarse con su agente.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${portalUrl}" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              Access My Portal →
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            This link is personal and secure. Do not share it.<br/>
            Este enlace es personal y seguro. No lo comparta.
          </p>
        </div>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
