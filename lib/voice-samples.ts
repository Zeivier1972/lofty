import { prisma } from "@/lib/prisma"

/**
 * Catherine's own words, so the Auto-Pilot writes like her and not like an AI.
 *
 * Once a day this reads her latest Instagram captions (Instagram API with
 * Instagram Login, the same token the DM bot uses), drops the ones the
 * Auto-Pilot itself published, and keeps the ones she wrote. They go into the
 * post prompt as tone examples. Cached in a Setting row; when Instagram can't
 * be reached the last good set is used, and with none the prompt simply goes
 * without examples.
 */

const IG_API = "https://graph.instagram.com/v23.0"
const KEY = "voice_samples_v1"
const MAX_AGE_MS = 24 * 3600 * 1000
const KEEP = 8

type Cache = { at: string; samples: string[] }

async function readCache(): Promise<Cache | null> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null)
  if (!row?.value) return null
  try { return JSON.parse(row.value) as Cache } catch { return null }
}

async function fetchFromInstagram(): Promise<string[] | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`${IG_API}/me/media?fields=id,caption,timestamp&limit=40`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.warn(`[voice-samples] Instagram media fetch failed: ${res.status}`)
      return null
    }
    const data = await res.json()
    const items: { id: string; caption?: string }[] = Array.isArray(data?.data) ? data.data : []

    // Skip what the Auto-Pilot published — those are the AI's words, not hers.
    const ours = await prisma.socialPost.findMany({
      where: { externalId: { in: items.map(i => i.id) } },
      select: { externalId: true },
    }).catch(() => [])
    const ourIds = new Set(ours.map(o => o.externalId))

    return items
      .filter(i => !ourIds.has(i.id) && i.caption && i.caption.trim().length >= 60)
      // Hashtag blocks are not her voice; keep the words.
      .map(i => i.caption!.replace(/(\s*#[^\s#]+)+\s*$/, "").trim().slice(0, 600))
      .filter(c => c.length >= 60)
      .slice(0, KEEP)
  } catch (e) {
    console.warn("[voice-samples] Instagram media fetch error:", e)
    return null
  }
}

/** Up to 8 recent captions Catherine wrote herself (refreshed daily). */
export async function getVoiceSamples(): Promise<string[]> {
  const cached = await readCache()
  if (cached && Date.now() - new Date(cached.at).getTime() < MAX_AGE_MS) return cached.samples
  const fresh = await fetchFromInstagram()
  if (fresh && fresh.length) {
    const value = JSON.stringify({ at: new Date().toISOString(), samples: fresh } satisfies Cache)
    await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } }).catch(() => {})
    console.log(`[voice-samples] refreshed ${fresh.length} captions from Instagram`)
    return fresh
  }
  return cached?.samples ?? []
}

/** Prompt block with her captions as tone examples, or "" when there are none. */
export function voiceBlock(samples: string[]): string {
  if (!samples.length) return ""
  return `EJEMPLOS DE CÓMO ESCRIBE CATHERINE (son sus publicaciones reales). Imita su tono, sus expresiones y su forma de hablarle a la gente; NO copies frases enteras ni repitas sus temas:\n${samples.map((s, i) => `--- ${i + 1} ---\n${s}`).join("\n")}`
}
