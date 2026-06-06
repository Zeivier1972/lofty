export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORM_GUIDES: Record<string, string> = {
  FACEBOOK: "Facebook post: 100-300 words, conversational, educational, include a call to action. Use line breaks for readability.",
  INSTAGRAM: "Instagram caption: engaging hook first line, 150-200 words, 5-10 relevant hashtags at end, include emoji strategically, strong CTA.",
  TIKTOK: "TikTok caption: short punchy hook (first 3 words grab attention), 100-150 words, trending real estate hashtags, urgent CTA.",
  LINKEDIN: "LinkedIn post: professional tone, 200-300 words, market insights and value, establish expertise, end with a question to drive comments.",
  GOOGLE_BUSINESS: "Google Business post: 150-200 words, local focus, clear offer or update, include hours/location if relevant, strong local CTA.",
}

const CONTENT_TYPES: Record<string, string> = {
  property_showcase: "Create a compelling property showcase post for this listing. Highlight the best features, lifestyle benefits, and create urgency.",
  market_update: "Write an engaging local real estate market update. Include stats, trends, buyer/seller advice, and position the agent as the local expert.",
  buyer_tips: "Write educational buyer tips content. Provide actionable advice for home buyers in today's market. Include 3-5 concrete tips.",
  seller_tips: "Write educational seller tips content. Help sellers understand how to prepare their home and price it right. Include proven strategies.",
  neighborhood_spotlight: "Write a neighborhood spotlight post. Highlight the community, amenities, lifestyle, schools, and what makes it special for buyers.",
  market_stats: "Write a market statistics post showing local real estate data. Make numbers engaging and explain what they mean for buyers and sellers.",
  investment_tip: "Write a real estate investment tip post. Educate on ROI, rental income, appreciation, or market timing. Position as a trusted advisor.",
  success_story: "Write a client success story (generic, no real names). Celebrate a recent win — first-time buyer, fast sale, above asking price — and inspire others.",
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { platform, contentType, details, realtorName = "Catherine", location = "your area" } = await req.json()

  const platformGuide = PLATFORM_GUIDES[platform] || PLATFORM_GUIDES.FACEBOOK
  const contentGuide = CONTENT_TYPES[contentType] || CONTENT_TYPES.market_update

  const systemPrompt = `You are a real estate social media expert helping ${realtorName}, a top-performing real estate agent in ${location}.
Your posts are authentic, educational, and convert followers into leads.
Always write in first person as the agent. Never use generic filler phrases.
Platform format: ${platformGuide}`

  const userPrompt = `${contentGuide}
${details ? `\nAdditional context/details: ${details}` : ""}
Location: ${location}
Agent name: ${realtorName}

Write the complete post, ready to copy and paste. Do not add any preamble or explanation — just the post content.`

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  })

  const content = message.content[0].type === "text" ? message.content[0].text : ""

  return NextResponse.json({ content, platform, contentType })
}
