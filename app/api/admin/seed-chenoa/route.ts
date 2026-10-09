export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * CHENOA — down-payment assistance campaign for Facebook and Instagram.
 *
 * Both comment handlers ignore a comment unless it matches an active campaign
 * keyword or one of the bot's general trigger keywords:
 *
 *   if (!matchedCampaign && !matchesGeneral) continue
 *
 * "chenoa" was in neither list, so every comment asking about the program was
 * dropped before the bot even replied. This registers it on both platforms and
 * also appends it to each bot's general keywords as a safety net, so a comment
 * still triggers if the campaign is ever deactivated.
 *
 * The greeting asks for the name, which is what puts the conversation into
 * ASKED_NAME and starts the usual name -> email -> phone capture. Nothing about
 * that sequence changes; this only makes the word trigger it.
 */

const KEYWORD = "CHENOA"

/** Variants people actually type in comments, including without the accent. */
const VARIANTS = [
  "chenoa",
  "chenoa fund",
  "programa chenoa",
  "fondo chenoa",
  "ayuda para la cuota inicial",
  "cuota inicial",
  "down payment assistance",
  "ayuda down payment",
  "enganche",
].join(",")

const NAME = "Chenoa — ayuda para la cuota inicial"

/**
 * Deliberately general about how the program works: this goes out as a DM to
 * the public, and eligibility and amounts are not ours to promise. It gets the
 * name, and Catherine takes it from there.
 */
const GREETING =
  "¡Hola! 🏠 Vi que preguntaste por el programa Chenoa — la ayuda para la cuota inicial. " +
  "Te explico cómo funciona y vemos si calificas, sin compromiso. " +
  "Solo necesito un par de datos rápidos. ¿Cuál es tu nombre completo?"

/** Append words to a comma-separated keyword list, skipping ones already there. */
function withKeywords(existing: string, add: string[]): string {
  const have = new Set(
    existing.split(",").map(k => k.trim().toLowerCase()).filter(Boolean),
  )
  const merged = existing.split(",").map(k => k.trim()).filter(Boolean)
  for (const word of add) {
    if (!have.has(word.toLowerCase())) {
      merged.push(word)
      have.add(word.toLowerCase())
    }
  }
  return merged.join(",")
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignData = {
    keywords: VARIANTS,
    name: NAME,
    greeting: GREETING,
    isActive: true,
  }

  const fbCampaign = await prisma.facebookBotCampaign.upsert({
    where: { keyword: KEYWORD },
    update: campaignData,
    create: { keyword: KEYWORD, ...campaignData },
  })

  const igCampaign = await prisma.instagramBotCampaign.upsert({
    where: { keyword: KEYWORD },
    update: campaignData,
    create: { keyword: KEYWORD, ...campaignData },
  })

  // Safety net: also add the plain word to each bot's general trigger list.
  const extra = ["chenoa"]

  const fbConfig = await prisma.facebookBotConfig.findFirst()
  let fbKeywords: string | null = null
  if (fbConfig) {
    fbKeywords = withKeywords(fbConfig.triggerKeywords, extra)
    await prisma.facebookBotConfig.update({
      where: { id: fbConfig.id },
      data: { triggerKeywords: fbKeywords },
    })
  }

  const igConfig = await prisma.instagramBotConfig.findFirst()
  let igKeywords: string | null = null
  if (igConfig) {
    igKeywords = withKeywords(igConfig.triggerKeywords, extra)
    await prisma.instagramBotConfig.update({
      where: { id: igConfig.id },
      data: { triggerKeywords: igKeywords },
    })
  }

  return NextResponse.json({
    ok: true,
    facebook: { campaignId: fbCampaign.id, keyword: fbCampaign.keyword, botEnabled: fbConfig?.isEnabled ?? null, triggerKeywords: fbKeywords },
    instagram: { campaignId: igCampaign.id, keyword: igCampaign.keyword, botEnabled: igConfig?.isEnabled ?? null, triggerKeywords: igKeywords },
    note: "Los DMs seguirán fallando hasta que se arreglen el App Review de Facebook (código 10) y el token vencido de Instagram (código 190).",
  })
}
