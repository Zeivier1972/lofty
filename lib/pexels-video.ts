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

const PHOTO_QUERIES: Record<string, string> = {
  pool:      "luxury villa swimming pool Miami exterior",
  family:    "suburban family home neighborhood Florida",
  beach:     "Miami Beach oceanfront property aerial",
  night:     "Miami city skyline Brickell night luxury",
  penthouse: "luxury penthouse apartment interior modern",
  modern:    "modern architecture house exterior design",
  invest:    "luxury real estate aerial Miami property",
  seller:    "upscale house real estate exterior curb appeal",
  airbnb:    "vacation rental property pool luxury",
  signing:   "real estate agent keys handshake home purchase",
  default:   "luxury real estate Miami Florida home",
}

// Modifiers rotated into the query so the same theme doesn't always hit the same
// top results — dramatically widens the pool of distinct photos over time.
const PHOTO_MODIFIERS = ["", "modern", "luxury", "aerial view", "twilight", "sunny bright", "curb appeal", "tropical landscaping"]

export async function fetchPexelsPhoto(
  themeOrQuery: string,
  orientation: "landscape" | "portrait" | "square" = "landscape",
  excludeUrls?: Set<string>,
  variety = 0,
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const t = themeOrQuery.toLowerCase()
  let key = "default"
  if (/piscina|pool/.test(t))                         key = "pool"
  else if (/familia|family|doral|hogar|kendall/.test(t)) key = "family"
  else if (/playa|beach|mar\b|ocean/.test(t))         key = "beach"
  else if (/noche|night|brickell|downtown/.test(t))   key = "night"
  else if (/penthouse|interior|sala|cocina/.test(t))  key = "penthouse"
  else if (/moderno|modern|minimalista/.test(t))      key = "modern"
  else if (/inversi|invest|dólares|capital/.test(t))  key = "invest"
  else if (/vendedor|seller|precio|staging/.test(t))  key = "seller"
  else if (/airbnb|vacacional|turista/.test(t))       key = "airbnb"
  else if (/firma|signing|llaves|keys|contrato/.test(t)) key = "signing"

  const baseQuery = PHOTO_QUERIES[key] ?? PHOTO_QUERIES.default
  // Rotate a modifier + result page by the variety seed so distinct posts pull
  // from different slices of Pexels' catalog instead of the same top 8 photos.
  const v = Math.abs(Math.floor(variety))
  const mod = PHOTO_MODIFIERS[v % PHOTO_MODIFIERS.length]
  const query = mod ? `${baseQuery} ${mod}` : baseQuery
  const page = 1 + (v % 3)

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=80&page=${page}&orientation=${orientation}`,
      { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photos: any[] = data?.photos ?? []
    if (!photos.length) return null
    // large2x (1080px wide) — good for both Facebook and Instagram
    const urls = photos
      .map(p => p.src?.large2x ?? p.src?.large ?? p.src?.original)
      .filter(Boolean) as string[]
    // Prefer a photo we haven't used recently; only reuse if every option is taken
    const unused = excludeUrls ? urls.filter(u => !excludeUrls.has(u)) : urls
    const pool = unused.length ? unused : urls
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  } catch {
    return null
  }
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
