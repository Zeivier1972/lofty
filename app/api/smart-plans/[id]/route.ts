import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await req.json()
    const plan = await prisma.smartPlan.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(plan)
  } catch {
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
  }
}
