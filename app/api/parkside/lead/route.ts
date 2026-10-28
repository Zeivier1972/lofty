export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"
import { capiSignalsFromRequest } from "@/lib/facebook"

/**
 * Qualification form on /parkside — public, no auth.
 *
 * Goes through `ingestLead` rather than /api/leads/capture: capture creates a
 * fresh Contact without the dedupe/un-archive/tag handling, and ingestLead is
 * what every other campaign (Facebook forms, webinars) already uses, so the
 * welcome, notifications and pipeline placement behave the same here. The
 * `Parkside` tag is what a CONTACT_TAGGED smart plan can hang off later.
 *
 * Every answer is stored as a note on the contact, so Catherine opens the
 * record already knowing budget, timing and goal before she calls.
 */

/** Fixed answer sets. Public endpoint: anything else is dropped, not stored. */
const BUDGETS: Record<string, number | null> = {
  "Menos de US$500,000": 500000,
  "US$500,000 – US$750,000": 750000,
  "US$750,000 – US$1,000,000": 1000000,
  "Más de US$1,000,000": 1500000,
  "Prefiero conversarlo": null,
}
const GOALS = ["Renta / inversión", "Vivienda propia o vacacional", "Ambas", "Diversificar patrimonio en dólares", "Aún no lo he definido"]
const UNIT_TYPES = ["Estudio", "1 habitación", "2 habitaciones", "Aún no lo sé"]
const PAYMENT = ["Contado", "Financiamiento", "Aún no lo sé"]
const TIMING = ["En los próximos 3 meses", "En 3 a 6 meses", "En 6 a 12 meses", "Solo estoy explorando"]

const pick = (v: unknown, allowed: string[]) =>
  typeof v === "string" && allowed.includes(v) ? v : ""
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  // Honeypot: real people never see this field, so a value means a bot. Answer
  // as if it worked so the bot has nothing to learn from.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true })

  const firstName = clean(body.firstName, 60)
  const lastName = clean(body.lastName, 60)
  const email = clean(body.email, 120).toLowerCase()
  const phone = clean(body.phone, 30)

  if (!firstName) return NextResponse.json({ error: "Escriba su nombre" }, { status: 400 })
  if (!email && !phone) {
    return NextResponse.json({ error: "Déjenos un correo o un WhatsApp para enviarle el análisis" }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El correo no parece válido" }, { status: 400 })
  }

  const country = clean(body.country, 60)
  const budgetLabel = pick(body.budget, Object.keys(BUDGETS))
  const goal = pick(body.goal, GOALS)
  const unitType = pick(body.unitType, UNIT_TYPES)
  const payment = pick(body.payment, PAYMENT)
  const timing = pick(body.timing, TIMING)
  const message = clean(body.message, 600)
  const sourceDetail = clean(body.sourceDetail, 300)
  const campaign = clean(body.utmCampaign, 120)

  const answers = [
    "Solicitud de análisis — Parkside Residences at Brickell",
    country && `País de residencia: ${country}`,
    goal && `Objetivo: ${goal}`,
    budgetLabel && `Presupuesto: ${budgetLabel}`,
    unitType && `Tipo de residencia: ${unitType}`,
    payment && `Forma de pago: ${payment}`,
    timing && `Plazo: ${timing}`,
    message && `Mensaje: ${message}`,
  ].filter(Boolean).join(" | ")

  try {
    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      source: "PARKSIDE",
      campaign: campaign || "Parkside Residences at Brickell",
      budget: budgetLabel ? BUDGETS[budgetLabel] : null,
      // Without a location ingestLead defaults the buyer search to
      // Miami + Homestead, which is not what this person asked about.
      location: "Brickell, Miami",
      propertyType: "Condo",
      message: answers,
      notes: sourceDetail ? `Origen: ${sourceDetail}` : undefined,
      smsConsent: body.smsConsent === true,
      tags: ["Parkside"],
      capi: capiSignalsFromRequest(req),
    })
    return NextResponse.json({ ok: true, contactId, isNew })
  } catch (e) {
    console.error("[parkside/lead]", e)
    return NextResponse.json(
      { error: "No pudimos registrar su solicitud. Escríbanos por WhatsApp y le atendemos de inmediato." },
      { status: 500 },
    )
  }
}
