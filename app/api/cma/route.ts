export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const reports = await prisma.cMAReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json(reports)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, address, bedrooms, bathrooms, sqft, yearBuilt, condition, notes, comps,
    estimatedMin, estimatedMax, estimatedValue, contactId } = body

  if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 })

  const report = await prisma.cMAReport.create({
    data: {
      title: title || `CMA — ${address}`,
      address,
      bedrooms,
      bathrooms,
      sqft,
      yearBuilt,
      condition: condition || "GOOD",
      notes,
      comps: JSON.stringify(comps || []),
      estimatedMin,
      estimatedMax,
      estimatedValue,
      contactId: contactId || null,
      agentId: session.user?.id as string,
    },
  })

  return NextResponse.json(report)
}
