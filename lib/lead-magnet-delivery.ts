/**
 * Lead Magnet Delivery
 *
 * When someone sends a trigger keyword (INVERSIÓN, CASA, GRATIS, LISTO),
 * this module delivers the right PDF/link via every available channel:
 * SMS, email, Instagram DM, and Facebook DM.
 */

import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail } from "@/lib/email"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Detect keyword in a message (looks up DB dynamically) ───────────────────

export async function detectKeyword(message: string): Promise<string | null> {
  const upper = message.trim().toUpperCase()
  // Only match messages that are exactly a keyword or very short (comment replies)
  if (upper.length > 50) return null

  const magnets = await prisma.leadMagnet.findMany({ select: { keyword: true } })
  for (const { keyword } of magnets) {
    if (upper === keyword || upper.includes(keyword)) return keyword
  }
  // LISTO is always a booking keyword even without a stored guide
  if (upper === "LISTO" || upper.includes("LISTO")) return "LISTO"
  return null
}

// ─── Get lead magnet URL from DB ──────────────────────────────────────────────

export async function getLeadMagnetUrl(keyword: string): Promise<string | null> {
  if (keyword === "LISTO") {
    const aiConfig = await prisma.aIConfig.findFirst()
    return (aiConfig as any)?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL}/book`
  }
  const magnet = await prisma.leadMagnet.findUnique({ where: { keyword } })
  return magnet?.guideUrl ?? null
}

// ─── Build the SMS/DM message for delivery ───────────────────────────────────

async function buildDeliveryMessage(keyword: string, firstName: string, url: string): Promise<string> {
  if (keyword === "LISTO") {
    return `Hola ${firstName}! Soy Sofía de Catherine Gomez Realtor 🏠 Aquí está el link para agendar tu consulta gratuita con Catherine: ${url}`
  }
  const magnet = await prisma.leadMagnet.findUnique({ where: { keyword } })
  const title = magnet?.title ?? "tu guía gratuita"
  return `Hola ${firstName}! Soy Sofía de Catherine Gomez Realtor 🏠 Aquí está tu guía "${title}": ${url} — ¡Cualquier pregunta, escríbenos!`
}

// ─── Core delivery function ───────────────────────────────────────────────────

interface DeliveryContact {
  id?: string
  firstName: string
  phone?: string | null
  email?: string | null
  facebookPsid?: string | null
  instagramIgsid?: string | null
}

export async function deliverLeadMagnet(
  keyword: string,
  contact: DeliveryContact,
  channels: { sms?: boolean; email?: boolean; fbDm?: boolean; igDm?: boolean } = {}
): Promise<{ delivered: string[]; failed: string[] }> {
  const url = await getLeadMagnetUrl(keyword)
  if (!url) return { delivered: [], failed: [] }

  const message = await buildDeliveryMessage(keyword, contact.firstName, url)
  const delivered: string[] = []
  const failed: string[] = []

  const {
    sms = true,
    email = true,
    fbDm = true,
    igDm = true,
  } = channels

  // ── SMS ───────────────────────────────────────────────────────────────────
  if (sms && contact.phone) {
    try {
      const phone = contact.phone.startsWith("+") ? contact.phone : `+1${contact.phone.replace(/\D/g, "")}`
      await sendSMS(phone, message)
      delivered.push("SMS")
    } catch (e) {
      console.error("[lead-magnet] SMS delivery failed:", e)
      failed.push("SMS")
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (email && contact.email) {
    try {
      const magnet = keyword === "LISTO" ? null : await prisma.leadMagnet.findUnique({ where: { keyword } })
      const emailTitle = magnet?.title ?? "Tu consulta gratuita"
      const emailDesc = magnet?.description ?? "Agenda tu consulta con Catherine Gomez Realtor"
      await sendEmail({
        to: contact.email,
        subject: `${emailTitle} — Catherine Gomez Realtor 🏠`,
        html: buildEmailHtml(contact.firstName, emailTitle, emailDesc, url, keyword === "LISTO"),
        text: message,
      })
      delivered.push("EMAIL")
    } catch (e) {
      console.error("[lead-magnet] Email delivery failed:", e)
      failed.push("EMAIL")
    }
  }

  // ── Facebook DM ───────────────────────────────────────────────────────────
  if (fbDm && contact.facebookPsid) {
    try {
      await sendFacebookDM(contact.facebookPsid, message)
      delivered.push("FACEBOOK_DM")
    } catch (e) {
      console.error("[lead-magnet] Facebook DM delivery failed:", e)
      failed.push("FACEBOOK_DM")
    }
  }

  // ── Instagram DM ─────────────────────────────────────────────────────────
  if (igDm && contact.instagramIgsid) {
    try {
      await sendInstagramDM(contact.instagramIgsid, message)
      delivered.push("INSTAGRAM_DM")
    } catch (e) {
      console.error("[lead-magnet] Instagram DM delivery failed:", e)
      failed.push("INSTAGRAM_DM")
    }
  }

  // ── Log delivery in CRM ───────────────────────────────────────────────────
  if (delivered.length > 0 && contact.id) {
    try {
      const magnetTitle = keyword === "LISTO"
        ? "Consulta gratuita"
        : (await prisma.leadMagnet.findUnique({ where: { keyword }, select: { title: true } }))?.title ?? keyword
      await prisma.leadMagnetDelivery.create({
        data: {
          keyword,
          channel: delivered.join(","),
          contactId: contact.id,
        },
      })
      await prisma.activity.create({
        data: {
          type: "SMS",
          title: `Lead magnet enviado: ${magnetTitle}`,
          description: `Keyword: ${keyword} · Canales: ${delivered.join(", ")} · URL: ${url}`,
          contactId: contact.id,
        },
      })
    } catch (e) {
      console.error("[lead-magnet] CRM log failed:", e)
    }
  }

  console.log(`[lead-magnet] Keyword=${keyword} contact=${contact.firstName} delivered=${delivered.join(",")} failed=${failed.join(",")}`)
  return { delivered, failed }
}

// ─── Facebook DM via Messenger API ───────────────────────────────────────────

async function sendFacebookDM(psid: string, message: string): Promise<void> {
  const account = await prisma.socialAccount.findFirst({
    where: { platform: "FACEBOOK", isConnected: true },
  })
  if (!account?.accessToken) throw new Error("No Facebook account connected")

  const res = await fetch("https://graph.facebook.com/v19.0/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text: message },
      access_token: account.accessToken,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Facebook DM: ${data.error.message}`)
}

