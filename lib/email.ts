import { Resend } from "resend"
import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string | string[]
  headers?: Record<string, string>
}

// ─── Resend (primary) ─────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function sendViaResend(opts: EmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not set — skipping Resend")
    return false
  }
  const from = opts.from || process.env.RESEND_FROM
  if (!from) {
    console.error("[EMAIL] RESEND_FROM env var is not set. Set it to e.g. 'Sofia <sofia@catherinegomezrealtor.com>' in Railway.")
    throw new Error("RESEND_FROM is not configured. Add it to Railway environment variables.")
  }
  // Retry on rate-limit (429) with backoff — Resend caps API calls per second.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      headers: opts.headers,
    })
    if (!error) {
      console.log(`[EMAIL] Sent via Resend to ${opts.to} (id: ${data?.id})`)
      return true
    }
    const msg = error.message || ""
    const isRateLimit = /rate.?limit|too many|429/i.test(msg)
    if (isRateLimit && attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * attempt)) // 1s, 2s
      continue
    }
    throw new Error(`Resend error: ${msg}`)
  }
  return false
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
    from: opts.from || process.env.SMTP_FROM || "CRM <noreply@casaicrm.com>",
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

// If an inbound domain is configured, automatically set Reply-To so replies
// come back through Resend's inbound webhook instead of Catherine's inbox.
function withReplyTo(opts: EmailOptions): EmailOptions {
  if (opts.replyTo) return opts
  const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN || process.env.RESEND_INBOUND_DOMAIN
  // Catherine's real email so contacts see a professional address when replying
  const agentEmail = process.env.AGENT_REPLY_EMAIL
  if (!inboundDomain && !agentEmail) return opts
  const addrs: string[] = []
  if (agentEmail) addrs.push(agentEmail)
  if (inboundDomain) addrs.push(`reply@${inboundDomain}`)
  return { ...opts, replyTo: addrs.length === 1 ? addrs[0] : addrs }
}

