export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import OpenAI from "openai"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query, type } = await req.json()
  if (!query?.trim()) return NextResponse.json({ error: "Query required" }, { status: 400 })

  const typeInstructions: Record<string, string> = {
    market: "Focus on current Miami real estate market data, trends, prices, inventory, and forecasts.",
    video: "Focus on trending real estate video content ideas, popular topics on YouTube/TikTok/Instagram Reels, viral formats, and hooks that perform well for real estate agents.",
    content: "Focus on content marketing ideas, blog topics, social media post ideas, and engagement strategies for real estate agents targeting Latino buyers in Miami.",
    seo: "Focus on SEO keyword opportunities, search trends, and content gaps for Miami real estate websites.",
    competition: "Focus on what successful Miami real estate agents are doing on social media and online — strategies, content types, posting frequency, and engagement tactics.",
    investors: "Focus on international real estate investor trends, cap rates, pre-construction opportunities, and what's attracting foreign buyers to Miami.",
  }

  const context = typeInstructions[type] || typeInstructions.market

  const systemPrompt = `You are a strategic real estate marketing researcher helping Catherine Gomez Realtor — a Miami real estate agent specializing in helping Latino families buy smart in Florida.

${context}

Provide specific, actionable, current insights. Include:
- Key findings and data points
- Specific opportunities to act on NOW
- Concrete recommendations for Catherine's business
- Content/video ideas with specific titles or hooks when relevant

Format your response in clear sections with headers. Be specific — not generic advice.`

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

    // Use web search if available (responses API), fall back to chat completions
    let result = ""
    try {
      const response = await (client as any).responses.create({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: `${systemPrompt}\n\nResearch request: ${query}`,
      })
      result = response.output_text || ""
    } catch {
      // Fallback to regular completion without web search
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      })
      result = completion.choices[0]?.message?.content || ""
    }

    return NextResponse.json({ result })
  } catch (e: any) {
    console.error("[AI research]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
