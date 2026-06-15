export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getFacebookUserProfile,
  getFacebookLeadData,
  sendFacebookMessage,
  privateReplyToComment,
  postPublicCommentReply,
  extractEmail,
  extractPhone,
  isOptOut,
  parseIntent,
} from "@/lib/facebook"
import { ingestLead } from "@/lib/lead-ingest"

const INTENT_TAG_COLORS: Record<string, string> = {
  comprador_vivienda: "#22C55E",
  inversionista: "#8B5CF6",
  explorando: "#94A3B8",
}

// GET — Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const verifyToken = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const expectedToken = process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN
  if (mode === "subscribe" && verifyToken === expectedToken) {
    return new Response(challenge || "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST — Receive Messenger messages, Lead Ad submissions, and page comment events
export async function POST(req: Request) {
  const body = await req.json()

  if (body.object !== "page") return NextResponse.json({ ok: true })

  // Load bot config once
  const botConfig = await prisma.facebookBotConfig.findFirst()

  for (const entry of body.entry || []) {
    const pageId = entry.id as string

    // ── changes: leadgen + feed (page comments) ───────────────────────────────
    for (const change of entry.changes || []) {

      // ── Lead Ad form submissions ─────────────────────────────────────────────
      if (change.field === "leadgen") {
        const { leadgen_id, campaign_name, ad_name } = change.value || {}
        if (!leadgen_id) continue

        try {
          const fields = await getFacebookLeadData(leadgen_id)
          if (!fields) continue

          const fullName = fields["full_name"] || fields["name"] || ""
          const nameParts = fullName.trim().split(" ")
          const firstName = fields["first_name"] || nameParts[0] || "Facebook"
          const lastName = fields["last_name"] || nameParts.slice(1).join(" ") || undefined

          const email = fields["email"] || fields["email_address"] || undefined
          const phone = fields["phone_number"] || fields["phone"] || undefined

          const budgetRaw = fields["budget"] || fields["budget_range"] || fields["max_budget"] || fields["price_range"]
          const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, "")) || undefined : undefined

          const location =
            fields["city"] || fields["zip_code"] || fields["location"] ||
            fields["area_of_interest"] || fields["interested_area"] ||
            fields["neighborhood"] || fields["area"] || fields["zone"] || undefined

          const bedroomsRaw = fields["bedrooms"] || fields["num_bedrooms"] || fields["bedroom_count"] || fields["cuartos"]
          const bedroomsMin = bedroomsRaw ? parseInt(bedroomsRaw) || undefined : undefined

          const propertyType = fields["property_type"] || fields["home_type"] || fields["type_of_property"] || fields["tipo"] || undefined

          const notes = [
            fields["timeline"] ? `Timeline: ${fields["timeline"]}` : "",
            fields["when_to_buy"] ? `Cuándo comprar: ${fields["when_to_buy"]}` : "",
            fields["pre_approved"] ? `Pre-aprobado: ${fields["pre_approved"]}` : "",
            fields["message"] || fields["comments"] || fields["notes"] || "",
          ].filter(Boolean).join(" | ") || undefined

          await ingestLead({
            firstName,
            lastName,
            email,
            phone,
            source: "FACEBOOK",
            campaign: campaign_name || ad_name || undefined,
            budget,
            location,
            bedroomsMin,
            propertyType,
            notes,
            facebookLeadId: leadgen_id,
            smsConsent: !!phone,
          })
        } catch (e) {
          console.error("[FB webhook leadgen]", e)
        }
        continue
      }

      // ── Feed (page post comments) ────────────────────────────────────────────
      if (change.field === "feed") {
        const val = change.value || {}
        if (val.item !== "comment" || val.verb !== "add") continue

        const commentId: string = val.comment_id || val.id
        const commentText: string = val.message || ""
        const commenterId: string = val.from?.id

        if (!commentId || !commenterId || !commentText) continue
        if (!botConfig?.isEnabled) continue

        // Check campaign keywords first (higher priority), then general keywords
        const campaigns = await prisma.facebookBotCampaign.findMany({ where: { isActive: true } })
        const matchedCampaign = campaigns.find(c =>
          commentText.toLowerCase().includes(c.keyword.toLowerCase())
        )

        const generalKeywords = botConfig.triggerKeywords
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean)
        const matchesGeneral = generalKeywords.some(k => commentText.toLowerCase().includes(k))

        if (!matchedCampaign && !matchesGeneral) continue

        const greeting = matchedCampaign?.greeting || botConfig.msgGreeting

        try {
          const existing = await prisma.facebookBotConversation.findUnique({
            where: { psid: commenterId },
          })

          if (existing && (existing.state === "COMPLETE" || existing.state === "OPTED_OUT")) {
            await prisma.facebookBotConversation.update({
              where: { psid: commenterId },
              data: {
                state: "ASKED_OPTIN",
                sourceCommentId: commentId,
                intent: null,
                firstName: null,
                email: null,
                phone: null,
                contactId: null,
                campaignKeyword: matchedCampaign?.keyword || null,
                pageId,
              },
            })
          } else if (!existing) {
            await prisma.facebookBotConversation.create({
              data: {
                psid: commenterId,
                pageId,
                state: "ASKED_OPTIN",
                sourceCommentId: commentId,
                campaignKeyword: matchedCampaign?.keyword || null,
              },
            })
          }

          const privateSent = await privateReplyToComment(commentId, greeting)
          if (!privateSent) {
            await sendFacebookMessage(commenterId, greeting)
          }

          await postPublicCommentReply(commentId, "¡Hola! Te enviamos info por mensaje privado 📩")
        } catch (e) {
          console.error("[FB webhook feed comment]", e)
        }
        continue
      }
    }

    // ── Messenger DMs ─────────────────────────────────────────────────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue

      const psid = event.sender.id as string
      const text = (event.message.text as string) || ""
      const fbMid = event.message.mid as string | undefined

      if (!text) continue

      // Check if this PSID has an active bot conversation
      const convo = await prisma.facebookBotConversation.findUnique({ where: { psid } })

      if (botConfig?.isEnabled && convo) {
        // ── Bot conversation state machine ──────────────────────────────────
        await prisma.facebookMessage.create({
          data: { psid, pageId, body: text, direction: "INBOUND", status: "RECEIVED", messageId: fbMid, contactId: convo.contactId || undefined },
        }).catch(() => {})

        if (convo.state === "OPTED_OUT") continue

        if (convo.state === "COMPLETE") {
          const keywords = botConfig.triggerKeywords
            .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
          const matchesKeyword = (t: string) => keywords.some(k => t.toLowerCase().includes(k))
          if (!matchesKeyword(text)) continue
          // Re-start conversation
          await prisma.facebookBotConversation.update({
            where: { psid },
            data: { state: "ASKED_OPTIN", intent: null, firstName: null, email: null, phone: null, contactId: null },
          })
          await sendFacebookMessage(psid, botConfig.msgGreeting)
          continue
        }

        if (isOptOut(text)) {
          await prisma.facebookBotConversation.update({ where: { psid }, data: { state: "OPTED_OUT" } })
          await sendFacebookMessage(psid, "Entendido, no te enviaremos más mensajes. ¡Que tengas un buen día! 👋")
          continue
        }

        if (convo.state === "ASKED_OPTIN") {
          await prisma.facebookBotConversation.update({ where: { psid }, data: { state: "ASKED_INTENT" } })
          await sendFacebookMessage(psid, botConfig.msgAskIntent)

        } else if (convo.state === "ASKED_INTENT") {
          const intent = parseIntent(text)
          if (!intent) {
            await sendFacebookMessage(psid, "Por favor responde con A, B o C 🙂")
            continue
          }
          await prisma.facebookBotConversation.update({ where: { psid }, data: { intent, state: "ASKED_NAME" } })
          await sendFacebookMessage(psid, botConfig.msgAskName)

        } else if (convo.state === "ASKED_NAME") {
          const name = text.trim().split(/\s+/).slice(0, 3).join(" ")
          const nextMsg = botConfig.msgAskEmail.replace("{name}", name.split(" ")[0])
          await prisma.facebookBotConversation.update({ where: { psid }, data: { firstName: name, state: "ASKED_EMAIL" } })
          await sendFacebookMessage(psid, nextMsg)

        } else if (convo.state === "ASKED_EMAIL") {
          const email = extractEmail(text)
          if (!email) {
            await sendFacebookMessage(psid, "Hmm, no encontré un email válido. ¿Puedes enviarlo de nuevo? Ej: tu@email.com")
            continue
          }
          const nextMsg = botConfig.msgAskPhone.replace("{name}", convo.firstName?.split(" ")[0] || "")
          await prisma.facebookBotConversation.update({ where: { psid }, data: { email, state: "ASKED_PHONE" } })
          await sendFacebookMessage(psid, nextMsg)

        } else if (convo.state === "ASKED_PHONE") {
          const phone = extractPhone(text)
          if (!phone) {
            await sendFacebookMessage(psid, "No encontré un número válido. ¿Puedes enviarlo de nuevo? Ej: +1 786 123 4567")
            continue
          }

          const nameParts = (convo.firstName || "Facebook Lead").split(/\s+/)

          // Ingest the lead
          const { contactId } = await ingestLead({
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
            email: convo.email || undefined,
            phone,
            source: "FACEBOOK",
            campaign: convo.intent ? `Facebook Bot — ${convo.intent.replace(/_/g, " ")}` : "Facebook Bot",
            notes: `FB Comment Bot · PSID: ${psid}${convo.intent ? ` | Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
            smsConsent: true,
          })

          // Intent tag
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
            }).catch(() => {})
          }

          await prisma.activity.create({
            data: {
              type: "NOTE",
              title: "Lead capturado via Facebook Comment Bot",
              description: `Facebook PSID: ${psid}${convo.intent ? ` · Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
              contactId,
            },
          }).catch(() => {})

          // Mark conversation complete
          await prisma.facebookBotConversation.update({
            where: { psid },
            data: { phone, state: "COMPLETE", contactId },
          })

          // Thank you message
          const thankYou = botConfig.msgThankYou
            .replace("{name}", convo.firstName?.split(" ")[0] || "")
            .replace("{website}", botConfig.websiteUrl || "")
          await sendFacebookMessage(psid, thankYou)

          // Send campaign PDF if this conversation was triggered by a campaign keyword
          if (convo.campaignKeyword) {
            try {
              const campaign = await prisma.facebookBotCampaign.findUnique({
                where: { keyword: convo.campaignKeyword },
              })
              if (campaign?.pdfUrl) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
                const brochureUrl = `${appUrl}/brochure/${convo.campaignKeyword}`
                const pdfMsg = `📄 ${campaign.pdfName || "Documento exclusivo"}:\n${brochureUrl}`
                await sendFacebookMessage(psid, pdfMsg)
                await prisma.facebookBotCampaign.update({
                  where: { keyword: convo.campaignKeyword },
                  data: { leads: { increment: 1 } },
                })
              }
            } catch (e) {
              console.error("[FB bot] campaign PDF send error:", e)
            }
          }

          // Send matching property listings if enabled
          if (botConfig.sendListings) {
            try {
              type PropertyWhereClause = {
                status: string
                price?: { gte?: number; lte?: number }
              }
              const where: PropertyWhereClause = { status: "ACTIVE" }
              if (convo.intent === "inversionista") {
                where.price = { gte: 300000 }
              } else if (convo.intent === "comprador_vivienda") {
                where.price = { gte: 150000, lte: 800000 }
              }

              const listings = await prisma.property.findMany({
                where,
                take: 3,
                orderBy: { createdAt: "desc" },
              })

              if (listings.length > 0) {
                for (const prop of listings) {
                  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
                  const priceStr = prop.price.toLocaleString("en-US")
                  const details = [
                    prop.bedrooms != null ? `${prop.bedrooms}bd` : null,
                    prop.bathrooms != null ? `${prop.bathrooms}ba` : null,
                    prop.sqft != null ? `${prop.sqft}ft²` : null,
                  ].filter(Boolean).join(" · ")
                  const listingMsg =
                    `🏠 ${prop.address}, ${prop.city}\n` +
                    `💰 $${priceStr}\n` +
                    (details ? `🛏 ${details}\n` : "") +
                    `🔗 Ver detalles: ${appUrl}/site/listing/${prop.id}`
                  await sendFacebookMessage(psid, listingMsg)
                }
              } else {
                await sendFacebookMessage(psid, "Pronto tendremos nuevas propiedades disponibles. ¡Catherine te las enviará personalmente!")
              }
            } catch (e) {
              console.error("[FB bot] listings send error:", e)
            }
          }
        }

      } else if (botConfig?.isEnabled && !convo) {
        // ── No active convo: check if DM text matches a campaign or general keyword ──
        const campaigns = await prisma.facebookBotCampaign.findMany({ where: { isActive: true } })
        const matchedCampaign = campaigns.find(c => text.toLowerCase().includes(c.keyword.toLowerCase()))
        const generalKeywords = botConfig.triggerKeywords
          .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        const matchesGeneral = generalKeywords.some(k => text.toLowerCase().includes(k))

        if (matchedCampaign || matchesGeneral) {
          const greeting = matchedCampaign?.greeting || botConfig.msgGreeting
          await prisma.facebookBotConversation.create({
            data: {
              psid,
              pageId,
              state: "ASKED_OPTIN",
              campaignKeyword: matchedCampaign?.keyword || null,
            },
          })
          await sendFacebookMessage(psid, greeting)
        } else {
        // ── Non-bot Messenger DM handling ───────────────────────────────────
        let contact = await prisma.contact.findFirst({ where: { facebookPsid: psid } })

        if (!contact) {
          const profile = await getFacebookUserProfile(psid)
          contact = await prisma.contact.create({
            data: {
              firstName: profile?.firstName || "Facebook",
              lastName: profile?.lastName || "Lead",
              facebookPsid: psid,
              source: "FACEBOOK",
            },
          })
        }

        await prisma.facebookMessage.create({
          data: {
            psid,
            pageId,
            body: text,
            direction: "INBOUND",
            status: "RECEIVED",
            messageId: fbMid,
            contactId: contact.id,
          },
        })

        await Promise.all([
          prisma.activity.create({
            data: {
              type: "FACEBOOK",
              title: "Mensaje de Facebook Messenger",
              description: text.slice(0, 120),
              contactId: contact.id,
            },
          }),
          prisma.contact.update({
            where: { id: contact.id },
            data: { lastContacted: new Date() },
          }),
        ])
        } // end non-bot DM
      }
    }
  }

  return NextResponse.json({ ok: true })
}
