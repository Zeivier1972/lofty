export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { isAssignedToPartner } from "@/lib/referral"
import { computeBuyerIntent } from "@/lib/buyer-intent"
import { markHot, resumeQuietWarmPlans } from "@/lib/lead-flow"

// Daily (~noon ET): the buy-now playbook.
//
// Every lead whose recent behaviour says "buying now" (see lib/buyer-intent —
// saved/re-viewed homes, saved search, email clicks, a reply this week, a
// short stated timeline) and who has NOT booked yet gets, in this order:
//   1. a call task for Catherine due today, with the reasons and an opener —
//      a human call within hours is what converts a hot lead;
//   2. a short personal message from Sofía that references what they were
//      looking at and asks for a 15-minute call with Catherine;
//   3. a move to the Hot stage (from early stages only), so the pipeline shows it.
// Once per lead every 3 days, capped per run. Texts go through the automated
// path (kill switch, monthly cap, 20h cooldown, dedupe) and only in daytime.

const PER_RUN_CAP = 25
const COOLDOWN_DAYS = 3

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret && header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Warm leads that replied once and went quiet get their plan back first.
  const resumed = await resumeQuietWarmPlans().catch(e => { console.error("[hot-buyer-followup] resume failed:", e); return 0 })

  const hot = (await computeBuyerIntent()).filter(l => l.level === "HOT" && !l.upcomingAppointment)
  if (!hot.length) return NextResponse.json({ ok: true, followedUp: 0, resumed, reason: "no hot buyers" })

  const since = new Date(Date.now() - COOLDOWN_DAYS * 86400000)
  const recent = await prisma.activity.findMany({
    where: { type: "HOT_BUYER_FOLLOWUP", contactId: { in: hot.map(h => h.contactId) }, createdAt: { gte: since } },
    select: { contactId: true },
  }).catch(() => [])
  const recentSet = new Set(recent.map(r => r.contactId))
  const due = hot.filter(h => !recentSet.has(h.contactId)).slice(0, PER_RUN_CAP)

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true, realtorEmail: true, calendlyUrl: true } }).catch(() => null)
  const agentName = (cfg?.realtorName || "Catherine").split(" ")[0]
  const agentPhone = cfg?.realtorPhone || "305-283-0872"
  const bookUrl = cfg?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book`
  const agent = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } })

  let sms = 0, email = 0, tasks = 0, promoted = 0
  for (const lead of due) {
    const partner = await isAssignedToPartner(lead.contactId).catch(() => false)
    const why = lead.reasons.join(", ")

    // 1. Catherine calls today — unless the lead is a partner's.
    if (!partner && lead.canCall) {
      const open = await prisma.task.findFirst({
        where: { contactId: lead.contactId, status: "PENDING", title: { startsWith: "🔥 Llamar hoy" } },
        select: { id: true },
      })
      if (!open) {
        const endOfDay = new Date()
        endOfDay.setUTCHours(23, 0, 0, 0)
        await prisma.task.create({
          data: {
            title: `🔥 Llamar hoy: ${lead.firstName} ${lead.lastName || ""}`.trim(),
            description:
              `Listo(a) para comprar — ${why}.\n` +
              `Tel: ${lead.phone}\n\n` +
              `Para abrir: "Hola ${lead.firstName}, soy ${agentName}. Vi que estás mirando ${lead.hook} y quería ayudarte personalmente. ` +
              `¿Qué es lo que más te gustó? ¿Ya tienes tu pre-aprobación o te ayudo con eso?"\n` +
              `Meta: agendar visita a las casas o una consulta de compra.`,
            priority: "HIGH",
            status: "PENDING",
            type: "CALL",
            contactId: lead.contactId,
            dueDate: endOfDay,
            ...(agent && { assignedToId: agent.id }),
          },
        })
        tasks++
      }
      await prisma.aINotification.create({
        data: {
          type: "HOT_BUYER",
          title: `🔥 ${lead.firstName} ${lead.lastName || ""} está listo(a) para comprar`.replace(/\s+/g, " "),
          body: `${why}. Llamar hoy: ${lead.phone}`,
          priority: "HIGH",
          contactId: lead.contactId,
        },
      }).catch(() => {})
    }

    // 2. Sofía asks for the call, referencing what they looked at — unless
    // Catherine is already working with them (a recent appointment, or a stage
    // past Appointment Set). Catherine still gets the call task above.
    const working = await prisma.contact.findFirst({
      where: {
        id: lead.contactId,
        OR: [
          { appointments: { some: { status: { not: "CANCELLED" }, startTime: { gte: new Date(Date.now() - 45 * 86400000) } } } },
          { pipelineLeads: { some: { stage: { name: { in: ["Appointment Set", "Showing", "Pending", "Pre approval"] } } } } },
        ],
      },
      select: { id: true },
    })
    let sent = false
    if (working) {
      // no outreach from Sofía
    } else if (lead.canText) {
      const body = `Hola ${lead.firstName}, soy Sofia del equipo de ${agentName} Gomez. Vi ${lead.hook}. ${agentName} puede llamarte 15 min para contarte lo que no sale en el anuncio y ayudarte a verlas. ¿Te queda mejor hoy o mañana? Elige tu hora: ${bookUrl}`
      const sid = await sendSMS(lead.phone!, body, undefined, { automated: true, contactId: lead.contactId, quietHours: true }).catch(() => null)
      if (sid) { sms++; sent = true }
    }
    if (!working && !sent && lead.canEmail) {
      const html = wrapEmail(`
        <p style="color:#374151;font-size:15px;margin:0 0 12px">¡Hola ${lead.firstName}! 👋</p>
        <p style="color:#374151;font-size:14px;margin:0 0 16px">
          Soy Sofía, del equipo de ${agentName} Gomez. Vi ${lead.hook}, y ${agentName} quiere ayudarte personalmente:
          en una llamada de 15 minutos te cuenta lo que no sale en el anuncio (precio real, ofertas, HOA, competencia)
          y organiza las visitas contigo.
        </p>
        <a href="${bookUrl}" style="background:#c9a84c;color:#0a0e1a;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 0 16px">Elegir mi hora con ${agentName} →</a>
        <p style="color:#6b7280;font-size:14px;margin:0">¿Prefieres que te llamemos? Responde a este correo con tu mejor horario. 📞 ${agentPhone}</p>
      `, { agentName, agentPhone, agentEmail: cfg?.realtorEmail || "" })
      const ok = await sendEmail({ to: lead.email!, subject: `${lead.firstName}, ¿hablamos 15 minutos sobre tu búsqueda?`, html }).catch(() => false)
      if (ok) { email++; sent = true }
    }

    // 3. Pipeline shows it.
    if (await markHot(lead.contactId).catch(() => false)) promoted++

    await prisma.activity.create({
      data: {
        type: "HOT_BUYER_FOLLOWUP",
        title: "Comprador listo para comprar detectado",
        description: `${why}.${sent ? " Sofía le invitó a una llamada con Catherine." : ""}`,
        contactId: lead.contactId,
      },
    }).catch(() => {})
  }

  console.log(`[hot-buyer-followup] hot=${hot.length} handled=${due.length} tasks=${tasks} SMS=${sms} email=${email} promoted=${promoted} resumed=${resumed}`)
  return NextResponse.json({ ok: true, hot: hot.length, handled: due.length, tasks, sms, email, promoted, resumed })
}
