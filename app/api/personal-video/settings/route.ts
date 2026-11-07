export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AUTO_SETTING, AVATAR_SETTING, chosenAvatar } from "@/lib/personal-video"

/**
 * Personal video settings: automatic videos for new project leads (on/off) and
 * the avatar used. POST { auto } or POST { avatar: { id, name, preview, isTalkingPhoto } | null }.
 */
export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const s = await prisma.setting.findUnique({ where: { key: AUTO_SETTING } }).catch(() => null)
  return NextResponse.json({
    auto: s?.value === "on",
    dailyCap: Number(process.env.PERSONAL_VIDEO_DAILY_CAP || 15),
    avatar: await chosenAvatar(),
  })
}

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  if ("avatar" in body) {
    const a = body.avatar
    if (!a) {
      await prisma.setting.deleteMany({ where: { key: AVATAR_SETTING } })
    } else {
      const id = String(a.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80)
      if (!id) return NextResponse.json({ error: "Avatar inválido" }, { status: 400 })
      const value = JSON.stringify({
        id,
        name: String(a.name || "").slice(0, 120),
        preview: typeof a.preview === "string" && a.preview.startsWith("https://") ? a.preview.slice(0, 500) : null,
        isTalkingPhoto: a.isTalkingPhoto !== false,
      })
      await prisma.setting.upsert({ where: { key: AVATAR_SETTING }, create: { key: AVATAR_SETTING, value }, update: { value } })
    }
    return NextResponse.json({ avatar: await chosenAvatar() })
  }

  const value = body.auto ? "on" : "off"
  await prisma.setting.upsert({ where: { key: AUTO_SETTING }, create: { key: AUTO_SETTING, value }, update: { value } })
  return NextResponse.json({ auto: value === "on" })
}
