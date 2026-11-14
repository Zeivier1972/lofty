/**
 * B-roll that matches what is being said.
 *
 * For each piece of narration Claude writes a short English stock-footage
 * search (Pexels searches in English), always tied to a real Miami / South
 * Florida setting: "Brickell skyline aerial at sunset", "Miami Beach ocean
 * drone", "luxury condo kitchen interior", "couple signing papers at desk".
 * The keyword table in lib/pexels-video (getSceneQuery) stays as the
 * fallback when the model is unavailable.
 */

import Anthropic from "@anthropic-ai/sdk"
import { getSceneQuery } from "@/lib/pexels-video"

const anthropic = new Anthropic()

export async function brollQueriesFor(segments: string[], context = ""): Promise<string[]> {
  const fallback = segments.map(s => getSceneQuery(s))
  if (!segments.length) return []
  try {
    const m = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:
        "You pick stock B-roll for short vertical real-estate videos about Miami and South Florida (Brickell, Downtown Miami, Miami Beach, Coral Gables, Doral, Orlando when mentioned). " +
        "For each numbered narration segment, write ONE Pexels video search in English, 3-6 words, that visually shows what that segment says, set in Miami whenever it fits " +
        "(e.g. 'Brickell skyline aerial sunset', 'Miami Beach ocean drone', 'luxury condo living room view', 'rooftop pool Miami', 'couple signing contract desk', 'airplane landing Miami'). " +
        "Prefer cinematic, bright, aspirational shots; never people's faces close-up, never text, never other cities. " +
        "Return ONLY a JSON array of strings, one per segment, same order.",
      messages: [{ role: "user", content: `${context ? `Video topic: ${context.slice(0, 200)}\n\n` : ""}${segments.map((s, i) => `${i + 1}. ${s.slice(0, 300)}`).join("\n")}` }],
    })
    const text = m.content[0]?.type === "text" ? m.content[0].text : ""
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1))
    if (!Array.isArray(arr)) return fallback
    return segments.map((_, i) => (typeof arr[i] === "string" && arr[i].trim() ? String(arr[i]).trim().slice(0, 80) : fallback[i]))
  } catch {
    return fallback
  }
}

/** Splits narration into n roughly equal pieces by sentence. */
export function splitNarration(text: string, n: number): string[] {
  const sentences = text.split(/(?<=[.!?¿¡])\s+/).filter(Boolean)
  if (sentences.length <= n) return sentences
  const per = Math.ceil(sentences.length / n)
  const out: string[] = []
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per).join(" "))
  return out.slice(0, n)
}
