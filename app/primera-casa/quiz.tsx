"use client"

/**
 * The /primera-casa funnel: 7 one-tap questions → contact details → the
 * estimate on screen → Catherine's calendar right under it.
 *
 * One question per screen with big buttons, because this traffic is a phone
 * thumb coming from a Facebook/Instagram ad. The estimate is shown only after
 * the contact step (that is the exchange), and the calendar appears in the
 * same moment the person is most interested: when they see their number.
 */

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { CREDIT_BANDS, estimate, usd, type CreditBand } from "./estimate"
import BookingForm from "./booking-form"

const AREAS = ["Miami-Dade", "Broward", "Palm Beach", "Orlando / Centro de Florida", "Aún no lo sé"]
const TIMING = ["En los próximos 3 meses", "En 3 a 6 meses", "En 6 a 12 meses", "Solo estoy explorando"]

const INCOME_OPTIONS: [string, number][] = [
  ["Menos de $40,000", 35000],
  ["$40,000 – $60,000", 50000],
  ["$60,000 – $80,000", 70000],
  ["$80,000 – $100,000", 90000],
  ["$100,000 – $150,000", 125000],
  ["Más de $150,000", 175000],
]
const DEBT_OPTIONS: [string, number][] = [
  ["No tengo deudas", 0],
  ["Menos de $300", 200],
  ["$300 – $600", 450],
  ["$600 – $1,000", 800],
  ["Más de $1,000", 1300],
]
const SAVINGS_OPTIONS: [string, number][] = [
  ["Menos de $5,000", 2500],
  ["$5,000 – $15,000", 10000],
  ["$15,000 – $30,000", 22500],
  ["$30,000 – $60,000", 45000],
  ["Más de $60,000", 75000],
]

type Answers = {
  firstTime: "Sí" | "No" | ""
  income: number | null
  debts: number | null
  savings: number | null
  credit: CreditBand | ""
  area: string
  timing: string
}

function campaignDetail(): { detail: string; utmCampaign: string } {
  if (typeof window === "undefined") return { detail: "", utmCampaign: "" }
  const q = new URLSearchParams(window.location.search)
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]
  const parts = keys.map(k => (q.get(k) ? `${k}=${q.get(k)}` : "")).filter(Boolean)
  if (!parts.length && document.referrer) parts.push(`referrer=${document.referrer}`)
  return { detail: ["pagina=/primera-casa", ...parts].join(" · "), utmCampaign: q.get("utm_campaign") || "" }
}

function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "w-full rounded-xl border-2 px-5 py-4 text-left text-base font-medium transition",
        active ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-800 hover:border-emerald-400",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

