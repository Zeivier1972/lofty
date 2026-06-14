export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const AUDIENCE_PROMPTS: Record<string, string> = {
  buyers: "first-time and move-up buyers in South Florida looking to purchase their dream home",
  investors: "international real estate investors (Latin America, Europe, Canada) looking for investment properties and pre-construction opportunities in Miami",
  sellers: "homeowners in Miami considering selling their property and wanting to maximize their sale price",
  renters: "renters in Miami exploring the transition from renting to owning, or looking for rental properties",
  first_time: "first-time homebuyers who are nervous about the process and need education and guidance",
  luxury: "luxury home buyers and sellers in high-end Miami neighborhoods like Brickell, Miami Beach, Coral Gables, and Coconut Grove",
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { topic, audience, language, publish, coverImage } = await req.json()
  if (!topic?.trim()) return NextResponse.json({ error: "Topic required" }, { status: 400 })

  const audienceDesc = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.buyers
  const lang = language || "es"
  const langInstruction = lang === "es"
    ? "Write entirely in Spanish."
    : lang === "both"
    ? "Write primarily in Spanish but include an English summary paragraph at the end."
    : "Write entirely in English."

  const systemPrompt = `You are a world-class real estate content strategist and SEO copywriter specializing in the Miami, South Florida market. You write for Catherine Gomez Realtor — a Miami real estate agent and educator who helps Latino families buy smart in Florida.

Your blog posts:
- Are deeply educational, build trust, and position Catherine as the local expert
- Follow E-E-A-T principles (Experience, Expertise, Authoritativeness, Trustworthiness)
- Include real Miami neighborhoods, prices, and market context
- Have strong SEO with natural keyword integration
- End with a clear CTA to contact Catherine or schedule a consultation
- ${langInstruction}

Return ONLY a valid JSON object with these exact keys:
{
  "title": "SEO-optimized blog post title",
  "metaDescription": "155 character meta description for search engines",
  "excerpt": "2-3 sentence blog excerpt/summary",
  "slug": "url-friendly-slug-with-hyphens",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "content": "Full HTML blog post with proper H2, H3 tags, paragraphs, lists. Minimum 800 words. Include a CTA at the end linking to /book"
}`

  const userPrompt = `Write a comprehensive, SEO-optimized blog post about: "${topic}"

Target audience: ${audienceDesc}

The post should be authoritative, educational, and specific to the Miami/South Florida real estate market. Include actionable advice, real numbers, and position Catherine Gomez as the trusted local expert.`

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    })

    const text = completion.choices[0]?.message?.content || ""
    const post = JSON.parse(text)

    if (publish) {
      const saved = await prisma.blogPost.create({
        data: {
          title: post.title,
          slug: post.slug || post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          excerpt: post.excerpt || null,
          content: post.content,
          coverImage: coverImage || null,
          author: "Catherine Gomez",
          tags: JSON.stringify(post.tags || []),
          published: true,
          publishedAt: new Date(),
        },
      })
      return NextResponse.json({ ...post, id: saved.id, published: true })
    }

    return NextResponse.json(post)
  } catch (e: any) {
    console.error("[AI blog-write]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
