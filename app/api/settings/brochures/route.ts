export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

const SETTING_KEY = "brochure_documents"

type Brochure = { id: string; name: string; url: string; description?: string }

async function getBrochures(): Promise<Brochure[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

async function saveBrochures(brochures: Brochure[]) {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(brochures) },
    create: { key: SETTING_KEY, value: JSON.stringify(brochures) },
  })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getBrochures())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, name, url, description } = body
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 })
  }

  const brochures = await getBrochures()
  const existing = brochures.findIndex(b => b.id === id)
  const brochure: Brochure = {
    id: id || randomUUID(),
    name: name.trim(),
    url: url.trim(),
    description: description?.trim() || undefined,
  }

  if (existing >= 0) brochures[existing] = brochure
  else brochures.push(brochure)

  await saveBrochures(brochures)
  return NextResponse.json(brochure)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const brochures = await getBrochures()
  await saveBrochures(brochures.filter(b => b.id !== id))
  return NextResponse.json({ ok: true })
}
