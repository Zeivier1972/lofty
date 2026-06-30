export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { detectKeyword, deliverLeadMagnet } from "@/lib/lead-magnet-delivery"
import {
  sendInstagramDM, replyToComment, verifyWebhookToken,
  extractEmail, extractPhone, isOptOut,
} from "@/lib/instagram"
import { ingestLead } from "@/lib/lead-ingest"
import { generateSocialAIReply, getMatchingProperties, getMatchingPreConstruction, notifyCatherineAboutLead } from "@/lib/social-ai-chat"

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

    if (body.object !== "instagram") {
      return NextResponse.json({ ok: true })
    }

    const config = await prisma.instagramBotConfig.findFirst()
    if (!config?.isEnabled) return NextResponse.json({ ok: true })

    const igCampaigns = await prisma.instagramBotCampaign.findMany({ where: { isActive: true } })

    const normalize = (s: string) => s.toLowerCase()
      .replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i")
      .replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n")

    const findCampaign = (text: string) => {
      const t = normalize(text)
      return igCampaigns.find(c => {
        const kws = c.keywords
          ? c.keywords.split(",").map(k => k.trim()).filter(Boolean)
          : []
        kws.push(c.keyword)
        return kws.some(kw => t.includes(normalize(kw)))
      })
    }

    const triggerKws = config.triggerKeywords
      .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)

    const matchesKeyword = (text: string) =>
      triggerKws.some(k => normalize(text).includes(normalize(k))) || !!findCampaign(text)

    const buildGreeting = async (commentText: string): Promise<{ greeting: string; campaignKeyword: string | null }> => {
      const campaign = findCampaign(commentText)
      const leadKeyword = await detectKeyword(commentText).catch(() => null)

      if (campaign?.greeting) {
        return { greeting: campaign.greeting, campaignKeyword: campaign.keyword }
      }

      if (leadKeyword && leadKeyword !== "LISTO") {
        const magnet = await prisma.leadMagnet.findUnique({ where: { keyword: leadKeyword } })
        const topic = magnet?.title ?? leadKeyword
        return {
          greeting: `¡Hola! 🏠 Vi que comentaste en mi video sobre "${topic}". Te envío la guía gratuita ahora mismo — solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`,
          campaignKeyword: leadKeyword,
        }
      }

      return {
        greeting: campaign?.greeting || `¡Hola! 🏠 Quiero enviarte más información. Solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`,
        campaignKeyword: campaign?.keyword || null,
      }
    }

    for (const entry of body.entry || []) {
      // ── Comment events ────────────────────────────────────────────────────
      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue

        const val = change.value
        const commentText: string = val?.text || ""
        const igUserId: string = val?.from?.id
        const igUsername: string = val?.from?.username || ""
        const commentId: string = val?.id

        if (!igUserId || !commentId) continue
        if (!matchesKeyword(commentText)) continue

        const existing = await prisma.instagramConversation.findUnique({ where: { igUserId } })

        if (existing) {
          if (existing.state === "OPTED_OUT") continue
          const nudge = existing.state === "COMPLETE"
            ? "¡Hola! Ya tenemos tu información 😊 Si tienes preguntas, escríbeme aquí por DM y con gusto te ayudo."
            : "¡Hola! Ya te escribí por mensaje privado 📩 Revisa tu bandeja de DMs para continuar."
          replyToComment(commentId, nudge).catch(() => {})
          continue
        }

        const { greeting, campaignKeyword } = await buildGreeting(commentText)

        await prisma.instagramConversation.create({
          data: { igUserId, igUsername, state: "ASKED_NAME", sourceCommentId: commentId, campaignKeyword },
        })

        replyToComment(commentId, "¡Hola! Te acabo de enviar un mensaje privado 📩").catch(() => {})
        await sendInstagramDM(igUserId, greeting)
      }

      // ── DM events ─────────────────────────────────────────────────────────
      for (const msg of entry.messaging || []) {
        const igUserId: string = msg.sender?.id
        const text: string = msg.message?.text || ""
        const accountId = process.env.INSTAGRAM_ACCOUNT_ID

        if (!igUserId || igUserId === accountId || msg.message?.is_echo || !text) continue

        let convo = await prisma.instagramConversation.findUnique({ where: { igUserId } })

        // No conversation — only start one if they used a keyword
        if (!convo) {
          if (!matchesKeyword(text)) continue
          const { greeting, campaignKeyword } = await buildGreeting(text)
          convo = await prisma.instagramConversation.create({
            data: { igUserId, state: "ASKED_NAME", campaignKeyword },
          })
          await sendInstagramDM(igUserId, greeting)
          continue
        }

        if (convo.state === "OPTED_OUT") continue

        // COMPLETE — AI takes over, no more data collection
        if (convo.state === "COMPLETE") {
          const result = await generateSocialAIReply(text, {
            firstName: convo.firstName,
            intent: convo.intent,
            campaignKeyword: convo.campaignKeyword,
            platform: "INSTAGRAM",
          }).catch(() => null)
          if (!result) continue

          await sendInstagramDM(igUserId, result.reply)

          if (result.sendProperties) {
            const listings = await getMatchingProperties(convo.intent)
            if (listings.length > 0) {
              for (const msg of listings) await sendInstagramDM(igUserId, msg)
            } else {
              await sendInstagramDM(igUserId, "🏠 En este momento estamos actualizando nuestro inventario. Catherine te enviará opciones personalizadas muy pronto.")
            }
          }

          if (result.sendPreConstruction) {
            const aiConfig = await prisma.aIConfig.findFirst()
            const communities = await getMatchingPreConstruction(text, aiConfig?.calendlyUrl || "")
            if (communities.length > 0) {
              await sendInstagramDM(igUserId, "🏗️ Tengo algunas opciones de nueva construcción para ti:")
              for (const msg of communities) await sendInstagramDM(igUserId, msg)
            } else {
              await sendInstagramDM(igUserId, `🏗️ Tengo acceso a desarrollos exclusivos de nueva construcción en Miami. Para conocer los detalles y hacer un tour privado con Catherine sin costo:${(await prisma.aIConfig.findFirst())?.calendlyUrl ? `\n📅 ${(await prisma.aIConfig.findFirst())?.calendlyUrl}` : "\n📱 Escríbele directamente a Catherine."}`)
            }
          }

          if (result.notifyCatherine) {
            const aiConfig = await prisma.aIConfig.findFirst()
            if (aiConfig?.calendlyUrl) {
              await sendInstagramDM(igUserId, `📅 Puedes agendar una llamada con Catherine directamente aquí: ${aiConfig.calendlyUrl}`)
            }
            notifyCatherineAboutLead({
              firstName: convo.firstName,
              phone: convo.phone,
              email: convo.email,
              message: text,
              platform: "INSTAGRAM",
            }).catch(() => {})
          }
          continue
        }

        if (isOptOut(text)) {
          await prisma.instagramConversation.update({ where: { igUserId }, data: { state: "OPTED_OUT" } })
          await sendInstagramDM(igUserId, "Entendido, no te enviaremos más mensajes. ¡Que tengas un buen día! 👋")
          continue
        }

        // ── State machine: ASKED_NAME → ASKED_EMAIL → ASKED_PHONE → COMPLETE ──

        if (convo.state === "ASKED_NAME") {
          const words = text.trim().split(/\s+/)
          const looksLikeName = words.length <= 4
            && text.trim().length <= 40
            && /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'\-.]+$/.test(text.trim())
          if (!looksLikeName) {
            await sendInstagramDM(igUserId, "Solo necesito tu nombre completo, por favor. Ej: María García")
            continue
          }
          const name = words.slice(0, 3).join(" ")
          await prisma.instagramConversation.update({ where: { igUserId }, data: { firstName: name, state: "ASKED_EMAIL" } })
          await sendInstagramDM(igUserId, config.msgAskEmail.replace("{name}", name.split(" ")[0]))

        } else if (convo.state === "ASKED_EMAIL") {
          const email = extractEmail(text)
          const fakeDomains = ["example.com", "test.com", "mail.com", "fake.com", "none.com", "null.com"]
          const isFake = email ? fakeDomains.some(d => email.toLowerCase().endsWith("@" + d)) : false
          if (!email || isFake) {
            await sendInstagramDM(igUserId, "Necesito un email real para enviarte la información. Ej: maria@gmail.com")
            continue
          }
          await prisma.instagramConversation.update({ where: { igUserId }, data: { email, state: "ASKED_PHONE" } })
          await sendInstagramDM(igUserId, config.msgAskPhone.replace("{name}", convo.firstName?.split(" ")[0] || ""))

        } else if (convo.state === "ASKED_PHONE") {
          const phone = extractPhone(text)
          if (!phone) {
            await sendInstagramDM(igUserId, "No encontré un número válido. Ej: +1 786 123 4567")
            continue
          }

          const nameParts = (convo.firstName || convo.igUsername || "Lead").split(/\s+/)

          const { contactId } = await ingestLead({
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
            email: convo.email || undefined,
            phone,
            source: "INSTAGRAM",
            campaign: convo.campaignKeyword
              ? `Instagram Bot — ${convo.campaignKeyword}`
              : "Instagram Bot",
            notes: `IG: @${convo.igUsername || igUserId}`,
            smsConsent: true,
          })

          await prisma.contact.update({
            where: { id: contactId },
            data: { socialInstagram: convo.igUsername || undefined },
          }).catch(() => {})

          await prisma.activity.create({
            data: {
              type: "NOTE",
              title: "Lead capturado via Instagram",
              description: `Instagram: @${convo.igUsername || igUserId}${convo.campaignKeyword ? ` · Keyword: ${convo.campaignKeyword}` : ""}`,
              contactId,
            },
          })

          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { phone, state: "COMPLETE", contactId },
          })

          // Thank you message
          const thankYou = config.msgThankYou
            .replace("{name}", convo.firstName?.split(" ")[0] || "")
            .replace("{website}", config.websiteUrl || "")
          await sendInstagramDM(igUserId, thankYou)

          // Deliver guide/PDF
          if (convo.campaignKeyword) {
            const leadKw = await detectKeyword(convo.campaignKeyword).catch(() => null)

            if (leadKw) {
              // LeadMagnet guide: send link directly via IG DM (same token as the whole flow)
              const magnet = await prisma.leadMagnet.findUnique({ where: { keyword: leadKw } })
              if (magnet?.guideUrl) {
                await sendInstagramDM(igUserId,
                  `📚 Aquí está tu guía "${magnet.title}":\n${magnet.guideUrl}\n\n¡Cualquier pregunta, escríbeme aquí! 😊`
                )
              }
              // Also send via SMS and email (fire and forget)
              deliverLeadMagnet(leadKw, {
                id: contactId,
                firstName: nameParts[0],
                phone,
                email: convo.email || undefined,
              }, { sms: true, email: !!convo.email, fbDm: false, igDm: false }).catch(e =>
                console.error("[IG bot] SMS/email guide delivery failed:", e)
              )
            } else {
              // External PDF campaign (e.g. BRICKELL) — send brochure link via IG DM
              const campaign = await prisma.instagramBotCampaign.findUnique({
                where: { keyword: convo.campaignKeyword },
              })
              if (campaign?.pdfUrl) {
                const brochureUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/brochure/${convo.campaignKeyword}`
                await sendInstagramDM(igUserId, `📄 ${campaign.pdfName || "Documento exclusivo"}:\n${brochureUrl}`)
              }
            }

            await prisma.instagramBotCampaign.update({
              where: { keyword: convo.campaignKeyword },
              data: { leads: { increment: 1 } },
            }).catch(() => {})
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
