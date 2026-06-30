export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { detectKeyword, deliverLeadMagnet } from "@/lib/lead-magnet-delivery"
import {
  getFacebookUserProfile,
  getFacebookLeadData,
  sendFacebookMessage,
  sendFacebookMessageWithQuickReplies,
  privateReplyToComment,
  postPublicCommentReply,
  extractEmail,
  extractPhone,
  isOptOut,
  parseIntent,
} from "@/lib/facebook"
import { ingestLead } from "@/lib/lead-ingest"
import { generateSocialAIReply, getMatchingProperties, getMatchingPreConstruction, notifyCatherineAboutLead } from "@/lib/social-ai-chat"

function greetingQuickReplies(config: any) {
  return (config.greetingButtons || "Sí, me interesa,Quiero más info")
    .split(",").map((t: string) => t.trim()).filter(Boolean)
    .map((title: string) => ({ title, payload: "OPTIN" }))
}

function intentQuickReplies(config: any) {
  return [
    { title: config.intentButtonA || "Comprar para vivir", payload: "A" },
    { title: config.intentButtonB || "Invertir / Airbnb", payload: "B" },
    { title: config.intentButtonC || "Solo explorando", payload: "C" },
  ]
}

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

          const hiddenTag = fields["tag"] || fields["source_tag"] || fields["hidden_tag"] || fields["custom_tag"] || undefined

          // UTM / tracking parameters (set in Facebook form → Settings → Tracking parameters)
          const utmCampaign = fields["utm_campaign"] || undefined
          const utmSource = fields["utm_source"] || undefined
          const utmMedium = fields["utm_medium"] || undefined
          const utmContent = fields["utm_content"] || undefined

          // Apply utm_campaign as a CRM tag so smart plans can trigger on it
          const tags: string[] = []
          if (utmCampaign) tags.push(utmCampaign)
          if (hiddenTag) tags.push(hiddenTag)

          // Append UTM data to notes for visibility in the contact timeline
          const utmNote = [
            utmSource   ? `Source: ${utmSource}`     : "",
            utmCampaign ? `Campaign: ${utmCampaign}` : "",
            utmMedium   ? `Medium: ${utmMedium}`     : "",
            utmContent  ? `Content: ${utmContent}`   : "",
          ].filter(Boolean).join(" | ")

          const allNotes = [notes, utmNote].filter(Boolean).join(" | ") || undefined

          await ingestLead({
            firstName,
            lastName,
            email,
            phone,
            source: "FACEBOOK",
            campaign: campaign_name || ad_name || utmCampaign || undefined,
            budget,
            location,
            bedroomsMin,
            propertyType,
            notes: allNotes,
            facebookLeadId: leadgen_id,
            smsConsent: !!phone,
            tags: tags.length > 0 ? tags : undefined,
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
        // Skip comments posted by the page itself (prevents processing bot's own replies)
        if (commenterId === pageId) continue

        // Accent-insensitive normalize for matching
        const normFb = (s: string) => s.toLowerCase()
          .replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i")
          .replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n")

        // Check campaign keywords first (higher priority), then general keywords
        const campaigns = await prisma.facebookBotCampaign.findMany({ where: { isActive: true } })
        const t = normFb(commentText)
        const matchedCampaign = campaigns.find(c => {
          const allKws = c.keywords ? c.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []
          allKws.push(c.keyword)
          return allKws.some((kw: string) => t.includes(normFb(kw)))
        })

        const generalKeywords = botConfig.triggerKeywords
          .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        const matchesGeneral = generalKeywords.some(k => t.includes(normFb(k)))

        if (!matchedCampaign && !matchesGeneral) continue

        // Build topic-specific greeting: prefer campaign greeting, then magnet title, then generic
        const leadKeyword = await detectKeyword(commentText).catch(() => null)
        let greeting: string
        if (matchedCampaign?.greeting) {
          greeting = matchedCampaign.greeting
        } else if (leadKeyword && leadKeyword !== "LISTO") {
          const magnet = await prisma.leadMagnet.findUnique({ where: { keyword: leadKeyword } })
          const topic = magnet?.title ?? leadKeyword
          greeting = `¡Hola! 🏠 Vi que comentaste en mi video sobre "${topic}". Te envío la guía gratuita ahora mismo — solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`
        } else {
          greeting = `¡Hola! 🏠 Vi tu comentario y quiero enviarte más información. Solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`
        }

        const fbCampaignKeyword = leadKeyword || matchedCampaign?.keyword || null

        try {
          console.log(`[FB bot] Comment from ${commenterId}: "${commentText.slice(0, 50)}" — campaign: ${matchedCampaign?.keyword || "none"}, general: ${matchesGeneral}`)

          const existing = await prisma.facebookBotConversation.findUnique({
            where: { psid: commenterId },
          })

          // If person already has a conversation, reply contextually but don't restart
          if (existing) {
            if (existing.state === "OPTED_OUT") continue
            const nudge = existing.state === "COMPLETE"
              ? "¡Hola! Ya tenemos tu información 😊 Si tienes preguntas, escríbeme aquí por DM y con gusto te ayudo."
              : "¡Hola! Ya te escribí por mensaje privado 📩 Revisa tu bandeja de mensajes para continuar."
            await privateReplyToComment(commentId, nudge)
            continue
          }

          const keyword = matchedCampaign?.keyword || fbCampaignKeyword || "INFO"

          // Try private reply first (works on regular posts, fails on Reels)
          // Private reply sends greeting directly to Messenger — best UX, no click needed
          await prisma.facebookBotConversation.create({
            data: { psid: commenterId, pageId, state: "ASKED_NAME", sourceCommentId: commentId, campaignKeyword: fbCampaignKeyword },
          })
          const privateOk = await privateReplyToComment(commentId, greeting)
          console.log(`[FB bot] privateReplyToComment result: ${privateOk}`)

          if (!privateOk) {
            // Reel or missing permission — fall back to public reply with one-tap m.me link
            const meLink = `https://m.me/${pageId}?text=${encodeURIComponent(keyword.toUpperCase())}`
            postPublicCommentReply(commentId,
              `¡Hola! 👋 Toca aquí para recibir la info gratis en un solo clic 👉 ${meLink}`
            ).catch(e => console.error("[FB] postPublicCommentReply:", e))
          }
        } catch (e) {
          console.error("[FB webhook feed comment]", e)
        }
        continue
      }
    }

    // ── Instagram DMs (keyword-triggered lead magnet delivery) ───────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue
      if (entry.id?.startsWith("17") || event.sender?.id?.startsWith("IGID")) {
        // Instagram messaging event — check for lead magnet keyword
        const igsid: string = event.sender?.id ?? ""
        const igText: string = event.message?.text ?? ""
        if (igsid && igText) {
          const igKeyword = await detectKeyword(igText).catch(() => null)
          if (igKeyword) {
            const igContact = await prisma.contact.findFirst({ where: { instagramIgsid: igsid } })
            deliverLeadMagnet(igKeyword, {
              id: igContact?.id,
              firstName: igContact?.firstName || "Hola",
              phone: igContact?.phone,
              email: igContact?.email,
              instagramIgsid: igsid,
            }, { sms: false, email: !!igContact?.email, fbDm: false, igDm: true }).catch(e =>
              console.error("[FB webhook] IG lead magnet delivery failed:", e)
            )
          }
        }
        continue
      }
    }

    // ── Messenger DMs ─────────────────────────────────────────────────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue

      const psid = event.sender.id as string
      const text = (event.message.text as string) || ""
      const quickReplyPayload: string = event.message.quick_reply?.payload || ""
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
          const result = await generateSocialAIReply(text, {
            firstName: convo.firstName,
            intent: convo.intent,
            campaignKeyword: convo.campaignKeyword,
            platform: "FACEBOOK",
          }).catch(() => null)
          if (!result) continue

          await sendFacebookMessage(psid, result.reply)

          if (result.sendPreConstruction) {
            const aiConfig = await prisma.aIConfig.findFirst()
            const communities = await getMatchingPreConstruction(text, aiConfig?.calendlyUrl || "")
            if (communities.length > 0) {
              await sendFacebookMessage(psid, "🏗️ Tengo algunas opciones de nueva construcción para ti:")
              for (const msg of communities) await sendFacebookMessage(psid, msg)
            } else {
              await sendFacebookMessage(psid, `🏗️ Tengo acceso a desarrollos exclusivos de nueva construcción en Miami. Para conocer los detalles y hacer un tour privado con Catherine sin costo:${aiConfig?.calendlyUrl ? `\n📅 ${aiConfig.calendlyUrl}` : "\n📱 Escríbele directamente a Catherine."}`)
            }
          }

          if (result.sendProperties) {
            const listings = await getMatchingProperties(convo.intent)
            if (listings.length > 0) {
              for (const msg of listings) await sendFacebookMessage(psid, msg)
            } else {
              await sendFacebookMessage(psid, "🏠 En este momento estamos actualizando nuestro inventario. Catherine te enviará opciones personalizadas muy pronto.")
            }
          }

          if (result.notifyCatherine) {
            const aiConfig = await prisma.aIConfig.findFirst()
            if (aiConfig?.calendlyUrl) {
              await sendFacebookMessage(psid, `📅 Puedes agendar una llamada con Catherine directamente aquí: ${aiConfig.calendlyUrl}`)
            }
            notifyCatherineAboutLead({
              firstName: convo.firstName,
              phone: convo.phone,
              email: convo.email,
              message: text,
              platform: "FACEBOOK",
            }).catch(() => {})
          }
          continue
        }

        if (isOptOut(text)) {
          await prisma.facebookBotConversation.update({ where: { psid }, data: { state: "OPTED_OUT" } })
          await sendFacebookMessage(psid, "Entendido, no te enviaremos más mensajes. ¡Que tengas un buen día! 👋")
          continue
        }

        if (convo.state === "ASKED_NAME") {
          const words = text.trim().split(/\s+/)
          const isValidName = words.length <= 4 && text.trim().length <= 40 && /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'\-.]+$/.test(text.trim())
          if (!isValidName) {
            await sendFacebookMessage(psid, "Solo necesito tu nombre completo, por favor. Ej: María García")
            continue
          }
          const name = words.slice(0, 3).join(" ")
          const nextMsg = botConfig.msgAskEmail.replace("{name}", name.split(" ")[0])
          await prisma.facebookBotConversation.update({ where: { psid }, data: { firstName: name, state: "ASKED_EMAIL" } })
          await sendFacebookMessage(psid, nextMsg)

        } else if (convo.state === "ASKED_EMAIL") {
          const email = extractEmail(text)
          const fakeDomains = ["example.com", "test.com", "mail.com", "fake.com", "none.com", "noemail.com", "no.com", "null.com"]
          const isFakeDomain = email ? fakeDomains.some(d => email.toLowerCase().endsWith("@" + d)) : false
          if (!email || isFakeDomain) {
            await sendFacebookMessage(psid, "Hmm, necesito un email real para enviarte la información. ¿Cuál es tu correo? Ej: maria@gmail.com")
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

          // Deliver guide/PDF — single path to avoid duplicates
          if (convo.campaignKeyword) {
            const lmKeyword = await detectKeyword(convo.campaignKeyword).catch(() => null)
            if (lmKeyword) {
              // LeadMagnet guide: send link via FB DM directly, SMS + email via deliverLeadMagnet
              const magnet = await prisma.leadMagnet.findUnique({ where: { keyword: lmKeyword } })
              if (magnet?.guideUrl) {
                await sendFacebookMessage(psid,
                  `📚 Aquí está tu guía "${magnet.title}":\n${magnet.guideUrl}\n\n¡Cualquier pregunta, escríbeme aquí! 😊`
                )
              }
              deliverLeadMagnet(lmKeyword, {
                id: contactId,
                firstName: convo.firstName?.split(" ")[0] || "",
                phone,
                email: convo.email || undefined,
              }, { sms: true, email: !!convo.email, fbDm: false, igDm: false }).catch(e =>
                console.error("[FB bot] SMS/email guide delivery failed:", e)
              )
            } else {
              // External PDF campaign — send brochure link
              const campaign = await prisma.facebookBotCampaign.findUnique({ where: { keyword: convo.campaignKeyword } })
              if (campaign?.pdfUrl) {
                const brochureUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/brochure/${convo.campaignKeyword}`
                await sendFacebookMessage(psid, `📄 ${campaign.pdfName || "Documento exclusivo"}:\n${brochureUrl}`)
              }
            }
            await prisma.facebookBotCampaign.update({
              where: { keyword: convo.campaignKeyword },
              data: { leads: { increment: 1 } },
            }).catch(() => {})
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
        const normDm = (s: string) => s.toLowerCase()
          .replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i")
          .replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n")
        const tDm = normDm(text)
        const campaigns = await prisma.facebookBotCampaign.findMany({ where: { isActive: true } })
        const matchedCampaign = campaigns.find(c => {
          const allKws = c.keywords ? c.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []
          allKws.push(c.keyword)
          return allKws.some((kw: string) => tDm.includes(normDm(kw)))
        })
        const generalKeywords = botConfig.triggerKeywords
          .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        const matchesGeneral = generalKeywords.some(k => tDm.includes(normDm(k)))

        if (matchedCampaign || matchesGeneral) {
          const greeting = matchedCampaign?.greeting
            || `¡Hola! 🏠 Quiero enviarte más información. Solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`
          await prisma.facebookBotConversation.create({
            data: {
              psid,
              pageId,
              state: "ASKED_NAME",
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
