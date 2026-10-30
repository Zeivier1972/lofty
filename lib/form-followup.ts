import { prisma } from "@/lib/prisma"
import { detectProject, projectUrl } from "@/lib/projects"

/**
 * "¡Hola! Completé el formulario y me gustaría obtener más información."
 *
 * After someone submits a Meta instant form, the thank-you screen offers a
 * "message us" button with that sentence pre-filled. The person has just given
 * us their name, phone and email, so treating the DM as a stranger (the bot
 * asking "¿Cuál es tu nombre?") repeats the form. These helpers recognise the
 * message, find the lead the form created, and give a reply that picks up from
 * the form instead.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

/** How far back a form submission can be and still be "the form they just filled". */
const MATCH_WINDOW_MS = 3 * 24 * 3600 * 1000

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
}

export function isFormFollowup(text: string): boolean {
  const t = norm(text)
  return /\b(complete|llene|rellene|envie)\s+(el|tu|su|un|the)?\s*(formulario|form)\b/.test(t)
    || /\b(filled out|filled in|completed|submitted)\s+(the|your|a)\s+form\b/.test(t)
}

/**
 * The lead-form contact this DM belongs to, matched by the sender's profile
 * name against contacts created in the last few days that have no Messenger /
 * Instagram identity yet. Only an unambiguous match is returned — linking the
 * wrong person would put one lead's conversation on another's record.
 */
export async function findFormLead(
  channel: "facebook" | "instagram",
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): Promise<{ id: string; firstName: string; lastName: string; campaign: string | null } | null> {
  const first = norm(firstName || "")
  if (!first || first === "facebook" || first === "instagram") return null
  const last = norm(lastName || "")

  const candidates = await prisma.contact.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - MATCH_WINDOW_MS) },
      ...(channel === "facebook" ? { facebookPsid: null } : { instagramIgsid: null }),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  }).catch(() => [])

  let hits = candidates.filter(c => norm(c.firstName).split(" ")[0] === first.split(" ")[0])
  if (hits.length > 1 && last && last !== "lead") {
    const lastFirstWord = last.split(" ")[0]
    hits = hits.filter(c => norm(c.lastName || "").split(" ")[0] === lastFirstWord)
  }
  if (hits.length !== 1) return null

  return { ...hits[0], campaign: await contactCampaign(hits[0].id) }
}

/** The ad campaign a contact came in on, from the note lead ingest writes. */
export async function contactCampaign(contactId: string): Promise<string | null> {
  const note = await prisma.note.findFirst({
    where: { contactId, content: { contains: "[Campaña:" } },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  }).catch(() => null)
  return note?.content.match(/\[Campaña:\s*([^\]]+)\]/)?.[1]?.trim() || null
}

/** The landing page for a campaign's project, or the projects index. */
function projectPage(campaign: string | null): { label: string; url: string } {
  const p = detectProject(campaign)
  return p ? { label: p.name, url: projectUrl(p) } : { label: "nuestros proyectos", url: `${BASE}/proyectos` }
}

export async function formFollowupReply(firstName: string | null, campaign: string | null): Promise<string> {
  const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true } }).catch(() => null)
  const book = cfg?.calendlyUrl || `${BASE}/book`
  const p = projectPage(campaign)
  const hi = firstName && !/^(facebook|instagram)$/i.test(firstName) ? `¡Hola ${firstName.split(" ")[0]}!` : "¡Hola!"
  return `${hi} 🙌 Gracias por completar el formulario, ya tenemos tus datos y Catherine te contactará muy pronto.\n\n` +
    `Mientras tanto, aquí tienes toda la información de ${p.label}:\n${p.url}\n\n` +
    `Si prefieres, agenda de una vez una llamada de 20 minutos con Catherine:\n📅 ${book}`
}

export function formFollowupNotification(name: string, campaign: string | null, platform: "Messenger" | "Instagram") {
  return {
    type: "FORM_FOLLOWUP",
    title: `📝 ${name} llenó el formulario${campaign ? ` de ${campaign}` : ""} y escribió por ${platform}`,
    body: `Envió el mensaje automático de Meta ("Completé el formulario…"). Ya le respondimos con la información y el link para agendar — buen momento para llamarle.`,
    priority: "HIGH" as const,
  }
}
