export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      milestones: { orderBy: { order: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ transaction })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const allowed = ["status", "salePrice", "listPrice", "closeDate", "contractDate", "listingDate", "expirationDate", "notes", "title", "address", "city", "state", "zip", "mlsNumber", "commission", "commissionPercent"]
  const numeric = new Set(["salePrice", "listPrice", "commission", "commissionPercent"])
  const data: any = {}
  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key.includes("Date")) data[key] = body[key] ? new Date(body[key]) : null
      else if (numeric.has(key)) data[key] = body[key] === "" || body[key] === null ? null : parseFloat(body[key])
      else data[key] = body[key]
    }
  }

  // Keep GCI in sync: if sale price or % changed but commission $ wasn't set
  // explicitly, recompute it (sale × % / 100).
  if (data.commission === undefined && (data.salePrice !== undefined || data.commissionPercent !== undefined)) {
    const existing = await prisma.transaction.findUnique({ where: { id: params.id }, select: { salePrice: true, commissionPercent: true } })
    const sale = data.salePrice !== undefined ? data.salePrice : existing?.salePrice ?? null
    const pct = data.commissionPercent !== undefined ? data.commissionPercent : existing?.commissionPercent ?? null
    if (sale != null && pct != null) data.commission = Math.round(sale * (pct / 100) * 100) / 100
  }

  const transaction = await prisma.transaction.update({ where: { id: params.id }, data })
  return NextResponse.json({ transaction })
}