export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  opts = withReplyTo(opts)

  // Create the log row FIRST so a real open-tracking pixel can be embedded,
  // tied to this exact email. When the recipient opens it, /api/email/open/:id
  // stamps openedAt — so "opened" in the CRM means ACTUALLY opened.
  let rowId: string | null = null
  try {
    const row = await prisma.email.create({
      data: {
        subject: opts.subject,
        body: opts.html.slice(0, 2000),
        fromAddress: opts.from || process.env.RESEND_FROM || "sofia@catherinegomezrealtor.com",
        toAddress: opts.to,
        direction: "OUTBOUND",
        status: "SENDING",
      },
    })
    rowId = row.id
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    opts = { ...opts, html: `${opts.html}<img src="${appUrl}/api/email/open/${rowId}" width="1" height="1" style="display:none" alt="" />` }
  } catch { /* logging must never block sending */ }

  // Track the true outcome so the CRM log reflects reality, not just attempts.
  let delivered = false
  let failReason: string | null = null
  try {
    if (await sendViaResend(opts)) {
      delivered = true
    } else if (await sendViaNodemailer(opts)) {
      delivered = true
    } else {
      // No provider actually sent it (no RESEND_API_KEY / no SMTP configured)
      failReason = "No email provider configured (Resend/SMTP)"
      console.log("[EMAIL MOCK — NOT SENT] To:", opts.to, "Subject:", opts.subject)
    }
  } catch (e: any) {
    failReason = e?.message || "send error"
    console.error("sendEmail provider error:", failReason)
  }

  // Log the ACTUAL result — only "SENT" when a provider confirmed delivery.
  // For failures, prepend the reason to the body so it's diagnosable.
  if (rowId) {
    prisma.email.update({
      where: { id: rowId },
      data: {
        status: delivered ? "SENT" : "FAILED",
        sentAt: delivered ? new Date() : null,
        ...(delivered ? {} : { body: `[SEND FAILED: ${failReason || "unknown"}]\n\n${opts.html.slice(0, 1500)}` }),
      },
    }).catch(() => {})
  } else {
    prisma.email.create({
      data: {
        subject: opts.subject,
        body: delivered ? opts.html.slice(0, 2000) : `[SEND FAILED: ${failReason || "unknown"}]\n\n${opts.html.slice(0, 1500)}`,
        fromAddress: opts.from || process.env.RESEND_FROM || "sofia@catherinegomezrealtor.com",
        toAddress: opts.to,
        direction: "OUTBOUND",
        status: delivered ? "SENT" : "FAILED",
        sentAt: delivered ? new Date() : null,
      },
    }).catch(() => {})
  }

  return delivered
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
  agentPhone?: string
  agentPhoto?: string
  agentEmail?: string
  agentWebsite?: string
  unsubscribeUrl?: string
  preheader?: string
}): string {
  const phone    = opts.agentPhone  || process.env.AGENT_PHONE  || ""
  const email    = opts.agentEmail  || process.env.AGENT_EMAIL  || "info@catherinegomezrealtor.com"
  const website  = opts.agentWebsite || process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const photo    = opts.agentPhoto  || process.env.AGENT_PHOTO_URL || ""
  const initials = opts.agentName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "CG"
  const websiteDisplay = website.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const heroImages = [
    "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=600&q=80&auto=format&fit=crop", // Miami Brickell skyline
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80&auto=format&fit=crop", // Miami condo towers
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80&auto=format&fit=crop", // luxury home pool
  ]
  // Rotate hero image based on day of month for variety
  const hero = heroImages[new Date().getDate() % heroImages.length]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
</head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Hero image -->
  <tr><td style="border-radius:16px 16px 0 0;overflow:hidden;line-height:0;padding:0">
    <img src="${hero}" alt="Miami Real Estate" width="600" style="width:100%;max-width:600px;height:200px;object-fit:cover;display:block"/>
  </td></tr>

  <!-- Hero text banner (separate row — avoids CSS position overlap in email clients) -->
  <tr><td style="background:linear-gradient(135deg,#1B1F3B,#2a3060);padding:10px 28px">
    <p style="color:rgba(255,255,255,0.6);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 2px">Catherine Gómez · Realtor</p>
    <p style="color:#C9A84C;font-size:12px;margin:0">Miami · Brickell · Doral · Coral Gables · Aventura · Homestead</p>
  </td></tr>

  <!-- Agent card -->
  <tr><td style="background:#1B1F3B;padding:20px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:56px;vertical-align:middle">
          ${photo
            ? `<img src="${photo}" alt="${opts.agentName}" width="52" height="52" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #C9A84C"/>`
            : `<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#8B6914);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;text-align:center;line-height:52px">${initials}</div>`
          }
        </td>
        <td style="padding-left:14px;vertical-align:middle">
          <p style="color:white;font-size:16px;font-weight:bold;margin:0 0 2px">${opts.agentName}</p>
          <p style="color:#C9A84C;font-size:12px;margin:0 0 4px;letter-spacing:0.5px">Licensed Real Estate Agent · Miami, FL</p>
          ${phone ? `<p style="color:#9CA3AF;font-size:12px;margin:0">📱 ${phone}</p>` : ""}
        </td>
        <td style="text-align:right;vertical-align:middle;color:#C9A84C;font-size:22px">🌴</td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:white;padding:32px 32px 28px;font-size:15px;line-height:1.7;color:#374151">
    ${body}

    <!-- Signature -->
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0 20px"/>
    <table cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;width:60px">
          ${photo
            ? `<img src="${photo}" alt="${opts.agentName}" width="52" height="52" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #C9A84C"/>`
            : `<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#8B6914);color:white;font-weight:bold;font-size:18px;text-align:center;line-height:52px">${initials}</div>`
          }
        </td>
        <td style="vertical-align:middle">
          <p style="margin:0 0 2px;font-weight:bold;font-size:14px;color:#111827">${opts.agentName}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#C9A84C;letter-spacing:0.3px">Licensed Real Estate Agent &middot; Miami, FL</p>
          <table cellpadding="0" cellspacing="0">
            ${phone ? `<tr><td style="font-size:12px;color:#6B7280;padding-bottom:2px">📞&nbsp;<a href="tel:${phone.replace(/\D/g,"")}" style="color:#374151;text-decoration:none">${phone}</a></td></tr>` : ""}
            <tr><td style="font-size:12px;color:#6B7280;padding-bottom:2px">✉️&nbsp;<a href="mailto:${email}" style="color:#374151;text-decoration:none">${email}</a></td></tr>
            <tr><td style="font-size:12px;color:#6B7280">🌐&nbsp;<a href="${website}" style="color:#4F46E5;text-decoration:none">${websiteDisplay}</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Areas served banner -->
  <tr><td style="background:#F8F4EC;padding:16px 28px;border-top:3px solid #C9A84C">
    <p style="color:#6B5B2E;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px;font-weight:600">Areas We Serve</p>
    <p style="color:#92826A;font-size:12px;margin:0">
      Brickell &nbsp;·&nbsp; Miami Beach &nbsp;·&nbsp; Doral &nbsp;·&nbsp; Coral Gables &nbsp;·&nbsp;
      Edgewater &nbsp;·&nbsp; Wynwood &nbsp;·&nbsp; Aventura &nbsp;·&nbsp; Sunny Isles &nbsp;·&nbsp; Homestead
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1B1F3B;border-radius:0 0 16px 16px;padding:18px 28px;text-align:center">
    <p style="color:#6B7280;font-size:11px;margin:0">
      © ${new Date().getFullYear()} ${opts.agentName} &nbsp;·&nbsp; <a href="mailto:${email}" style="color:#6B7280;text-decoration:none">${email}</a>
    </p>
    ${phone ? `<p style="color:#6B7280;font-size:11px;margin:4px 0 0">${phone}</p>` : ""}
    ${opts.unsubscribeUrl ? `<p style="margin:6px 0 0"><a href="${opts.unsubscribeUrl}" style="color:#4B5563;font-size:10px;text-decoration:underline">Cancelar suscripción / Unsubscribe</a></p>` : ""}
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
