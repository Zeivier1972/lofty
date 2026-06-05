import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: session.user!.id },
      select: { id: true, name: true, email: true, phone: true, title: true, bio: true, timezone: true, avatar: true, role: true },
    })

    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await req.json()
    const { id, password, role, createdAt, updatedAt, ...updateData } = data

    const user = await prisma.user.update({
      where: { id: session.user!.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, title: true, bio: true, timezone: true },
    })

    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
