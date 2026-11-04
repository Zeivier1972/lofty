export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"
import { capiSignalsFromRequest } from "@/lib/facebook"
import { isBotSubmission } from "@/lib/spam-guard"

/**
 * The "¿Cuánta casa puedo comprar?" quiz on /primera-casa — public, no auth.
 *
 * The person has already seen their estimate on screen when this runs; this
 * only saves them. Through `ingestLead` (dedupe, welcome, pipeline, CAPI Lead)
 * like every other campaign, tagged "Primera Casa" so a CONTACT_TAGGED smart
 * plan can follow up, with every answer and the estimate as a note so
 * Catherine opens the record already knowing the numbers.
 */

const CREDIT = ["740 o más", "680 – 739", "620 – 679", "580 – 619", "Menos de 580", "No lo sé"]
const TIMING = ["En los próximos 3 meses", "En 3 a 6 meses", "En 6 a 12 meses", "Solo estoy explorando"]
const AREAS = ["Miami-Dade", "Broward", "Palm Beach", "Orlando / Centro de Florida", "Aún no lo sé"]
const YESNO = ["Sí", "No"]

const pick = (v: unknown, allowed: string[]) =>
  typeof v === "string" && allowed.includes(v) ? v : ""
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""
const money = (v: unknown, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null
}
const usd = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`)

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  // Honeypot — silent "ok" so a bot learns nothing.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true })

  const firstName = clean(body.firstName, 60)
  const lastName = clean(body.lastName, 60)
  const email = clean(body.email, 120).toLowerCase()
  const phone = clean(body.phone, 30)

  if (isBotSubmission({ fields: [firstName, lastName] })) return NextResponse.json({ ok: true })

  if (!firstName) return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 })
  if (!email && !phone) {
    return NextResponse.json({ error: "Déjanos tu correo o tu WhatsApp para enviarte tu resultado" }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El correo no parece válido" }, { status: 400 })
  }

  const income = money(body.income, 5_000_000)
  const debts = money(body.debts, 100_000)
  const savings = money(body.savings, 5_000_000)
  const priceLow = money(body.priceLow, 10_000_000)
  const priceHigh = money(body.priceHigh, 10_000_000)
  const monthly = money(body.monthly, 100_000)
  const credit = pick(body.credit, CREDIT)
  const timing = pick(body.timing, TIMING)
  const area = pick(body.area, AREAS)
  const firstTime = pick(body.firstTime, YESNO)
  const sourceDetail = clean(body.sourceDetail, 300)
  const campaign = clean(body.utmCampaign, 120)

  const answers = [
    "Calculadora — ¿Cuánta casa puedo comprar? (/primera-casa)",
    `Ingreso anual del hogar: ${usd(income)}`,
    `Deudas mensuales: ${usd(debts)}`,
    `Ahorros para la compra: ${usd(savings)}`,
    credit && `Crédito: ${credit}`,
    firstTime && `Primera vivienda: ${firstTime}`,
    area && `Área: ${area}`,
    timing && `Plazo: ${timing}`,
    priceHigh ? `Estimado mostrado: ${usd(priceLow)} – ${usd(priceHigh)}, pago aprox. ${usd(monthly)}/mes` : null,
  ].filter(Boolean).join(" | ")

  try {
    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      source: "PRIMERA_CASA",
      campaign: campaign || "Primera Casa",
      budget: priceHigh,
      location: area && area !== "Aún no lo sé" ? area : undefined,
      propertyType: "Single Family",
      message: answers,
      notes: sourceDetail ? `Origen: ${sourceDetail}` : undefined,
      smsConsent: body.smsConsent === true,
      tags: ["Primera Casa", ...(firstTime === "Sí" ? ["First-Time Buyer"] : [])],
      capi: capiSignalsFromRequest(req),
    })
    return NextResponse.json({ ok: true, contactId, isNew })
  } catch (e) {
    console.error("[primera-casa/lead]", e)
    return NextResponse.json(
      { error: "No pudimos guardar tu resultado. Escríbenos por WhatsApp y te atendemos de inmediato." },
      { status: 500 },
    )
  }
}
