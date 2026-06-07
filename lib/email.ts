import { Resend } from "resend"
import nodemailer from "nodemailer"

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
}

// ─── Resend (primary) ─────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function sendViaResend(opts: EmailOptions): Promise<boolean> {
  if (!resend) return false
  const { error } = await resend.emails.send({
    from: opts.from || process.env.RESEND_FROM || "Catherine <noreply@loftycrm.com>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    headers: opts.headers,
  })
  if (error) throw new Error(error.message)
  return true
}

// ─── Nodemailer (fallback) ────────────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!_transporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return _transporter
}

async function sendViaNodemailer(opts: EmailOptions): Promise<boolean> {
  const t = getTransporter()
  if (!t) return false
  await t.sendMail({
    from: opts.from || process.env.SMTP_FROM || "CRM <noreply@loftycrm.com>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    headers: opts.headers,
  })
  return true
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  try {
    if (await sendViaResend(opts)) return true
    if (await sendViaNodemailer(opts)) return true
    console.log("[EMAIL MOCK] To:", opts.to, "Subject:", opts.subject)
    return true
  } catch (e) {
    console.error("sendEmail error:", e)
    throw e
  }
}

// Sends emails in batches, pausing between batches to respect rate limits.
// Returns counts of sent/failed.
export async function sendBulkEmail(
  recipients: { to: string; vars?: Record<string, string> }[],
  opts: Omit<EmailOptions, "to">,
  batchSize = 50,
  delayMs = 1000
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    await Promise.allSettled(
      batch.map(async ({ to, vars }) => {
        try {
          let html = opts.html
          let subject = opts.subject
          if (vars) {
            for (const [k, v] of Object.entries(vars)) {
              html = html.replaceAll(`{${k}}`, v)
              subject = subject.replaceAll(`{${k}}`, v)
            }
          }
          await sendEmail({ ...opts, to, html, subject })
          sent++
        } catch {
          failed++
        }
      })
    )
    // Rate limiting pause between batches
    if (i + batchSize < recipients.length) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return { sent, failed }
}

// ─── Template builders ────────────────────────────────────────────────────────
export function wrapEmail(body: string, opts: {
  agentName: string
  unsubscribeUrl?: string
  preheader?: string
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${opts.preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
    <span style="color:white;font-size:20px;font-weight:bold">${opts.agentName}</span>
    <p style="color:#c4b5fd;font-size:13px;margin:4px 0 0">Bienes Raíces</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0;text-align:center">
    <p style="color:#9CA3AF;font-size:12px;margin:0">
      © ${new Date().getFullYear()} ${opts.agentName} · Real Estate
    </p>
    ${opts.unsubscribeUrl ? `<p style="margin:8px 0 0"><a href="${opts.unsubscribeUrl}" style="color:#9CA3AF;font-size:11px">Cancelar suscripción / Unsubscribe</a></p>` : ""}
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildPropertyEmail(contact: { firstName: string }, property: any, agentName: string, agentPhone: string): string {
  return wrapEmail(`
<h2 style="color:#111827;margin:0 0 12px">Hola ${contact.firstName}! 🏠</h2>
<p style="color:#374151">Encontré una propiedad que creo te va a encantar:</p>
${property.images && JSON.parse(property.images)[0]
  ? `<img src="${JSON.parse(property.images)[0]}" alt="Property" style="width:100%;border-radius:12px;margin:16px 0"/>`
  : ""}
<div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:16px 0;border:1px solid #E5E7EB">
  <p style="font-size:22px;font-weight:bold;color:#059669;margin:0">$${property.price.toLocaleString()}</p>
  <p style="font-weight:bold;color:#111827;margin:4px 0">${property.address}</p>
  <p style="color:#6B7280;font-size:14px;margin:4px 0">${property.city}, ${property.state}</p>
  <p style="color:#6B7280;font-size:14px;margin:8px 0">
    ${property.bedrooms ? `🛏 ${property.bedrooms} hab &nbsp;` : ""}
    ${property.bathrooms ? `🚿 ${property.bathrooms} baños &nbsp;` : ""}
    ${property.sqft ? `📐 ${property.sqft.toLocaleString()} pie²` : ""}
  </p>
</div>
<a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:16px 0">Agendar una visita →</a>
<p style="color:#6B7280;font-size:14px">📞 ${agentPhone}</p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0"/>
<p style="color:#9CA3AF;font-size:12px">Hi ${contact.firstName}! I found a property match for you. Call me at ${agentPhone} or click above to schedule a showing.</p>
`, { agentName })
}

export function buildWelcomeEmail(contact: { firstName: string }, agentName: string, agentPhone: string, bookUrl?: string): string {
  return wrapEmail(`
<h2 style="color:#111827;margin:0 0 8px">¡Bienvenido(a), ${contact.firstName}! 🏡</h2>
<p style="color:#374151">Soy ${agentName} y estoy aquí para ayudarte a encontrar tu hogar ideal. Tu búsqueda comienza ahora.</p>
<div style="margin:24px 0;space-y:12px">
  ${[
    ["1", "Busca propiedades", "Explora nuestro catálogo de propiedades en vivo"],
    ["2", "Recibe alertas", "Te notificaremos cuando aparezcan nuevas propiedades que coincidan con tus criterios"],
    ["3", "Agenda una consulta", "Habla con ${agentName} para una asesoría gratuita"],
    ["4", "Cierra tu casa", "Te guío desde la oferta hasta las llaves en la mano"],
  ].map(([n, title, desc]) => `
    <div style="display:flex;gap:12px;margin:12px 0;align-items:flex-start">
      <div style="min-width:28px;height:28px;background:#4F46E5;border-radius:50%;color:white;font-weight:bold;font-size:13px;display:flex;align-items:center;justify-content:center">${n}</div>
      <div><strong style="color:#111827">${title}</strong><br/><span style="color:#6B7280;font-size:14px">${desc.replace("${agentName}", agentName)}</span></div>
    </div>`).join("")}
</div>
${bookUrl ? `<a href="${bookUrl}" style="background:#4F46E5;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Agenda tu consulta gratuita →</a>` : ""}
<p style="color:#6B7280;margin:20px 0 0;font-size:14px">📞 ${agentPhone}</p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0"/>
<p style="color:#9CA3AF;font-size:12px">Hi ${contact.firstName}! Welcome — I'm ${agentName}, your personal real estate agent. I'll help you find your dream home. Contact me anytime at ${agentPhone}.</p>
`, { agentName, preheader: `¡Bienvenido(a)! Tu búsqueda de propiedades comienza ahora.` })
}
