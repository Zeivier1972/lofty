export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { publishPost } from "@/lib/social-autopilot"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { platform, videoUrl, content } = await req.json()
    if (!platform || !videoUrl || !content?.trim()) {
      return NextResponse.json({ error: "platform, videoUrl, and content are required" }, { status: 400 })
    }

    const account = await prisma.socialAccount.findFirst({
      where: { platform, isConnected: true },
    })
    if (!account) {
      return NextResponse.json(
        { error: `No hay una cuenta de ${platform} conectada. Ve a Ajustes → Redes Sociales para conectarla.` },
        { status: 400 }
      )
    }

    const post = await prisma.socialPost.create({
      data: {
        platform,
        content,
        mediaUrl: videoUrl,
        postType: "POST",
        status: "SCHEDULED",
        aiGenerated: true,
        accountId: account.id,
      },
    })

    await publishPost(
      { id: post.id, platform, content, mediaUrl: videoUrl, prompt: null },
      account
    )

    const updated = await prisma.socialPost.findUnique({ where: { id: post.id } })

    if (updated?.status === "PUBLISHED") {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json(
      { success: false, error: updated?.errorMessage || "Publicación falló — revisa los logs" },
      { status: 500 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
