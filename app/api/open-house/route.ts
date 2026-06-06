export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const openHouses = await prisma.openHouse.findMany({
    include: {
      property: { select: { id: true, address: true, city: true, price: true, images: true } },
      visitors: true,
    },
    orderBy: { date: "desc" },
    take: 50,
  })
  return NextResponse.json(openHouses)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { address, date, endTime, notes, propertyId } = await req.json()

  const openHouse = await prisma.openHouse.create({
    data: {
      address,
      date: new Date(date),
      endTime: endTime ? new Date(endTime) : undefined,
      notes,
      propertyId: propertyId || undefined,
      agentId: session.user!.id as string,
    },
    include: { property: true, visitors: true },
  })

  return NextResponse.json(openHouse, { status: 201 })
}
