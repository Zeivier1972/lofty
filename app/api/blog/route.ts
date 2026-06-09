export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const publicOnly = searchParams.get("public") === "1"

  const posts = await prisma.blogPost.findMany({
    where: publicOnly ? { published: true } : undefined,
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: publicOnly ? 6 : 50,
  })
  return NextResponse.json(posts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await req.json()
  const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  const post = await prisma.blogPost.create({
    data: {
      title:      data.title,
      slug,
      excerpt:    data.excerpt   || null,
      content:    data.content   || "",
      coverImage: data.coverImage || null,
      author:     data.author    || "Catherine Gomez",
      tags:       data.tags      ? JSON.stringify(data.tags) : "[]",
      featured:   !!data.featured,
      published:  !!data.published,
      publishedAt: data.published ? new Date() : null,
    },
  })
  return NextResponse.json(post)
}
