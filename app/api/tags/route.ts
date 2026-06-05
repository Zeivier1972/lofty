import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json(tags)
  } catch {
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, color } = await req.json()
    const tag = await prisma.tag.create({ data: { name, color } })
    return NextResponse.json(tag, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