// ─── Instagram DM via Instagram Messaging API ─────────────────────────────────

async function sendInstagramDM(igsid: string, message: string): Promise<void> {
  const account = await prisma.socialAccount.findFirst({
    where: { platform: "INSTAGRAM", isConnected: true },
  })
  if (!account?.accessToken || !account.pageId) throw new Error("No Instagram account connected")

  const res = await fetch(`https://graph.facebook.com/v19.0/${account.pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text: message },
      access_token: account.accessToken,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Instagram DM: ${data.error.message}`)
}

// ─── Branded email HTML ───────────────────────────────────────────────────────

function buildEmailHtml(
  firstName: string,
  title: string,
  description: string,
  url: string,
  isBooking: boolean
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const buttonLabel = isBooking ? "Agendar mi consulta gratuita →" : "Ver mi guía gratuita →"

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f7f4;font-family:Georgia,serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <!-- Header -->
    <div style="background:#1a1a2e;padding:32px 40px;text-align:center">
      <p style="color:#c9a84c;font-size:13px;letter-spacing:3px;margin:0 0 8px;font-family:Arial,sans-serif;text-transform:uppercase">Catherine Gomez Realtor</p>
      <p style="color:#ffffff;font-size:12px;margin:0;font-family:Arial,sans-serif">Miami · South Florida · Orlando</p>
    </div>

    <!-- Body -->
    <div style="padding:40px">
      <p style="color:#333;font-size:16px;margin:0 0 24px">Hola ${firstName},</p>
      <p style="color:#333;font-size:16px;margin:0 0 16px">Gracias por tu interés. Aquí está lo que te prometí:</p>

      <div style="background:#f8f4ee;border-left:4px solid #c9a84c;padding:20px 24px;margin:24px 0;border-radius:4px">
        <p style="color:#c9a84c;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;font-family:Arial,sans-serif">Tu recurso gratuito</p>
        <p style="color:#1a1a2e;font-size:20px;font-weight:bold;margin:0 0 8px">${title}</p>
        <p style="color:#666;font-size:14px;margin:0;font-family:Arial,sans-serif">${description}</p>
      </div>

      <div style="text-align:center;margin:32px 0">
        <a href="${url}" style="display:inline-block;background:#c9a84c;color:#ffffff;padding:16px 32px;border-radius:4px;text-decoration:none;font-size:15px;font-weight:bold;font-family:Arial,sans-serif">
          ${buttonLabel}
        </a>
      </div>

      <p style="color:#555;font-size:14px;line-height:1.7;font-family:Arial,sans-serif">
        Si tienes alguna pregunta sobre el mercado de Miami, estoy aquí para ayudarte.
        Puedes responder a este email o llamarme directamente al
        <strong style="color:#1a1a2e">(305) 283-0872</strong>.
      </p>

      <p style="color:#555;font-size:14px;font-family:Arial,sans-serif;margin-top:24px">
        Con cariño,<br>
        <strong style="color:#1a1a2e">Catherine Gomez</strong><br>
        <span style="color:#c9a84c">Realtor · South Florida</span><br>
        (305) 283-0872 · info@catherinegomezrealtor.com
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f0ece4;padding:20px 40px;text-align:center">
      <p style="color:#999;font-size:11px;margin:0;font-family:Arial,sans-serif">
        Catherine Gomez Realtor · Miami, FL ·
        <a href="${appUrl}" style="color:#c9a84c;text-decoration:none">catherinegomezrealtor.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
