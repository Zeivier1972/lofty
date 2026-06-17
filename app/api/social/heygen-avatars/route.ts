export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Broad matcher — catches Catherine Gomez Avatar, Catherine Gomez Swap Avatar,
// "catherine" alone, etc.
function isCustom(name: string | undefined): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return n.includes("catherine") || n.includes("gomez") || n.includes("swap")
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not set" }, { status: 500 })

  const headers = { "X-Api-Key": apiKey, "Content-Type": "application/json" }

  // Hit all known avatar endpoints in parallel
  const [v2Res, v1Res, instantRes] = await Promise.all([
    fetch("https://api.heygen.com/v2/avatars", { headers }).then(r => r.json()).catch(() => null),
    fetch("https://api.heygen.com/v1/avatar.list", { headers }).then(r => r.json()).catch(() => null),
    fetch("https://api.heygen.com/v2/instant_avatar/list", { headers }).then(r => r.json()).catch(() => null),
  ])

  // ── v2 avatars ───────────────────────────────────────────────────────────────
  const v2Avatars: any[] = v2Res?.data?.avatars ?? []
  const v2TalkingPhotos: any[] = v2Res?.data?.talking_photos ?? []

  // Normalize talking_photos — dump ALL fields raw so we don't miss any
  const rawTalkingPhotos = v2TalkingPhotos.map((tp: any) => ({
    _source: "v2_talking_photo",
    _all_keys: Object.keys(tp),
    avatar_id: tp.talking_photo_id || tp.id || tp.avatar_id,
    avatar_name: tp.talking_photo_name || tp.name || tp.avatar_name,
    preview_image_url: tp.preview_image_url || tp.preview_url || tp.thumbnail_url,
    ...tp,
  }))

  // ── v1 avatars ───────────────────────────────────────────────────────────────
  const v1Avatars: any[] = (v1Res?.data ?? []).map((a: any) => ({
    _source: "v1",
    _all_keys: Object.keys(a),
    avatar_id: a.avatar_id || a.id,
    avatar_name: a.avatar_name || a.name,
    preview_image_url: a.preview_image_url || a.thumbnail_url,
    ...a,
  }))

  // ── instant avatars ──────────────────────────────────────────────────────────
  const instantAvatars: any[] = (instantRes?.data?.list ?? instantRes?.data ?? []).map((a: any) => ({
    _source: "v2_instant",
    _all_keys: Object.keys(a),
    avatar_id: a.instant_avatar_id || a.avatar_id || a.id,
    avatar_name: a.name || a.avatar_name || a.instant_avatar_name,
    preview_image_url: a.preview_image_url || a.thumbnail_url,
    ...a,
  }))

  // ── Collect everything ───────────────────────────────────────────────────────
  const allCustomCandidates = [
    ...rawTalkingPhotos,
    ...v1Avatars,
    ...instantAvatars,
    // Also include v2 avatars not already in stock (non-premium) as a cross-check
    ...v2Avatars.filter((a: any) => isCustom(a.avatar_name)).map((a: any) => ({
      _source: "v2_avatar",
      ...a,
    })),
  ]

  const customAvatars = allCustomCandidates.filter(a => isCustom(a.avatar_name))
  const v2CustomFromAvatars = v2Avatars.filter((a: any) => isCustom(a.avatar_name))

  return NextResponse.json({
    summary: {
      v2_avatars_total: v2Avatars.length,
      v2_talking_photos_total: v2TalkingPhotos.length,
      v1_avatars_total: v1Avatars.length,
      instant_avatars_total: instantAvatars.length,
      custom_matched: customAvatars.length,
    },
    // These are the ones matching "catherine", "gomez", or "swap"
    custom_avatars: customAvatars.map(a => ({
      source: a._source,
      avatar_id: a.avatar_id,
      avatar_name: a.avatar_name,
      preview_image_url: a.preview_image_url,
      all_keys: a._all_keys,
    })),
    // Raw first 3 talking photos so we can see exact field names
    talking_photos_raw_sample: v2TalkingPhotos.slice(0, 3),
    // Raw first instant avatar
    instant_raw_sample: (instantRes?.data?.list ?? instantRes?.data ?? []).slice(0, 2),
    // Status of each endpoint
    endpoint_status: {
      v2_avatars: v2Res ? "ok" : "failed",
      v1_avatar_list: v1Res ? "ok" : "failed",
      v2_instant_avatar: instantRes ? "ok" : "failed",
    },
    v2_from_avatars_custom: v2CustomFromAvatars.map((a: any) => ({
      avatar_id: a.avatar_id,
      avatar_name: a.avatar_name,
      preview_image_url: a.preview_image_url,
    })),
  })
}
