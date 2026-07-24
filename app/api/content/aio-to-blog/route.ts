export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { fetchPexelsPhoto } from "@/lib/pexels-video"

// Curated Miami real-estate covers when Pexels has no key/result — so a blog
// post is never published without an image.
const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80",
]

// Publish an AIO (Answer Engine Optimization) result as a blog / FAQ page on the
// public site. A clean question → answer → FAQ structure is exactly what Google
// AI, ChatGPT and Perplexity crawl and cite. No AI call here — it just formats
// the already-generated content (keeps Anthropic credit usage at zero).

function slugify(s: string): string {
  return String(s || "").toLowerCase()
    .replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i")
    .replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
}
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { title, keyword, secondaryKeywords, aio } = await req.json()
    if (!aio || (!aio.question && !aio.answer)) {
      return NextResponse.json({ error: "Falta el contenido AIO. Genera SEO + AIO primero." }, { status: 400 })
    }

    const postTitle = String(title || aio.question || keyword || "Guía").slice(0, 120)
    const faqs: any[] = Array.isArray(aio.faqs) ? aio.faqs : []
    const faqHtml = faqs
      .filter(f => f && (f.q || f.a))
      .map(f => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`)
      .join("\n")

    const content = [
      aio.question ? `<h2>${esc(aio.question)}</h2>` : "",
      aio.answer ? `<p>${esc(aio.answer)}</p>` : "",
      faqHtml ? `<h2>Preguntas frecuentes</h2>\n${faqHtml}` : "",
      `<p><strong>¿Tienes preguntas sobre bienes raíces en Miami?</strong> Contacta a Catherine Gomez Realtor al (305) 283-0872 o agenda una consulta gratuita.</p>`,
    ].filter(Boolean).join("\n")

    // Unique slug
    const base = slugify(postTitle) || "guia"
    let slug = base
    for (let i = 2; i < 60; i++) {
      const exists = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }).catch(() => null)
      if (!exists) break
      slug = `${base}-${i}`
    }

    const tags = Array.isArray(secondaryKeywords) ? secondaryKeywords.slice(0, 8) : []
    if (keyword) tags.unshift(String(keyword))

    // Topic-relevant cover image so the post looks clean (never image-less).
    const pexels = await fetchPexelsPhoto(`${keyword || ""} ${postTitle}`).catch(() => null)
    const coverImage = pexels || COVER_FALLBACKS[Math.abs(slug.length) % COVER_FALLBACKS.length]

    await prisma.blogPost.create({
      data: {
        title: postTitle,
        slug,
        excerpt: (aio.answer ? String(aio.answer) : "").slice(0, 200) || null,
        content,
        coverImage,
        tags: JSON.stringify(tags),
        published: true,
        publishedAt: new Date(),
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    return NextResponse.json({ ok: true, slug, url: `${appUrl}/site/blog/${slug}` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 })
  }
}
