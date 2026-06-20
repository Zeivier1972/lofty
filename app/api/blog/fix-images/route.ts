export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function generateAndUploadImage(prompt: string): Promise<string | null> {
  const FALLBACKS = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1080&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&q=80",
    "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1080&q=80",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1080&q=80",
  ]
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional Miami real estate photography. ${prompt}. Luxury properties, modern architecture. Photorealistic, bright daylight, no text or watermarks.`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    } as any)

    const b64 = (response.data as any[])?.[0]?.b64_json
    if (!b64) return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]

    const result = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, { folder: "lofty-blog" })
    return result.secure_url
  } catch {
    return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
  }
}

// POST /api/blog/fix-images  { slug: "..." }
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { slug } = await req.json()
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const post = await prisma.blogPost.findFirst({ where: { slug } })
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  // Use Claude to generate image prompts from the blog content
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const claudeRes = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Blog title: "${post.title}"\n\nGenerate 3 image prompts for this Miami real estate blog post (cover + 2 sections). Keep each prompt under 20 words, real estate photography style.\n\nOutput only JSON: { "cover": "...", "section1": "...", "section2": "..." }`,
    }],
  })

  let prompts = { cover: post.title, section1: "Miami luxury property interior", section2: "Miami neighborhood lifestyle" }
  try {
    const text = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : ""
    const match = text.match(/\{[\s\S]*\}/)
    if (match) prompts = { ...prompts, ...JSON.parse(match[0]) }
  } catch { /* use defaults */ }

  // Generate all 3 images in parallel
  const [coverImage, section1Url, section2Url] = await Promise.all([
    generateAndUploadImage(prompts.cover),
    generateAndUploadImage(prompts.section1),
    generateAndUploadImage(prompts.section2),
  ])

  const IMG_FIGURE = (src: string, title: string) =>
    `<figure class="my-8 rounded-2xl overflow-hidden shadow-md"><img src="${src}" alt="${title}" class="w-full object-cover max-h-80" loading="lazy" /></figure>`

  // Inject images into HTML: replace any remaining placeholders, or append before closing tags
  let html = post.content
  if (section1Url) {
    if (html.includes("[IMG_SECTION_1]")) {
      html = html.replace("[IMG_SECTION_1]", IMG_FIGURE(section1Url, post.title))
    } else {
      // Insert after first </p> (intro paragraph)
      html = html.replace("</p>", `</p>${IMG_FIGURE(section1Url, post.title)}`)
    }
  }
  if (section2Url) {
    if (html.includes("[IMG_SECTION_2]")) {
      html = html.replace("[IMG_SECTION_2]", IMG_FIGURE(section2Url, post.title))
    } else {
      // Insert before the last </section> or </div>
      const idx = html.lastIndexOf("<h2")
      if (idx !== -1) {
        html = html.slice(0, idx) + IMG_FIGURE(section2Url, post.title) + html.slice(idx)
      }
    }
  }

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      content: html,
      coverImage: coverImage ?? post.coverImage,
    },
  })

  return NextResponse.json({
    ok: true,
    coverImage,
    section1Url,
    section2Url,
    slug: post.slug,
  })
}
