import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await req.json()
  const wasPublished = !!(await prisma.blogPost.findUnique({ where: { id: params.id }, select: { published: true } }))?.published

  const post = await prisma.blogPost.update({
    where: { id: params.id },
    data: {
      ...data,
      publishedAt: data.published && !wasPublished ? new Date() : undefined,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
    },
  })
  return NextResponse.json(post)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.blogPost.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
