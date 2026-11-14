export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * POST /api/heygen/capabilities — "Probar HeyGen" on Social → Accounts.
 *
 * Finds out what Catherine's HeyGen API key can actually do, WITHOUT making a
 * video: read-only calls (balance, avatars, templates) plus deliberately
 * incomplete create requests. HeyGen validates a request before it starts a
 * render, so an incomplete body comes back 400/422 with what is missing
 * (= the endpoint exists and this key may use it); 404 = not available;
 * 401 = key rejected; 402/403 = plan or permission. Nothing is rendered.
 */

type Probe = { name: string; method: "GET" | "POST"; path: string; body?: unknown }

const PROBES: Probe[] = [
  { name: "Saldo de la API", method: "GET", path: "/v2/user/remaining_quota" },
  { name: "Avatares y looks", method: "GET", path: "/v2/avatars" },
  { name: "Voces", method: "GET", path: "/v2/voices" },
  { name: "Plantillas (templates)", method: "GET", path: "/v2/templates" },
  { name: "Video Agent (prompt → video)", method: "POST", path: "/v3/video-agents", body: {} },
  { name: "Video por escenas 16:9 1080p", method: "POST", path: "/v3/videos", body: { type: "studio", aspect_ratio: "16:9", resolution: "1080p", scenes: [] } },
  { name: "Video por escenas 16:9 4K", method: "POST", path: "/v3/videos", body: { type: "studio", aspect_ratio: "16:9", resolution: "4k", scenes: [] } },
  { name: "Modelo texto→video (B-roll IA)", method: "POST", path: "/v3/models/videos", body: {} },
  { name: "Brand kits", method: "GET", path: "/v3/brand-kits" },
]

function verdict(status: number, method: string): string {
  if (status === 401) return "La clave de API fue rechazada"
  if (status === 402) return "Sin saldo o requiere un plan superior"
  if (status === 403) return "Tu plan o tu clave no tienen permiso"
  if (status === 404) return "No disponible en la API"
  if (status === 429) return "Límite de uso: probar más tarde"
  if (method === "POST" && (status === 400 || status === 422)) return "Disponible (respondió validando la solicitud)"
  if (status >= 200 && status < 300) return method === "POST" ? "Disponible (¡aceptó la solicitud!)" : "Disponible"
  return `Respuesta ${status}`
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const key = process.env.HEYGEN_API_KEY
  if (!key) return NextResponse.json({ error: "HEYGEN_API_KEY no está configurada" }, { status: 400 })

  const results = await Promise.all(PROBES.map(async p => {
    try {
      const res = await fetch(`https://api.heygen.com${p.path}`, {
        method: p.method,
        headers: { "X-Api-Key": key, Accept: "application/json", ...(p.body ? { "Content-Type": "application/json" } : {}) },
        body: p.body ? JSON.stringify(p.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      })
      const text = await res.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { /* not JSON */ }
      let summary = ""
      if (p.path === "/v2/user/remaining_quota" && res.ok) summary = `Saldo: ${JSON.stringify(data?.data ?? data).slice(0, 200)}`
      else if (p.path === "/v2/avatars" && res.ok) {
        const all = [...(data?.data?.avatars ?? []).map((a: any) => a.avatar_name), ...(data?.data?.talking_photos ?? []).map((t: any) => t.talking_photo_name)]
        const yellow = all.filter((n: string) => /yellow|amarill/i.test(n || ""))
        summary = `${all.length} avatares/looks. ${yellow.length ? `Vestido amarillo: ${yellow.join(", ")}` : "No encontré un look con 'yellow' en el nombre."}`
      } else if (p.path === "/v2/voices" && res.ok) summary = `${(data?.data?.voices ?? []).length} voces`
      else if (p.path === "/v2/templates" && res.ok) summary = `${(data?.data?.templates ?? []).length} plantillas: ${(data?.data?.templates ?? []).slice(0, 5).map((t: any) => t.name).join(", ")}`
      else summary = (data ? JSON.stringify(data?.error ?? data) : text).slice(0, 500)
      return { name: p.name, request: `${p.method} ${p.path}`, status: res.status, verdict: verdict(res.status, p.method), summary }
    } catch (e: any) {
      return { name: p.name, request: `${p.method} ${p.path}`, status: 0, verdict: "Sin respuesta", summary: String(e?.message || e).slice(0, 200) }
    }
  }))

  console.log(`[heygen-capabilities] ${results.map(r => `${r.request}=${r.status}`).join(" ")}`)
  return NextResponse.json({ results })
}
