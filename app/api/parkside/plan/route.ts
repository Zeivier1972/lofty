export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"
import { capiSignalsFromRequest } from "@/lib/facebook"
import { isBotSubmission } from "@/lib/spam-guard"
import { CAPITAL, GOALS, PREFS, CLOSING, TIMING, US_BEFORE, buildPlan, usd } from "@/app/parkside/colombia/data"

/**
 * The /parkside/colombia investment-plan funnel — public, no auth.
 *
 * The plan (and the tier) is recomputed here from the answers rather than
 * trusted from the browser. Tags: "Parkside" enrols the Parkside smart plan;
 * "Parkside — Listo/Cerca/Explorando" tells Catherine at a glance who to
 * call first. Every answer and the plan land on the contact as a note.
 */

const pick = (v: unknown, allowed: string[]) =>
  typeof v === "string" && allowed.includes(v) ? v : ""
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""

const TIER_TAG = { A: "Parkside — Listo", B: "Parkside — Cerca", C: "Parkside — Explorando" } as const
const TIER_LABEL = { A: "LISTO para presentación", B: "CERCA (capital o plazo)", C: "EXPLORANDO (nutrir)" } as const

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }
  if (clean(body.website, 200)) return NextResponse.json({ ok: true })

  const firstName = clean(body.firstName, 60)
  const lastName = clean(body.lastName, 60)
  const email = clean(body.email, 120).toLowerCase()
  const phone = clean(body.phone, 30)
  if (isBotSubmission({ fields: [firstName, lastName] })) return NextResponse.json({ ok: true })

  if (!firstName) return NextResponse.json({ error: "Escriba su nombre" }, { status: 400 })
  if (!email && !phone) {
    return NextResponse.json({ error: "Déjenos su WhatsApp o su correo para enviarle su plan" }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El correo no parece válido" }, { status: 400 })
  }

  const capitalLabel = pick(body.capital, CAPITAL.map(c => c[0]))
  const capital = CAPITAL.find(c => c[0] === capitalLabel)?.[1] ?? 0
  const goal = pick(body.goal, GOALS)
  const pref = pick(body.pref, PREFS)
  const closing = pick(body.closing, CLOSING)
  const timing = pick(body.timing, TIMING)
  const usBefore = pick(body.usBefore, US_BEFORE)
  const country = clean(body.country, 40)
  const sourceDetail = clean(body.sourceDetail, 300)
  const campaign = clean(body.utmCampaign, 120)

  const plan = buildPlan(capital, pref, timing)

  const note = [
    `Plan de inversión Parkside (/parkside/colombia) — ${TIER_LABEL[plan.tier]}`,
    country && `País: ${country}`,
    goal && `Objetivo: ${goal}`,
    pref && `Prefiere: ${pref}`,
    capitalLabel && `Capital disponible hoy: ${capitalLabel}`,
    closing && `Pago del cierre (60%): ${closing}`,
    timing && `Plazo: ${timing}`,
    usBefore && `Ha comprado en EE.UU.: ${usBefore}`,
    `Plan mostrado: ${plan.unit.type} desde ${usd(plan.unit.from)} — 20% al contrato ${usd(plan.schedule[0].amount)}, ${usd(plan.beforeClosing)} antes del cierre`,
    plan.wantedButShort && `Quería ${plan.wantedButShort} pero su capital hoy no cubre el 20%`,
  ].filter(Boolean).join(" | ")

  try {
    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      source: "PARKSIDE",
      campaign: campaign || "Parkside — Plan Colombia",
      budget: plan.unit.from,
      location: "Brickell, Miami",
      propertyType: "Condo",
      message: note,
      notes: sourceDetail ? `Origen: ${sourceDetail}` : undefined,
      smsConsent: body.smsConsent === true,
      tags: ["Parkside", TIER_TAG[plan.tier]],
      capi: capiSignalsFromRequest(req),
    })
    return NextResponse.json({ ok: true, contactId, isNew, tier: plan.tier })
  } catch (e) {
    console.error("[parkside/plan]", e)
    return NextResponse.json(
      { error: "No pudimos guardar su plan. Escríbanos por WhatsApp y le atendemos de inmediato." },
      { status: 500 },
    )
  }
}
