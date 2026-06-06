export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function publishToFacebook(account: { accessToken: string | null; pageId: string | null }, content: string, mediaUrl?: string | null) {
  if (!account.accessToken || !account.pageId) throw new Error("Facebook not connected")
  const url = `https://graph.facebook.com/v18.0/${account.pageId}/feed`
  const body: Record<string, string> = { message: content, access_token: account.accessToken }
  if (mediaUrl) body.link = mediaUrl
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(body) })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.id as string
}

async function publishToInstagram(account: { accessToken: string | null; pageId: string | null }, content: string, mediaUrl?: string | null) {
  if (!account.accessToken || !account.pageId) throw new Error("Instagram not connected")
  // Instagram requires a media container first, then publish
  const containerRes = await fetch(`https://graph.facebook.com/v18.0/${account.pageId}/media`, {
    method: "POST",
    body: new URLSearchParams({
      image_url: mediaUrl || "",
      caption: content,
      access_token: account.accessToken,
    }),
  })
  const container = await containerRes.json()
  if (container.error) throw new Error(container.error.message)

  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${account.pageId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: container.id, access_token: account.accessToken }),
  })
  const published = await publishRes.json()
  if (published.error) throw new Error(published.error.message)
  return published.id as string
}

async function publishToTikTok(account: { accessToken: string | null }, content: string) {
  if (!account.accessToken) throw new Error("TikTok not connected")
  // TikTok Content Posting API
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/text/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: { title: content.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE" },
      source_info: { source: "FILE_UPLOAD", video_size: 0, chunk_size: 0, total_chunk_count: 0 },
    }),
  })
  const data = await res.json()
  if (data.error?.code !== "ok") throw new Error(data.error?.message || "TikTok publish failed")
  return data.data?.publish_id as string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { postId } = await req.json()

  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: { account: true },
  })

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  try {
    let externalId: string | undefined

    if (post.account) {
      if (post.platform === "FACEBOOK") {
        externalId = await publishToFacebook(post.account, post.content, post.mediaUrl)
      } else if (post.platform === "INSTAGRAM") {
        externalId = await publishToInstagram(post.account, post.content, post.mediaUrl)
      } else if (post.platform === "TIKTOK") {
        externalId = await publishToTikTok(post.account, post.content)
      }
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date(), externalId },
    })

    return NextResponse.json(updated)
  } catch (error) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "FAILED" },
    })
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
