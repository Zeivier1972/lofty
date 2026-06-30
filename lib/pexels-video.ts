/**
 * Pexels Video API — fetches contextually relevant real estate video clips
 * for use as HeyGen B-Roll backgrounds.
 * Requires PEXELS_API_KEY environment variable (free at pexels.com/api).
 */

const SCENE_QUERIES: Record<string, string> = {
  pool:      "luxury swimming pool villa exterior",
  family:    "family home suburban neighborhood aerial",
  beach:     "miami beach ocean aerial drone footage",
  night:     "city skyline night aerial drone lights",
  penthouse: "luxury penthouse apartment interior modern",
  modern:    "modern architecture house exterior design",
  invest:    "luxury real estate aerial miami property drone",
  seller:    "upscale house real estate exterior sale",
  airbnb:    "vacation rental property pool aerial",
  signing:   "real estate signing paperwork keys handshake",
  default:   "luxury real estate miami florida aerial drone",
}

export function getSceneQuery(sceneText: string): string {
  const t = sceneText.toLowerCase()
  if (/piscina|pool|jardín|jardin/.test(t))               return SCENE_QUERIES.pool
  if (/familia|family|doral|kendall|hogar|niños/.test(t)) return SCENE_QUERIES.family
  if (/playa|beach|mar\b|ocean|waterfront/.test(t))       return SCENE_QUERIES.beach
  if (/noche|night|brickell|downtown|rascacielos/.test(t)) return SCENE_QUERIES.night
  if (/penthouse|loft|interior|sala|cocina/.test(t))      return SCENE_QUERIES.penthouse
  if (/moderno|modern|minimalista|contemporáneo/.test(t)) return SCENE_QUERIES.modern
  if (/inversi|invest|dólares|dolares|capital|renta/.test(t)) return SCENE_QUERIES.invest
  if (/vendedor|seller|vender|precio|staging/.test(t))    return SCENE_QUERIES.seller
  if (/airbnb|vacacional|turista|tourist/.test(t))        return SCENE_QUERIES.airbnb
  if (/firma|signing|llaves|keys|contrato|contract/.test(t)) return SCENE_QUERIES.signing
  return SCENE_QUERIES.default
}

// Fallback static images when Pexels is not configured or fails
const FALLBACK_BY_QUERY_KEY: Record<string, string> = {
  pool:      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80",
  family:    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80",
  beach:     "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80",
  night:     "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80",
  penthouse: "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80",
  modern:    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80",
  invest:    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",
  seller:    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80",
  airbnb:    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80",
  signing:   "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",
  default:   "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",
}

export function getFallbackBackground(sceneText: string, index: number): Record<string, string> {
  const t = sceneText.toLowerCase()
  let key = "default"
  if (/piscina|pool/.test(t))                             key = "pool"
  else if (/familia|family|doral|hogar/.test(t))          key = "family"
  else if (/playa|beach|mar\b|ocean/.test(t))             key = "beach"
  else if (/noche|night|brickell/.test(t))                key = "night"
  else if (/penthouse|interior|sala/.test(t))             key = "penthouse"
  else if (/moderno|modern/.test(t))                      key = "modern"
  else if (/inversi|invest|dólares/.test(t))              key = "invest"
  else if (/vendedor|seller|precio/.test(t))              key = "seller"
  // Rotate fallbacks for variety even when keyword doesn't match
  const urls = Object.values(FALLBACK_BY_QUERY_KEY)
  const url = FALLBACK_BY_QUERY_KEY[key] ?? urls[index % urls.length]
  return { type: "image", url }
}

export async function fetchVideoByQuery(
  query: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const targetWidth = orientation === "portrait" ? 720 : 1280

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=${orientation}&size=medium`,
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

export async function fetchSceneVideoUrl(
  sceneText: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const query = getSceneQuery(sceneText)
  const targetWidth = orientation === "portrait" ? 720 : 1280

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=${orientation}&size=medium`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) return null

    const data = await res.json()
    const videos: any[] = data?.videos ?? []
    if (!videos.length) return null

    // Pick randomly from first 5 results so different scenes get different clips
    const video = videos[Math.floor(Math.random() * Math.min(videos.length, 5))]
    const files: any[] = (video.video_files ?? []).filter((f: any) => f.file_type === "video/mp4")
    const sorted = files.sort((a: any, b: any) => Math.abs(a.width - targetWidth) - Math.abs(b.width - targetWidth))

    return sorted[0]?.link ?? null
  } catch {
    return null
  }
}
