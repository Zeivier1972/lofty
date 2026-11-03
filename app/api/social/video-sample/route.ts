export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { researchViralContent } from "@/lib/content-research"
import { contentPlanFor, type ContentPlan } from "@/lib/content-plan"
import { PROJECTS } from "@/lib/projects"
import { startFacelessRender, getRenderStatus, facelessConfigured } from "@/lib/faceless-video"

/**
 * "Generar video de muestra" on the Social page: renders one faceless video
 * WITHOUT publishing it, so Catherine can see the style before the Tue/Fri
 * videos go out. The last sample is kept in Setting("videoSample").
 */

const KEY = "videoSample"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await prisma.setting.findUnique({ where: { key: KEY } })
  if (!row) return NextResponse.json({ sample: null, config: facelessConfigured() })
  const sample = JSON.parse(row.value)
  if (sample.status !== "succeeded" && sample.status !== "failed") {
    const st = await getRenderStatus(sample.renderId)
    sample.status = st.status
    sample.url = st.url || null
    sample.error = st.error || null
    await prisma.setting.update({ where: { key: KEY }, data: { value: JSON.stringify(sample) } })
  }
  return NextResponse.json({ sample, config: facelessConfigured() })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const cfg = facelessConfigured()
  if (!cfg.ok) return NextResponse.json({ error: `Falta configurar: ${cfg.missing.join(", ")}` }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  let plan: ContentPlan = contentPlanFor(now, "evening")
  // Default sample: an international project video (the Colombian audience).
  const project = PROJECTS.find(p => p.href === (body.projectHref || "/house-of-wellness")) || null
  if (project) {
    plan = {
      ...plan,
      audience: "INTERNACIONAL",
      format: "PROYECTO",
      project,
      theme: `presentación del proyecto ${project.name} (${project.place}): ${project.highlight}. ${project.summary}`,
      commentKeyword: "INVERTIR",
    }
  }

  try {
    let research
    try { research = await researchViralContent(now.getDay()) } catch { /* script still works without it */ }
    const r = await startFacelessRender(research, plan)
    const sample = { renderId: r.renderId, status: "planned", url: null, title: r.script.title, hook: r.script.hook, voice: r.script.voice, provider: r.provider, createdAt: now.toISOString() }
    await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(sample) }, update: { value: JSON.stringify(sample) } })
    return NextResponse.json({ ok: true, sample })
  } catch (e: any) {
    console.error("[video-sample]", e)
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 })
  }
}
