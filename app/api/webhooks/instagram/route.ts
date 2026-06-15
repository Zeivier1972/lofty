export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  sendInstagramDM, sendInstagramDMWithQuickReplies, replyToComment, verifyWebhookToken,
  extractEmail, extractPhone, isOptOut, parseIntent,
} from "@/lib/instagram"
import { ingestLead } from "@/lib/lead-ingest"

const INTENT_QUICK_REPLIES = [
  { title: "🏠 Comprar para vivir", payload: "A" },
  { title: "💰 Invertir (Airbnb/renta)", payload: "B" },
  { title: "👀 Solo explorando", payload: "C" },
]

const INTENT_TAG_COLORS: Record<string, string> = {
  comprador_vivienda: "#22C55E",
  inversionista_airbnb: "#8B5CF6",
  solo_explorando: "#94A3B8",
}

// GET — Meta webhook verification handshake
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token && verifyWebhookToken(token)) {
    console.log("[INSTAGRAM] Webhook verified")
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// POST — Incoming Instagram events
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Ignore non-instagram objects
    if (body.object !== "instagram") {
      return NextResponse.json({ ok: true })
    }

    const config = await prisma.instagramBotConfig.findFirst()
    if (!config?.isEnabled) return NextResponse.json({ ok: true })

    const igCampaigns = await prisma.instagramBotCampaign.findMany({ where: { isActive: true } })

    const findCampaign = (text: string) =>
      igCampaigns.find(c => text.toLowerCase().includes(c.keyword.toLowerCase()))

    const keywords = config.triggerKeywords
      .split(",")
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean)

    const matchesKeyword = (text: string) =>
      keywords.some(k => text.toLowerCase().includes(k)) || !!findCampaign(text)

    for (const entry of body.entry || []) {
      // ── Comment event ─────────────────────────────────────────────────────
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          const val = change.value
          const commentText: string = val?.text || ""
          const igUserId: string = val?.from?.id
          const igUsername: string = val?.from?.username || ""
          const commentId: string = val?.id

          if (!igUserId || !commentId) continue
          if (!matchesKeyword(commentText)) continue

          const campaign = findCampaign(commentText)
          const greeting = campaign?.greeting || config.msgGreeting

          const existing = await prisma.instagramConversation.findUnique({ where: { igUserId } })

          if (existing && (existing.state === "COMPLETE" || existing.state === "OPTED_OUT")) {
            await prisma.instagramConversation.update({
              where: { igUserId },
              data: { state: "ASKED_OPTIN", sourceCommentId: commentId, intent: null, firstName: null, email: null, phone: null, contactId: null, campaignKeyword: campaign?.keyword || null },
            })
          } else if (!existing) {
            await prisma.instagramConversation.create({
              data: { igUserId, igUsername, state: "ASKED_OPTIN", sourceCommentId: commentId, campaignKeyword: campaign?.keyword || null },
            })
          }

          const replied = await replyToComment(commentId, greeting)
          if (!replied) await sendInstagramDM(igUserId, greeting)
        }
      }

      // ── DM event ──────────────────────────────────────────────────────────
      for (const msg of entry.messaging || []) {
        const igUserId: string = msg.sender?.id
        const text: string = msg.message?.text || ""
        const accountId = process.env.INSTAGRAM_ACCOUNT_ID

        if (!igUserId || igUserId === accountId || msg.message?.is_echo || !text) continue

        let convo = await prisma.instagramConversation.findUnique({ where: { igUserId } })

        if (!convo) {
          if (!matchesKeyword(text)) continue
          const campaign = findCampaign(text)
          convo = await prisma.instagramConversation.create({
            data: { igUserId, state: "ASKED_OPTIN", campaignKeyword: campaign?.keyword || null },
          })
          await sendInstagramDM(igUserId, campaign?.greeting || config.msgGreeting)
          continue
        }

        if (convo.state === "OPTED_OUT") continue
        if (convo.state === "COMPLETE") {
          if (!matchesKeyword(text)) continue
          const campaign = findCampaign(text)
          convo = await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "ASKED_OPTIN", intent: null, firstName: null, email: null, phone: null, contactId: null, campaignKeyword: campaign?.keyword || null },
          })
          await sendInstagramDM(igUserId, campaign?.greeting || config.msgGreeting)
          continue
        }

        if (isOptOut(text)) {
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "OPTED_OUT" },
          })
          await sendInstagramDM(igUserId, "Entendido, no te enviaremos más mensajes. ¡Que tengas un buen día! 👋")
          continue
        }

        // ── State machine ─────────────────────────────────────────────────
        if (convo.state === "ASKED_OPTIN") {
          // Any non-opt-out reply counts as a yes → qualification question
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "ASKED_INTENT" },
          })
          await sendInstagramDMWithQuickReplies(igUserId, config.msgAskIntent, INTENT_QUICK_REPLIES)

        } else if (convo.state === "ASKED_INTENT") {
          const quickReplyPayload: string = (msg.message as any)?.quick_reply?.payload || ""
          const intentFromPayload = quickReplyPayload === "A" ? "comprador_vivienda"
            : quickReplyPayload === "B" ? "inversionista_airbnb"
            : quickReplyPayload === "C" ? "solo_explorando"
            : null
          const intent = intentFromPayload || parseIntent(text)
          if (!intent) {
            await sendInstagramDMWithQuickReplies(igUserId, "Por favor elige una opción 🙂", INTENT_QUICK_REPLIES)
            continue
          }
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { intent, state: "ASKED_NAME" },
          })
          await sendInstagramDM(igUserId, config.msgAskName)

        } else if (convo.state === "ASKED_NAME") {
          const name = text.trim().split(/\s+/).slice(0, 3).join(" ")
          const nextMsg = config.msgAskEmail.replace("{name}", name.split(" ")[0])
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { firstName: name, state: "ASKED_EMAIL" },
          })
          await sendInstagramDM(igUserId, nextMsg)

        } else if (convo.state === "ASKED_EMAIL") {
          const email = extractEmail(text)
          if (!email) {
            await sendInstagramDM(igUserId, "Hmm, no encontré un email válido en tu mensaje. ¿Puedes enviarlo de nuevo? Ej: tu@email.com")
            continue
          }
          const nextMsg = config.msgAskPhone.replace("{name}", convo.firstName?.split(" ")[0] || "")
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { email, state: "ASKED_PHONE" },
          })
          await sendInstagramDM(igUserId, nextMsg)

        } else if (convo.state === "ASKED_PHONE") {
          const phone = extractPhone(text)
          if (!phone) {
            await sendInstagramDM(igUserId, "No encontré un número válido. ¿Puedes enviarlo de nuevo? Ej: +1 786 123 4567")
            continue
          }

          const nameParts = (convo.firstName || convo.igUsername || "Instagram Lead").split(/\s+/)

          // Full lead ingestion: pipeline, smart plan, scoring, welcome SMS + email,
          // AI call, and notifications — same as Facebook/website leads
          const isPreConstruction = convo.intent === "comprador_vivienda" || convo.intent === "inversionista_airbnb"
          const { contactId } = await ingestLead({
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
            email: convo.email || undefined,
            phone,
            source: "INSTAGRAM",
            campaign: isPreConstruction ? "Instagram Bot — Preconstrucción" : "Instagram Bot",
            propertyType: isPreConstruction ? "PRE_CONSTRUCTION" : undefined,
            notes: `IG: @${convo.igUsername || igUserId}${convo.intent ? ` | Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
            smsConsent: true, // they provided their number in the DM to be contacted
          })

          // Instagram-specific extras: handle + qualification tag
          await prisma.contact.update({
            where: { id: contactId },
            data: { socialInstagram: convo.igUsername || undefined },
          }).catch(() => {})

          if (convo.intent) {
            const tag = await prisma.tag.upsert({
              where: { name: convo.intent },
              update: {},
              create: { name: convo.intent, color: INTENT_TAG_COLORS[convo.intent] || "#3B82F6" },
            })
            await prisma.contactTag.upsert({
              where: { contactId_tagId: { contactId, tagId: tag.id } },
              update: {},
              create: { contactId, tagId: tag.id },
            })
          }

          await prisma.activity.create({
            data: {
              type: "NOTE",
              title: "Lead capturado via Instagram",
              description: `Instagram: @${convo.igUsername || igUserId}${convo.intent ? ` · Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
              contactId,
            },
          })

          // Mark conversation complete
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { phone, state: "COMPLETE", contactId },
          })

          // Send thank you with website link
          const thankYou = config.msgThankYou
            .replace("{name}", convo.firstName?.split(" ")[0] || "")
            .replace("{website}", config.websiteUrl || "")
          await sendInstagramDM(igUserId, thankYou)

          // Send campaign PDF if this conversation was triggered by a campaign keyword
          if (convo.campaignKeyword) {
            try {
              const campaign = await prisma.instagramBotCampaign.findUnique({
                where: { keyword: convo.campaignKeyword },
              })
              if (campaign?.pdfUrl) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
                const brochureUrl = `${appUrl}/brochure/${convo.campaignKeyword}`
                const pdfMsg = `📄 ${campaign.pdfName || "Documento exclusivo"}:\n${brochureUrl}`
                await sendInstagramDM(igUserId, pdfMsg)
                await prisma.instagramBotCampaign.update({
                  where: { keyword: convo.campaignKeyword },
                  data: { leads: { increment: 1 } },
                })
              }
            } catch (e) {
              console.error("[IG bot] campaign PDF send error:", e)
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[INSTAGRAM] Webhook error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
