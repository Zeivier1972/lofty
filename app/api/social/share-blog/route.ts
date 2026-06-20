export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { shareBlogOnSocial } from "@/lib/social-autopilot"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { blogId } = await req.json()
  if (!blogId) return NextResponse.json({ error: "blogId required" }, { status: 400 })

  const post = await prisma.blogPost.findUnique({ where: { id: blogId } })
  if (!post) return NextResponse.json({ error: "Blog post not found" }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const blogUrl = `${appUrl}/site/blog/${post.slug}`

  try {
    await shareBlogOnSocial(
      post.title,
      post.excerpt ?? "",
      blogUrl,
      post.coverImage ?? null,
      new Date().getDay(),
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
