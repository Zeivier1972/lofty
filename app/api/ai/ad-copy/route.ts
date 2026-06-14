export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import OpenAI from "openai"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { brief, objective, language } = await req.json()
  if (!brief?.trim()) return NextResponse.json({ error: "Brief required" }, { status: 400 })

  const isLeadAd = objective === "OUTCOME_LEADS"
  const lang = language || "es"

  const systemPrompt = `You are a world-class Facebook Ads copywriter specializing in real estate advertising.
You write high-converting ad copy that follows Meta's advertising policies, Fair Housing Act guidelines, and best practices for engagement.

Rules:
- Primary text: emotionally engaging, 100-150 characters, creates urgency or curiosity, no discriminatory language
- Headline: benefit-focused, under 40 characters, punchy and direct
- Description: supporting detail, under 30 characters, reinforces the headline
- Campaign name: descriptive, includes location/theme/month
- No fair housing violations (no targeting by race, religion, sex, national origin, familial status, disability)
- Write in ${lang === "es" ? "Spanish" : lang === "both" ? "Spanish (with English subtitle)" : "English"}
- For lead ads: focus on getting the contact info, make it easy and valuable to sign up
- Use specific numbers, benefits, and emotional triggers that work in real estate

Return ONLY a JSON object with these exact keys:
{
  "campaignName": "...",
  "primaryText": "...",
  "headline": "...",
  "description": "..."
}`

  const userPrompt = `Create Facebook ${isLeadAd ? "Lead Generation" : "Traffic"} ad copy for this real estate campaign:

${brief}

Generate compelling, conversion-optimized copy that will make people stop scrolling and take action.`

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    })

    const text = completion.choices[0]?.message?.content || ""
    const copy = JSON.parse(text)
    return NextResponse.json(copy)
  } catch (e: any) {
    console.error("[AI ad-copy]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
