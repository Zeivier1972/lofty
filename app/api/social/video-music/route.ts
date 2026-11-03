export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MUSIC_KEY, listMusic } from "@/lib/faceless-video"

/**
 * Background-music library for the automatic videos. Catherine uploads
 * tracks she has the rights to (YouTube Audio Library, Pixabay Music,
 * CapCut commercial…); each video picks one at random.
 */

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ tracks: await listMusic() })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file === "string") return NextResponse.json({ error: "Sube un archivo de audio" }, { status: 400 })
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|wav|aac)$/i.test(file.name)) {
    return NextResponse.json({ error: "Tiene que ser audio (MP3, M4A o WAV)" }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Máximo 15 MB por canción" }, { status: 400 })
  const data = Buffer.from(await file.arrayBuffer())
  const row = await prisma.generatedMedia.create({ data: { mimeType: file.type || "audio/mpeg", data } })
  const tracks = await listMusic()
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "mp3").toLowerCase()
  tracks.push({ id: row.id, name: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80), ext })
  await prisma.setting.upsert({ where: { key: MUSIC_KEY }, create: { key: MUSIC_KEY, value: JSON.stringify(tracks) }, update: { value: JSON.stringify(tracks) } })
  return NextResponse.json({ tracks })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id") || ""
  const tracks = (await listMusic()).filter(t => t.id !== id)
  await prisma.setting.upsert({ where: { key: MUSIC_KEY }, create: { key: MUSIC_KEY, value: JSON.stringify(tracks) }, update: { value: JSON.stringify(tracks) } })
  await prisma.generatedMedia.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ tracks })
}
