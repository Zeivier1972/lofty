import { prisma } from "@/lib/prisma"
import { sendBulkEmail } from "@/lib/email"

// Base URL for portal links. Force the reliable `www` host — the naked apex
// domain intermittently resolves off-Railway and 404s.
function portalBase(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
  return raw.replace("://catherinegomezrealtor.com", "://www.catherinegomezrealtor.com")
}

function inviteHtml(agentName: string): string {
  // {first_name} and {portal_url} are substituted per-recipient by sendBulkEmail.
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 32px 16px;">
      <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
          <div style="font-size: 40px; margin-bottom: 8px;">🏠</div>
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Tu Portal de Cliente</h1>
          <p style="color: #93c5fd; margin: 6px 0 0; font-size: 14px;">Sigue tu proceso en tiempo real / Track your journey in real time</p>
        </div>
        <p style="color: #111827; font-size: 16px; font-weight: 600;">¡Hola {first_name}!</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          ${agentName} te creó un portal personal exclusivo. Desde ahí puedes:
        </p>
        <ul style="color: #374151; font-size: 14px; line-height: 2.2; padding-left: 20px;">
          <li>📊 Ver el progreso de tu proceso paso a paso</li>
          <li>🏡 Explorar y guardar tus propiedades favoritas</li>
          <li>📄 Acceder a todos tus documentos</li>
          <li>💬 Enviarle mensajes a ${agentName} directamente</li>
          <li>📅 Consultar tus próximas citas</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{portal_url}"
             style="background: linear-gradient(135deg, #1e40af, #2563eb); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            Entrar a mi portal → / Enter my portal →
          </a>
        </div>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; margin-top: 8px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
            🔐 Este es tu enlace personal y seguro — no lo compartas.<br/>
            <span style="color: #9ca3af;">This is your personal secure link. Do not share it.</span>
          </p>
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        ${agentName} · Catherine Gomez Realtor · Miami
      </p>
    </div>
  `
}

// Send a personalized client-portal invite (one-click magic link) to each of the
// given contacts. Skips contacts with no email or opted out. Shared by the
// Contacts "Invitar al Portal" button and Aria's send_portal_invites tool.
export async function sendPortalInvites(
  contactIds: string[],
  agentUserId?: string,
): Promise<{ sent: number; failed: number; skipped: number; total: number }> {
  if (!contactIds?.length) return { sent: 0, failed: 0, skipped: 0, total: 0 }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, email: { not: null }, doNotEmail: false },
    select: { id: true, firstName: true, email: true },
  })
  const skipped = contactIds.length - contacts.length
  if (!contacts.length) return { sent: 0, failed: 0, skipped, total: 0 }

  const config = await prisma.aIConfig.findFirst()
  const agentName = config?.realtorName || "Catherine"
  const base = portalBase()

  const recipients: { to: string; vars: Record<string, string> }[] = []
  for (const c of contacts) {
    const access = await prisma.clientPortalAccess.upsert({
      where: { contactId: c.id },
      create: { contactId: c.id },
      update: {},
      select: { token: true },
    })
    recipients.push({
      to: c.email!,
      vars: { first_name: c.firstName || "", portal_url: `${base}/portal/login?token=${access.token}` },
    })
  }

  const { sent, failed } = await sendBulkEmail(
    recipients,
    {
      subject: `{first_name}, tu portal de cliente ya está listo`,
      html: inviteHtml(agentName),
      transactional: true,
      replyTo: process.env.AGENT_REPLY_EMAIL || undefined,
    },
    50,
    1000,
  )

  await prisma.activity.createMany({
    data: contacts.map(c => ({
      type: "PORTAL_INVITE",
      title: "Client portal invitation sent (bulk)",
      description: `Bulk portal invite emailed to ${c.email}`,
      contactId: c.id,
      userId: agentUserId,
    })),
    skipDuplicates: true,
  })

  return { sent, failed, skipped, total: contacts.length }
}
