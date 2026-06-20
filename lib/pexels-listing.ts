/**
 * Pexels video queries tuned for real estate listing videos.
 * Each query targets the specific room/area type shown in that scene.
 */

import { getFallbackBackground } from "./pexels-video"

export const LISTING_SCENE_QUERIES: Record<string, string> = {
  hook:           "luxury real estate miami aerial cinematic drone",
  exterior:       "luxury house exterior curb appeal modern architecture",
  living_room:    "modern luxury living room bright open interior",
  kitchen:        "luxury kitchen white modern interior design",
  master_bedroom: "luxury master bedroom suite interior design",
  bathroom:       "luxury bathroom marble spa shower interior",
  backyard:       "luxury backyard outdoor patio entertaining",
  pool:           "swimming pool luxury villa aerial blue water",
  aerial:         "luxury property aerial drone shot cinematic",
  neighborhood:   "upscale neighborhood miami streets lifestyle aerial",
  amenities:      "luxury building amenities gym rooftop pool",
  urgency:        "real estate investment miami market growth opportunity",
  transition:     "luxury interior modern architecture design cinematic",
  cta:            "happy couple new home keys celebration",
}

// Maps a scene_type to which index in the user's photoUrls[] array to use.
// -1 means "never use a listing photo here — use Pexels video only."
const SCENE_PHOTO_INDEX: Record<string, number> = {
  exterior:        0,
  living_room:     1,
  kitchen:         2,
  master_bedroom:  3,
  bathroom:        4,
  backyard:        5,
  pool:            6,
  aerial:          7,
  neighborhood:   -1,
  amenities:      -1,
  urgency:        -1,
  hook:           -1,
  transition:     -1,
  cta:            -1,
}

/**
 * Fetch a scene-type-specific Pexels video clip.
 */
export async function fetchListingSceneVideo(
  sceneType: string,
  orientation: "portrait" | "landscape"
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const query = LISTING_SCENE_QUERIES[sceneType] ?? LISTING_SCENE_QUERIES.transition
  const targetWidth = orientation === "portrait" ? 720 : 1280

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}&size=medium`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) return null

    const data = await res.json()
    const videos: any[] = data?.videos ?? []
    if (!videos.length) return null

    const video = videos[Math.floor(Math.random() * Math.min(videos.length, 5))]
    const files: any[] = (video.video_files ?? []).filter((f: any) => f.file_type === "video/mp4")
    const sorted = files.sort((a: any, b: any) => Math.abs(a.width - targetWidth) - Math.abs(b.width - targetWidth))

    return sorted[0]?.link ?? null
  } catch {
    return null
  }
}

/**
 * Priority: listing photo → Pexels video → static fallback.
 */
export function getListingBackground(
  sceneType: string,
  photoUrls: string[],
  pexelsVideoUrl: string | null,
  sceneIndex: number
): Record<string, unknown> {
  const photoIdx = SCENE_PHOTO_INDEX[sceneType]
  if (photoIdx !== undefined && photoIdx >= 0 && photoUrls[photoIdx]) {
    return { type: "image", url: photoUrls[photoIdx] }
  }
  if (pexelsVideoUrl) {
    return { type: "video", url: pexelsVideoUrl, play_style: "fit_to_scene" }
  }
  return getFallbackBackground(sceneType, sceneIndex)
}
