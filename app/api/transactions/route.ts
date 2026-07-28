export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, address, city, state, zip, type, status, contactId, salePrice, listPrice, closeDate, contractDate, commissionPercent, commission, mlsNumber, notes } = await req.json()

  if (!title?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return NextResponse.json({ error: "title, address, city, state, zip are required" }, { status: 400 })
  }

  const sale = salePrice ? parseFloat(salePrice) : null
  const pct = commissionPercent !== undefined && commissionPercent !== "" && commissionPercent !== null ? parseFloat(commissionPercent) : null
  // GCI = sale price × commission %  (works for both sales and leases, where
  // "sale price" is the monthly rent and the rate is typically 50%). If an
  // explicit commission $ is provided, it wins.
  const gci = commission !== undefined && commission !== "" && commission !== null
    ? parseFloat(commission)
    : (sale != null && pct != null ? Math.round(sale * (pct / 100) * 100) / 100 : null)

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
      salePrice: sale,
      listPrice: listPrice ? parseFloat(listPrice) : null,
      commissionPercent: pct,
      commission: gci,
      closeDate: closeDate ? new Date(closeDate) : null,
      contractDate: contractDate ? new Date(contractDate) : null,
      mlsNumber: mlsNumber?.trim() || null,
      notes: notes?.trim() || null,
      agentId: (session.user as any)?.id,
    },
  })

  return NextResponse.json({ transaction }, { status: 201 })
}
