export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// Protected by the same shared secret as the bulk import endpoint.
const IMPORT_SECRET = "PmjAPKD8WVu3aQF9GFbixYfFUsXMnqd_COujkwE3Q7k"

// Pipeline stage names that should receive welcome emails.
const TARGET_STAGES = [
  "contacted 1",
  "contacted 2",
  "contacted 3",
  "contacted 4",
  "drip campaign",
  "warm",
  "hot",
]

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || body.secret !== IMPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // dryRun=true returns who would be emailed without actually sending
  const dryRun = body.dryRun === true

  try {
    const config = await prisma.aIConfig.findFirst()
    const agentName = config?.realtorName || "Catherine Gómez"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"

    // Find contacts already invited (Activity type PORTAL_INVITE)
    const alreadyInvited = await prisma.activity.findMany({
      where: { type: "PORTAL_INVITE" },
      select: { contactId: true },
    })
    const invitedSet = new Set(alreadyInvited.map(a => a.contactId).filter(Boolean) as string[])

    // Find all pipeline leads in target stages with emails
    const pipelineLeads = await prisma.pipelineLead.findMany({
      where: {
        stage: {
          name: { in: TARGET_STAGES.map(s => s), mode: "insensitive" },
        },
      },
      select: {
        contactId: true,
        stage: { select: { name: true } },
        contact: {
          select: {
            id: true,
            firstName: true,
            email: true,
            doNotEmail: true,
            portalAccess: { select: { token: true } },
          },
        },
      },
    })

    // Deduplicate by contactId (contact may be in multiple stages)
    const seen = new Set<string>()
    const eligible: typeof pipelineLeads = []
    for (const pl of pipelineLeads) {
      if (seen.has(pl.contactId)) continue
      seen.add(pl.contactId)
      const c = pl.contact
      if (!c.email || c.doNotEmail) continue
      if (invitedSet.has(c.id)) continue
      eligible.push(pl)
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        wouldSend: eligible.length,
        alreadySent: invitedSet.size,
        sample: eligible.slice(0, 10).map(pl => ({
          name: `${pl.contact.firstName}`,
          email: pl.contact.email,
          stage: pl.stage.name,
        })),
      })
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const pl of eligible) {
      const contact = pl.contact
      try {
        // Get or create portal access
        let token = contact.portalAccess?.token
        if (!token) {
          const pa = await prisma.clientPortalAccess.create({ data: { contactId: contact.id } }).catch(() => null)
          token = pa?.token
        }
        if (!token) { failed++; continue }

        const portalUrl = `${appUrl}/portal/login?token=${token}`

        await sendEmail({
          to: contact.email!,
          subject: `${agentName} te invitó a tu Portal Personal 🏠`,
          html: buildWelcomeEmail({ firstName: contact.firstName, agentName, portalUrl }),
          text: `¡Hola ${contact.firstName}! ${agentName} te creó un portal personal de bienes raíces. Entra aquí: ${portalUrl}`,
        })

        // Log so we don't resend
        await prisma.activity.create({
          data: {
            type: "PORTAL_INVITE",
            title: "Welcome email sent",
            description: `Portal invite sent to ${contact.email}`,
            contactId: contact.id,
          },
        }).catch(() => {})

        sent++
      } catch (e: any) {
        failed++
        errors.push(`${contact.firstName} <${contact.email}>: ${e?.message?.slice(0, 80)}`)
      }

      // Small delay to avoid hitting Resend rate limits (100 emails/sec)
      if (sent % 50 === 0) await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({
      sent,
      failed,
      skipped: invitedSet.size,
      totalEligible: eligible.length,
      errors: errors.slice(0, 20),
    })
  } catch (e: any) {
    console.error("[send-welcome-emails]", e)
    return NextResponse.json({ error: "Failed", detail: e?.message }, { status: 500 })
  }
}

function buildWelcomeEmail({ firstName, agentName, portalUrl }: { firstName: string; agentName: string; portalUrl: string }): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 32px 16px;">
      <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
          <div style="font-size: 40px; margin-bottom: 8px;">🏠</div>
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Tu Portal de Cliente</h1>
          <p style="color: #93c5fd; margin: 6px 0 0; font-size: 14px;">Sigue tu proceso de compra en tiempo real</p>
        </div>

        <p style="color: #111827; font-size: 16px; font-weight: 600;">¡Hola ${firstName}!</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          ${agentName} te creó un portal personal exclusivo. Desde ahí puedes:
        </p>
        <ul style="color: #374151; font-size: 14px; line-height: 2.2; padding-left: 20px;">
          <li>📊 Ver el progreso de tu transacción paso a paso</li>
          <li>🏡 Explorar y guardar tus propiedades favoritas</li>
          <li>📄 Acceder a todos tus documentos de la transacción</li>
          <li>💬 Enviarle mensajes a ${agentName} directamente (Sofía IA responde 24/7)</li>
          <li>📅 Consultar tus próximas citas</li>
        </ul>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${portalUrl}"
             style="background: linear-gradient(135deg, #1e40af, #2563eb); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            Entrar a mi portal →
          </a>
        </div>

        <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; margin-top: 8px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
            🔐 Este es tu enlace personal y seguro — no lo compartas con nadie.<br/>
            <span style="color: #9ca3af;">This is your personal secure link. Do not share it with others.</span>
          </p>
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        ${agentName} · Catherine Gomez Realtor · Miami
      </p>
    </div>
  `
}
