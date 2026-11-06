import { prisma } from "@/lib/prisma"
import { pauseSofia } from "@/lib/sofia-control"

/**
 * Insults and threats in an inbound message.
 *
 * Sofía answered every message, so a lead hurling insults got a cheerful sales
 * reply each time, which makes it worse and looks terrible. On a match she stops:
 * no reply, Sofía paused for that contact (drips, calls, auto-replies), and
 * Catherine gets a high-priority bell to decide herself.
 *
 * Whole words only, accents folded, so "disputa" or "computadora" never match.
 * "marica" alone is left out on purpose: in Colombia it is often friendly slang.
 */
const ABUSE = [
  "hijueputa", "hijueputas", "hijo de puta", "hija de puta", "hdp", "malparido", "malparida", "malparidos",
  "gonorrea", "perra", "perras", "puta", "putas", "zorra", "pendejo", "pendeja", "pendejos", "pendejas",
  "maricon", "maricona", "maricones", "muerete", "muéranse", "muerase", "te voy a matar", "los voy a matar",
  "idiota", "estupido", "estupida", "imbecil", "mierda", "careverga", "carechimba", "gonorreas",
  "fuck", "fucking", "bitch", "motherfucker", "asshole",
].map(w => w.normalize("NFD").replace(/[̀-ͯ]/g, ""))

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export function isAbusive(text: string): boolean {
  const t = ` ${fold(text).replace(/[^a-z0-9ñ]+/g, " ")} `
  return ABUSE.some(w => t.includes(` ${w} `))
}

/**
 * Stop Sofía for this contact and tell Catherine. Returns true when it handled
 * the message (the caller must then send nothing).
 */
export async function stopOnAbuse(opts: {
  text: string
  contactId?: string | null
  who: string
  channel: string
}): Promise<boolean> {
  if (!isAbusive(opts.text)) return false
  if (opts.contactId) {
    const c = await prisma.contact.findUnique({ where: { id: opts.contactId }, select: { sofiaPausedAt: true } }).catch(() => null)
    if (c && !c.sofiaPausedAt) {
      await pauseSofia(opts.contactId, "automático", `Mensaje ofensivo por ${opts.channel}: "${opts.text.slice(0, 120)}"`).catch(e => console.error("[abuse] pause failed:", e))
    }
  }
  await prisma.aINotification.create({
    data: {
      type: "LEAD_REPLY",
      title: `⚠️ ${opts.who} escribió con insultos — Sofía no respondió y quedó en pausa`,
      body: `Por ${opts.channel}: "${opts.text.slice(0, 200)}". Tú decides si contestar, bloquear o reactivar a Sofía.`,
      priority: "HIGH",
      ...(opts.contactId ? { contactId: opts.contactId } : {}),
    },
  }).catch(() => {})
  console.log(`[abuse] ${opts.channel} message from ${opts.who} — Sofía stopped`)
  return true
}
