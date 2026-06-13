export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, address, city, state, zip, type, status, contactId, salePrice, listPrice, closeDate } = await req.json()

  if (!title?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return NextResponse.json({ error: "title, address, city, state, zip are required" }, { status: 400 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      title: title.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      type: type || "BUYER",
      status: status || "ACTIVE_LISTING",
      contactId: contactId || null,
      salePrice: salePrice ? parseFloat(salePrice) : null,
      listPrice: listPrice ? parseFloat(listPrice) : null,
      closeDate: closeDate ? new Date(closeDate) : null,
      agentId: (session.user as any)?.id,
    },
  })

  return NextResponse.json({ transaction }, { status: 201 })
}
