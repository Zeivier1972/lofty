export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

const SETTING_KEY = "voicemail_templates"

type VmTemplate = { id: string; name: string; text?: string; audioUrl?: string }

async function getTemplates(): Promise<VmTemplate[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

async function saveTemplates(templates: VmTemplate[]) {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(templates) },
    create: { key: SETTING_KEY, value: JSON.stringify(templates) },
  })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getTemplates())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, name, text, audioUrl } = body
  if (!name?.trim() || (!text?.trim() && !audioUrl)) {
    return NextResponse.json({ error: "name is required; provide script text or a recorded audio" }, { status: 400 })
  }

  const templates = await getTemplates()
  const existing = templates.findIndex(t => t.id === id)
  const template: VmTemplate = { id: id || randomUUID(), name: name.trim(), text: text?.trim() || undefined, audioUrl: audioUrl || undefined }

  if (existing >= 0) templates[existing] = template
  else templates.push(template)

  await saveTemplates(templates)
  return NextResponse.json(template)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const templates = await getTemplates()
  await saveTemplates(templates.filter(t => t.id !== id))
  return NextResponse.json({ ok: true })
}