export default function Quiz({ whatsappUrl }: { whatsappUrl: string }) {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>({ firstTime: "", income: null, debts: null, savings: null, credit: "", area: "", timing: "" })
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "", website: "" })
  const [smsConsent, setSmsConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [source, setSource] = useState({ detail: "", utmCampaign: "" })

  const result = useMemo(() => {
    if (a.income == null || a.debts == null || a.savings == null || !a.credit) return null
    return estimate({ annualIncome: a.income, monthlyDebts: a.debts, savings: a.savings, credit: a.credit })
  }, [a])

  const choose = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    setA(prev => ({ ...prev, [k]: v }))
    setStep(s => s + 1)
  }

  const QUESTIONS: { title: string; hint?: string; body: React.ReactNode }[] = [
    {
      title: "¿Es tu primera casa?",
      hint: "Si no has sido dueño de una vivienda en los últimos 3 años, cuentas como comprador de primera vez.",
      body: (["Sí", "No"] as const).map(v => <Choice key={v} label={v} active={a.firstTime === v} onClick={() => choose("firstTime", v)} />),
    },
    {
      title: "¿Cuánto gana tu hogar al año, antes de impuestos?",
      hint: "Suma los ingresos de todos los que estarían en el préstamo.",
      body: INCOME_OPTIONS.map(([l, v]) => <Choice key={l} label={l} active={a.income === v} onClick={() => choose("income", v)} />),
    },
    {
      title: "¿Cuánto pagas al mes en deudas?",
      hint: "Carro, tarjetas de crédito, préstamos estudiantiles o personales. No incluyas la renta.",
      body: DEBT_OPTIONS.map(([l, v]) => <Choice key={l} label={l} active={a.debts === v} onClick={() => choose("debts", v)} />),
    },
    {
      title: "¿Cuánto tienes ahorrado para la compra?",
      hint: "Para el pago inicial y los gastos de cierre.",
      body: SAVINGS_OPTIONS.map(([l, v]) => <Choice key={l} label={l} active={a.savings === v} onClick={() => choose("savings", v)} />),
    },
    {
      title: "¿Cuál es tu puntaje de crédito aproximado?",
      hint: "Si no lo sabes, no pasa nada — Catherine te ayuda a revisarlo.",
      body: CREDIT_BANDS.map(v => <Choice key={v} label={v} active={a.credit === v} onClick={() => choose("credit", v)} />),
    },
    {
      title: "¿Dónde te gustaría comprar?",
      body: AREAS.map(v => <Choice key={v} label={v} active={a.area === v} onClick={() => choose("area", v)} />),
    },
    {
      title: "¿Cuándo te gustaría comprar?",
      body: TIMING.map(v => <Choice key={v} label={v} active={a.timing === v} onClick={() => choose("timing", v)} />),
    },
  ]
  const CONTACT_STEP = QUESTIONS.length
  const total = QUESTIONS.length + 1

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (!contact.firstName.trim()) return setError("Escribe tu nombre.")
    if (!contact.email.trim() && !contact.phone.trim()) return setError("Déjanos tu correo o tu WhatsApp para enviarte tu resultado.")
    const src = campaignDetail()
    setSource(src)
    setSaving(true)
    try {
      const res = await fetch("/api/primera-casa/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          smsConsent,
          firstTime: a.firstTime,
          income: a.income,
          debts: a.debts,
          savings: a.savings,
          credit: a.credit,
          area: a.area,
          timing: a.timing,
          priceLow: result?.priceLow,
          priceHigh: result?.priceHigh,
          monthly: result?.monthlyHigh,
          sourceDetail: src.detail,
          utmCampaign: src.utmCampaign,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No pudimos guardar tu resultado.")
      // Browser-side Lead for the Pixel (the server sends the CAPI Lead too).
      try { (window as any).fbq?.("track", "Lead", { content_name: "Primera Casa — calculadora" }) } catch {}
      setShowResult(true)
      setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth" }), 50)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (showResult && result) {
    const summary = [
      `Estimado: ${usd(result.priceLow)} – ${usd(result.priceHigh)} (pago aprox. ${usd(result.monthlyLow)}–${usd(result.monthlyHigh)}/mes)`,
      `Primera vivienda: ${a.firstTime}`,
      `Ahorros: ${usd(a.savings || 0)} · Crédito: ${a.credit}`,
      a.area && `Área: ${a.area}`,
      a.timing && `Plazo: ${a.timing}`,
    ].filter(Boolean).join(" | ")

    return (
      <div id="resultado" className="scroll-mt-6 space-y-6">
        <div className="rounded-2xl bg-emerald-900 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Tu resultado, {contact.firstName}</p>
          {result.tooLow ? (
            <>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Hay un camino — empecemos por el plan</h2>
              <p className="mt-3 text-emerald-50">
                Con estos números todavía no podemos estimar un precio con confianza. Eso no significa que no puedas comprar:
                muchas familias empiezan por bajar deudas, sumar un co-solicitante o usar asistencia para el pago inicial.
                En una llamada corta Catherine te arma el plan.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                {usd(result.priceLow)} – {usd(result.priceHigh)}
              </h2>
              <p className="mt-2 text-emerald-100">
                Pago mensual estimado: <strong className="text-white">{usd(result.monthlyLow)} – {usd(result.monthlyHigh)}</strong>{" "}
                (incluye impuestos y seguro aproximados)
              </p>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-white/10 p-3">
                  <dt className="text-emerald-200">Pago inicial mínimo</dt>
                  <dd className="mt-1 text-lg font-semibold">{Math.round(result.downPct * 1000) / 10}% · {usd(result.priceLow * result.downPct)}</dd>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <dt className="text-emerald-200">Efectivo aprox. (entrada + cierre)</dt>
                  <dd className="mt-1 text-lg font-semibold">{usd(result.cashNeeded)}</dd>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <dt className="text-emerald-200">Tasa supuesta</dt>
                  <dd className="mt-1 text-lg font-semibold">{result.rate}% · 30 años</dd>
                </div>
              </dl>
            </>
          )}
        </div>

        <ul className="space-y-3">
          {!result.savingsCover && !result.tooLow && (
            <li className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                Tus ahorros todavía no cubren el estimado de entrada + cierre. En Florida existen programas de asistencia
                para el pago inicial para compradores de primera vez (estatales y del condado), y el vendedor puede aportar
                a los gastos de cierre. Cada programa tiene requisitos de ingreso, crédito y precio — Catherine revisa
                contigo para cuáles podrías calificar.
              </span>
            </li>
          )}
          {result.creditWork && (
            <li className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                Con crédito por debajo de 580 la mayoría de los préstamos para primera vivienda piden más entrada. Subir
                el puntaje unos meses antes puede abrirte el préstamo FHA con 3.5% de entrada.
              </span>
            </li>
          )}
          <li className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              Es una estimación para planear, no una pre-aprobación. La tasa es un supuesto: el número real depende de tu
              prestamista, tu crédito y la propiedad.
            </span>
          </li>
        </ul>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">El siguiente paso: tu plan en una llamada de 15 minutos</h2>
          <p className="mt-2 text-slate-600">
            Elige un horario y Catherine te explica, con tus números, cuánto necesitas, qué programas aplican y cómo es el
            proceso de compra paso a paso. Gratis y sin compromiso.
          </p>
        </div>

        <BookingForm
          prefill={{
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            summary,
          }}
          sourceDetail={source.detail}
        />

        <p className="text-center text-sm text-slate-600">
          ¿Prefieres escribir?{" "}
          <a href={whatsappUrl} className="font-semibold text-emerald-700 underline" target="_blank" rel="noopener noreferrer">
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    )
  }

  const pct = Math.round((step / total) * 100)

  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5 sm:p-8">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>Pregunta {Math.min(step + 1, total)} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {step < CONTACT_STEP ? (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{QUESTIONS[step].title}</h2>
          {QUESTIONS[step].hint && <p className="mt-2 text-sm text-slate-500">{QUESTIONS[step].hint}</p>}
          <div className="mt-5 space-y-3">{QUESTIONS[step].body}</div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">¿A dónde te enviamos tu resultado?</h2>
            <p className="mt-2 text-sm text-slate-500">Lo verás en pantalla al instante y te llega una copia.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre *</span>
              <input
                required autoComplete="given-name" value={contact.firstName}
                onChange={e => setContact({ ...contact, firstName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Apellido</span>
              <input
                autoComplete="family-name" value={contact.lastName}
                onChange={e => setContact({ ...contact, lastName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">WhatsApp / Celular</span>
            <input
              type="tel" autoComplete="tel" inputMode="tel" value={contact.phone}
              onChange={e => setContact({ ...contact, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
            <input
              type="email" autoComplete="email" value={contact.email}
              onChange={e => setContact({ ...contact, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
            />
          </label>

          {/* Honeypot — hidden from people, filled in by bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>No llenar <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => setContact({ ...contact, website: e.target.value })} /></label>
          </div>

          <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} />
            <span>
              Acepto que Catherine Gomez Realtors Group me contacte por WhatsApp, mensaje de texto o llamada sobre mi
              resultado. Puedo cancelar en cualquier momento respondiendo STOP.
            </span>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Calculando…</> : <>Ver mi resultado <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </button>
        </form>
      )}

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
        </button>
      )}
    </div>
  )
}
