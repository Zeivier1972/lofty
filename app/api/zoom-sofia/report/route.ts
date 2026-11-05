export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * End of a "Sofía en Zoom" session: saves who attended and every question
 * asked, so Catherine follows up with the people who showed real interest.
 *
 * - One notification (the bell) with the full Q&A.
 * - For each person who asked something and matches exactly one contact by
 *   full name, a note + activity on that contact. Zoom only gives display
 *   names, so ambiguous names are left in the summary, not guessed.
 */

type QA = { name: string; question: string; answer: string; action: string }

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const project = String(body.projectName || "Presentación").slice(0, 120)
  const attendees: string[] = Array.isArray(body.attendees) ? body.attendees.map((a: unknown) => String(a).slice(0, 80)).slice(0, 300) : []
  const qa: QA[] = Array.isArray(body.qa) ? body.qa.slice(0, 300).map((q: any) => ({
    name: String(q.name || "").slice(0, 80),
    question: String(q.question || "").slice(0, 600),
    answer: String(q.answer || "").slice(0, 700),
    action: String(q.action || ""),
  })) : []

  const lines = qa.map(q =>
    `• ${q.name}: ${q.question}\n  ${q.action === "escalate" ? "→ Para Catherine" : `Sofía: ${q.answer}`}`,
  )
  const body1 = [
    `Asistentes (${attendees.length}): ${attendees.join(", ") || "—"}`,
    `Preguntas (${qa.length}):`,
    ...lines,
  ].join("\n")

  await prisma.aINotification.create({
    data: {
      type: "ACTION",
      priority: qa.some(q => q.action === "escalate") ? "HIGH" : "MEDIUM",
      title: `🎥 Resumen de Sofía en Zoom — ${project}`,
      body: body1.slice(0, 8000),
      metadata: JSON.stringify({ project, attendees, qa }).slice(0, 60000),
    },
  })

  let matched = 0
  const byName = new Map<string, QA[]>()
  for (const q of qa) {
    const k = q.name.trim().toLowerCase()
    if (!k) continue
    byName.set(k, [...(byName.get(k) || []), q])
  }
  for (const [name, items] of Array.from(byName)) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length < 2) continue
    const found = await prisma.contact.findMany({
      where: {
        firstName: { equals: parts[0], mode: "insensitive" },
        lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" },
      },
      select: { id: true },
      take: 2,
    })
    if (found.length !== 1) continue
    const contactId = found[0].id
    matched++
    await prisma.note.create({
      data: {
        contactId,
        content: `Preguntas en la presentación de Zoom (${project}):\n` + items.map(i => `- ${i.question}`).join("\n"),
      },
    }).catch(() => {})
    await prisma.activity.create({
      data: {
        type: "NOTE",
        title: `Hizo preguntas en la presentación de ${project}`,
        description: items.map(i => i.question).join(" | ").slice(0, 500),
        contactId,
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, questions: qa.length, attendees: attendees.length, matchedContacts: matched })
}
