export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { SOFIA_BOT_HEADER, SOFIA_BOT_URL } from "@/lib/sofia-bot"

/**
 * Control of the Sofía Zoom bot (native Meeting SDK, separate Railway
 * service) for /sofia-zoom. Logged-in CRM users only; the bot itself is only
 * reachable on Railway's private network with the shared secret.
 *
 * GET  → bot status (state, attendees, Q&A, event log)
 * POST { action: "join", meetingNumber, password, project, welcome }
 *      { action: "leave" } | { action: "pause", paused } | { action: "say", text }
 */

async function bot(path: string, init?: RequestInit) {
  if (!SOFIA_BOT_URL || !process.env.SOFIA_BOT_SECRET) {
    return NextResponse.json({ error: "Falta configurar SOFIA_BOT_URL y SOFIA_BOT_SECRET en Railway." }, { status: 500 })
  }
  try {
    const res = await fetch(`${SOFIA_BOT_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", [SOFIA_BOT_HEADER]: process.env.SOFIA_BOT_SECRET },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    console.error("[zoom-sofia/bot]", e)
    return NextResponse.json({ error: "El servicio de Sofía no responde. Revisa que sofia-zoom-bot esté activo en Railway." }, { status: 502 })
  }
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  return bot("/status")
}

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || "")

  if (action === "join") {
    const project = PROJECTS.find(p => p.href === body.project)
    if (!project) return NextResponse.json({ error: "Elige el proyecto" }, { status: 400 })
    return bot("/join", {
      method: "POST",
      body: JSON.stringify({
        meetingNumber: String(body.meetingNumber || ""),
        password: String(body.password || ""),
        project: project.href,
        projectName: project.name,
        welcome: String(body.welcome || "").slice(0, 500),
      }),
    })
  }
  if (action === "leave") return bot("/leave", { method: "POST", body: "{}" })
  if (action === "pause") return bot("/pause", { method: "POST", body: JSON.stringify({ paused: Boolean(body.paused) }) })
  if (action === "say") return bot("/say", { method: "POST", body: JSON.stringify({ text: String(body.text || "").slice(0, 1000) }) })
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
}
