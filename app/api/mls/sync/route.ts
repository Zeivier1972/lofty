export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { syncMLSListings } from "@/lib/rets"
import { prisma } from "@/lib/prisma"
import fs from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), ".idx-config.json")

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const config = Object.keys(body).length > 2 ? body : JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))

    if (!config?.loginUrl || !config?.username || !config?.password) {
      return NextResponse.json({ error: "IDX credentials not configured" }, { status: 400 })
    }

    const limit = body.limit || 500
    const statusFilter = body.statusFilter || "A"

    const result = await syncMLSListings(config, prisma, { limit, statusFilter })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error("MLS sync error:", e)
    return NextResponse.json({ error: e.message || "Sync failed" }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const count = await prisma.property.count()
  const last = await prisma.property.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })

  return NextResponse.json({
    totalProperties: count,
    lastSyncedAt: last?.updatedAt || null,
  })
}
