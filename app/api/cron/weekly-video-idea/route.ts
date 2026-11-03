export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { researchViralContent } from "@/lib/content-research"
import { contentPlanFor } from "@/lib/content-plan"
import { writeShortScript, WEEKLY_SCRIPT_KEY, WEBINAR_SERIES_URL } from "@/lib/faceless-video"
import { sendEmail, wrapEmail } from "@/lib/email"

/**
 * Monday 9:30 AM ET: the week's viral idea and a ready-to-read 40-second
 * script, emailed to Catherine. If she records it she posts her own version
 * (real face wins); either way Tuesday's automatic video uses this script.
 */
function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  return req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("secret") === secret
}

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tuesday = new Date(Date.now() + 86400000)
  const plan = contentPlanFor(tuesday, "evening")
  let research
  try { research = await researchViralContent(tuesday.getDay()) } catch { /* fine */ }
  const script = await writeShortScript(research, plan)

  await prisma.setting.upsert({
    where: { key: WEEKLY_SCRIPT_KEY },
    create: { key: WEEKLY_SCRIPT_KEY, value: JSON.stringify({ script, createdAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ script, createdAt: new Date().toISOString() }) },
  })

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorEmail: true } }).catch(() => null)
  const to = cfg?.realtorEmail || process.env.AGENT_EMAIL
  if (!to) return NextResponse.json({ ok: true, emailed: false, reason: "no realtorEmail", script })

  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  const ok = await sendEmail({
    to,
    transactional: true,
    subject: `🎬 Video de la semana: ${script.title}`,
    html: wrapEmail(`
      <p>Hola Catherine,</p>
      <p>Esta es la idea viral de esta semana (recreada del formato que más está funcionando en YouTube para tu nicho). <strong>El martes a las 6 PM sale automáticamente</strong> como video con voz profesional y renders de tus proyectos.</p>
      <p>Si quieres que funcione aún mejor, <strong>grábalo tú</strong> con el celular en vertical (40 segundos) y publícalo tú misma — tu cara genera más confianza que cualquier voz.</p>
      <p style="font-size:13px;color:#64748b;margin-bottom:4px">TEXTO EN PANTALLA (primeros 3 segundos)</p>
      <p style="font-size:18px;font-weight:800;margin-top:0">${esc(script.hook)}</p>
      <p style="font-size:13px;color:#64748b;margin-bottom:4px">GUION (léelo con naturalidad, no de memoria)</p>
      <p style="font-size:16px;line-height:1.6;background:#f8fafc;padding:14px;border-radius:10px;margin-top:0">${esc(script.voice)}</p>
      <p style="font-size:13px;color:#64748b;margin-bottom:4px">TÍTULO PARA YOUTUBE</p>
      <p style="margin-top:0"><strong>${esc(script.title)}</strong></p>
      <p style="font-size:13px;color:#64748b">En la descripción pon el enlace del webinar: ${WEBINAR_SERIES_URL}</p>`,
      { agentName: "CASAi" }),
  }).catch(() => false)

  return NextResponse.json({ ok: true, emailed: ok, title: script.title })
}
