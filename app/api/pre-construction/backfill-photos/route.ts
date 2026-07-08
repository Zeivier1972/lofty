export const dynamic = "force-dynamic"
export const maxDuration = 120

// Backfill photos for saved pre-construction projects that don't have one.
// Projects saved from MLS before photo support was added lost their image;
// this re-finds each project's listing by address + city and grabs its photo.
//   POST /api/pre-construction/backfill-photos
// Session-protected.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { searchIdxListings, fetchPrimaryPhotos } from "@/lib/bridge"

const SETTING_KEY = "preconstruction_projects"

interface Project {
  id: string
  name: string
  city?: string
  zipCode?: string
  photos?: string[]
  [k: string]: any
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  let projects: Project[] = []
  try { projects = row ? JSON.parse(row.value) : [] } catch { projects = [] }

  const missing = projects.filter(p => !p.photos?.[0] && (p.name || p.zipCode))
  let updated = 0
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  for (const p of missing) {
    try {
      // The project name is typically the listing's street address (saved from MLS).
      const listings = await searchIdxListings({
        keyword: p.name || undefined,
        city: !p.name && p.city ? p.city : undefined,
        limit: 1,
      })
      const key = listings?.[0]?.ListingKey
      if (key) {
        const photos = await fetchPrimaryPhotos([key])
        const photo = photos[key]
        if (photo) { p.photos = [photo]; updated++ }
      }
      await sleep(150) // gentle pacing on the MLS API
    } catch (e) {
      console.error("[preconstruction backfill-photos]", (e as Error).message)
    }
  }

  if (updated > 0) {
    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(projects) },
      create: { key: SETTING_KEY, value: JSON.stringify(projects) },
    })
  }

  return NextResponse.json({
    ok: true,
    scanned: missing.length,
    updated,
    stillMissing: missing.length - updated,
    message: updated > 0
      ? `Found photos for ${updated} of ${missing.length} projects. Refresh to see them.`
      : `No photos found for the ${missing.length} projects missing one — add a Photo URL manually via Edit.`,
  })
}
