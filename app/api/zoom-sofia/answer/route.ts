export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"
import { isSofiaBot } from "@/lib/sofia-bot"
import { projectKnowledgeFor } from "@/lib/project-knowledge"
import { PROJECTS } from "@/lib/projects"

/**
 * Sofía's answer to one message in the Zoom chat of a live project
 * presentation. Decides whether to answer, hand it to Catherine, or stay
 * quiet (greetings, "gracias", comments), and only uses the project's real
 * data from lib/project-knowledge — the same facts as the web chat.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

type Decision = { action: "answer" | "escalate" | "skip"; reply: string; note: string }

export async function POST(req: Request) {
  if (!isSofiaBot(req) && !(await auth())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const href = typeof body.project === "string" ? body.project : ""
  const project = PROJECTS.find(p => p.href === href)
  const question = String(body.message || "").slice(0, 800)
  const sender = String(body.senderName || "").slice(0, 80)
  const recent: string[] = Array.isArray(body.recent) ? body.recent.slice(-8).map((m: unknown) => String(m).slice(0, 300)) : []
  if (!project || !question.trim()) return NextResponse.json({ action: "skip", reply: "", note: "" })

  // Parkside: straight to the 15-minute calendar (the quiz page shows it only after the quiz).
  const bookUrl = `${BASE}${project.href === "/parkside" ? "/parkside/colombia/agendar" : "/book"}`
  const knowledge = projectKnowledgeFor(project.href, bookUrl)

  const system = `Eres Sofía, la asistente de Catherine Gomez (Realtor en Miami, licencia de Florida #3320405). Estás en el CHAT de una presentación EN VIVO por Zoom sobre ${project.name} (${project.place}). Catherine está presentando; tú respondes las preguntas del chat para que ella no tenga que parar.

${knowledge}

CÓMO DECIDIR (responde SOLO un JSON):
- "skip": el mensaje no es una pregunta para ti (saludos, "gracias", "se escucha bien", comentarios, emojis, mensajes dirigidos a Catherine personalmente). reply vacío.
- "answer": es una pregunta que puedes contestar con los datos de arriba. Responde tú.
- "escalate": la respuesta requiere a Catherine: negociación o descuentos, disponibilidad o precio de una unidad específica, su situación personal (crédito, impuestos, visa, estructura legal), quejas, o cualquier dato que NO esté arriba. reply = una frase corta y cálida diciendo que Catherine se lo responde en un momento; note = la pregunta resumida para Catherine.

REGLAS DEL CHAT:
- Español (inglés si te escriben en inglés). Máximo 2–3 frases, sin listas largas: es un chat en vivo.
- Llama a la persona por su primer nombre si lo tienes.
- NUNCA inventes precios, fechas, rentabilidad, ocupación ni condiciones. No prometas ingresos ni aprobación de crédito.
- No repitas lo que Catherine está explicando en ese momento; si la pregunta se respondió en el chat reciente, di que sí brevemente.
- Si encaja, invita a agendar una conversación privada de 15 minutos con Catherine, sin compromiso: ${bookUrl}

Formato exacto: {"action":"answer|escalate|skip","reply":"...","note":"..."}`

  const user = [
    recent.length ? `CHAT RECIENTE:\n${recent.join("\n")}` : "",
    `MENSAJE NUEVO de ${sender || "un asistente"}: ${question}`,
  ].filter(Boolean).join("\n\n")

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: user }],
    })
    const text = res.content.find(b => b.type === "text")
    const raw = text?.type === "text" ? text.text : ""
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)
    const d = JSON.parse(json) as Partial<Decision>
    const action = d.action === "answer" || d.action === "escalate" ? d.action : "skip"
    return NextResponse.json({
      action,
      reply: action === "skip" ? "" : String(d.reply || "").slice(0, 700),
      note: String(d.note || "").slice(0, 400),
    })
  } catch (e) {
    console.error("[zoom-sofia/answer]", e)
    // Never leave a question hanging: hand it to Catherine.
    return NextResponse.json({ action: "escalate", reply: "", note: question })
  }
}
