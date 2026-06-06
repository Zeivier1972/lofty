import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contact = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  if (!contact.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 })

  // Get or create portal access
  let access = await prisma.clientPortalAccess.findUnique({ where: { contactId: params.id } })
  if (!access) {
    access = await prisma.clientPortalAccess.create({ data: { contactId: params.id } })
  }

  const config = await prisma.aIConfig.findFirst()
  const agentName = config?.realtorName || "Your Agent"
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/login?token=${access.token}`

  await sendEmail({
    to: contact.email,
    subject: `${agentName} invited you to your Client Portal / Te invitó a tu Portal de Cliente`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 32px 16px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <div style="font-size: 40px; margin-bottom: 8px;">🏠</div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Your Client Portal</h1>
            <p style="color: #93c5fd; margin: 6px 0 0; font-size: 14px;">Track your real estate journey in real time</p>
          </div>

          <p style="color: #111827; font-size: 16px; font-weight: 600;">Hi ${contact.firstName},</p>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            ${agentName} has set up a personal client portal just for you. Inside, you can:
          </p>
          <ul style="color: #374151; font-size: 14px; line-height: 2; padding-left: 20px;">
            <li>📊 Track your deal progress step by step</li>
            <li>🏡 View and save your favorite properties</li>
            <li>📄 Access all your transaction documents</li>
            <li>💬 Message your agent directly (AI responds 24/7)</li>
            <li>📅 See upcoming appointments</li>
          </ul>
          <p style="color: #6b7280; font-size: 13px; font-style: italic; line-height: 1.6; margin-top: 16px;">
            ${agentName} ha configurado un portal personal solo para usted. Puede rastrear su progreso, ver propiedades, acceder a documentos y comunicarse con su agente.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}"
               style="background: linear-gradient(135deg, #1e40af, #2563eb); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
              Access My Portal →
            </a>
          </div>

          <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; margin-top: 24px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
              🔐 This is your personal, secure link. Do not share it with others.<br/>
              Este es su enlace personal y seguro. No lo comparta con otros.
            </p>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
          Powered by Lofty CRM · ${agentName}
        </p>
      </div>
    `,
  })

  await prisma.activity.create({
    data: {
      type: "PORTAL_INVITE",
      title: "Client portal invitation sent",
      description: `Portal invite email sent to ${contact.email}`,
      contactId: params.id,
      userId: session.user!.id as string,
    },
  })

  return NextResponse.json({ success: true, portalUrl })
}
