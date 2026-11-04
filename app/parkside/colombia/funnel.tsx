"use client"

/**
 * /parkside/colombia — "Su plan de inversión en Brickell" funnel.
 *
 * Ad → 6 one-tap questions → contact → a personalized plan (residence that
 * fits the capital, the developer's deposit schedule in dollars and dates)
 * → Catherine's Zoom calendar on the same screen.
 *
 * It also qualifies: people whose capital covers the 20% contract deposit
 * and who plan to decide within 6 months see the calendar first; people
 * far from it are told so honestly and sent to the weekly webinar first,
 * so Catherine's calendar fills with buyers, not browsers.
 */

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react"
import BookingCalendar from "@/components/public/booking-calendar"
import { CAPITAL, GOALS, PREFS, CLOSING, TIMING, US_BEFORE, buildPlan, usd, PRICES_AS_OF } from "./data"

const FOREST = "#1E2B23"
const GREEN = "#2E4236"
const SAND = "#B59A6A"
const LINE = "rgba(46,66,54,.22)"
const serif = "var(--font-display), Georgia, serif"

const COUNTRIES: { label: string; code: string }[] = [
  { label: "Colombia", code: "+57" },
  { label: "Estados Unidos", code: "+1" },
  { label: "México", code: "+52" },
  { label: "Venezuela", code: "+58" },
  { label: "Ecuador", code: "+593" },
  { label: "Perú", code: "+51" },
  { label: "Panamá", code: "+507" },
  { label: "España", code: "+34" },
  { label: "Otro país", code: "" },
]

type Answers = { goal: string; pref: string; capital: string; closing: string; timing: string; usBefore: string }

function campaign(): { detail: string; utmCampaign: string } {
  if (typeof window === "undefined") return { detail: "", utmCampaign: "" }
  const q = new URLSearchParams(window.location.search)
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]
  const parts = keys.map(k => (q.get(k) ? `${k}=${q.get(k)}` : "")).filter(Boolean)
  if (!parts.length && document.referrer) parts.push(`referrer=${document.referrer}`)
  return { detail: ["pagina=/parkside/colombia", ...parts].join(" · "), utmCampaign: q.get("utm_campaign") || "" }
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center justify-between gap-3 border px-5 py-4 text-left text-base transition"
      style={active
        ? { background: GREEN, borderColor: GREEN, color: "#fff" }
        : { background: "#fff", borderColor: LINE, color: FOREST }}
    >
      {label}
      <ArrowRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    </button>
  )
}

export default function Funnel({ waUrl, webinarUrl }: { waUrl: string; webinarUrl: string }) {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>({ goal: "", pref: "", capital: "", closing: "", timing: "", usBefore: "" })
  const [c, setC] = useState({ firstName: "", lastName: "", email: "", country: "Colombia", phone: "", website: "" })
  const [smsConsent, setSmsConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullPhone, setFullPhone] = useState("")
  const [showPlan, setShowPlan] = useState(false)
  const [showCalendarC, setShowCalendarC] = useState(false)

  const capital = CAPITAL.find(x => x[0] === a.capital)?.[1] ?? 0
  const plan = useMemo(() => buildPlan(capital, a.pref, a.timing), [capital, a.pref, a.timing])

  const choose = (k: keyof Answers, v: string) => {
    setA(p => ({ ...p, [k]: v }))
    setStep(s => s + 1)
  }

  const QUESTIONS: { title: string; hint?: string; key: keyof Answers; options: string[] }[] = [
    { key: "goal", title: "¿Qué busca con una propiedad en Miami?", options: GOALS },
    { key: "pref", title: "¿Qué tipo de residencia le interesa?", hint: "Estudios desde US$490,000 · 1 habitación desde US$582,750 · 2 habitaciones desde US$1,160,250", options: PREFS },
    { key: "capital", title: "¿Con cuánto capital cuenta hoy para la inversión?", hint: "Al firmar el contrato se deposita el 20% del precio. Le mostramos su plan con estos números.", options: CAPITAL.map(x => x[0]) },
    { key: "closing", title: "¿Cómo pensaría pagar el saldo al cierre (60%)?", hint: "El cierre es a la entrega, estimada para el primer trimestre de 2028.", options: CLOSING },
    { key: "timing", title: "¿Cuándo le gustaría tomar una decisión?", options: TIMING },
    { key: "usBefore", title: "¿Ha comprado antes una propiedad en Estados Unidos?", options: US_BEFORE },
  ]
  const CONTACT = QUESTIONS.length
  const total = QUESTIONS.length + 1
  const country = COUNTRIES.find(x => x.label === c.country) || COUNTRIES[0]

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (!c.firstName.trim()) return setError("Escriba su nombre.")
    const digits = c.phone.replace(/[^\d]/g, "")
    const phone = !digits ? "" : c.phone.trim().startsWith("+") ? `+${digits}` : `${country.code}${digits}`
    if (!phone && !c.email.trim()) return setError("Déjenos su WhatsApp o su correo para enviarle su plan.")
    const src = campaign()
    setSaving(true)
    try {
      const res = await fetch("/api/parkside/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, ...c, phone, smsConsent, sourceDetail: src.detail, utmCampaign: src.utmCampaign }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No pudimos guardar su plan.")
      try { (window as any).fbq?.("track", "Lead", { content_name: "Parkside — plan Colombia" }) } catch {}
      setFullPhone(phone)
      setShowPlan(true)
      setTimeout(() => document.getElementById("su-plan")?.scrollIntoView({ behavior: "smooth" }), 50)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------ result
  if (showPlan) {
    const first = c.firstName.trim().split(" ")[0]
    const calendar = (
      <BookingCalendar
        source="PARKSIDE"
        topic="Parkside — presentación de plan de inversión"
        pageLabel="/parkside/colombia"
        theme={{ accent: GREEN, accentText: "#fff", ink: FOREST, muted: "#6B6A62", surface: "#fff", line: LINE }}
        prefill={{
          firstName: c.firstName.trim(),
          lastName: c.lastName.trim(),
          email: c.email.trim(),
          phone: fullPhone,
          country: c.country,
          summary: `Plan Colombia (${plan.tier}) — ${plan.unit.type} desde ${usd(plan.unit.from)} · Capital: ${a.capital} · Cierre: ${a.closing} · Plazo: ${a.timing}`,
        }}
      />
    )

    return (
      <div id="su-plan" className="scroll-mt-4 space-y-8">
        <div className="p-6 text-white sm:p-9" style={{ background: FOREST }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em]" style={{ color: "#D9C7A0" }}>Su plan de inversión, {first}</p>
          <h2 className="mt-4 text-3xl font-light leading-tight sm:text-4xl" style={{ fontFamily: serif }}>
            {plan.unit.type} en Parkside, desde {usd(plan.unit.from)}
          </h2>
          <p className="mt-3 text-white/70">
            {plan.unit.size} · amueblado · frente a Simpson Park, Brickell
          </p>
          {plan.wantedButShort && (
            <p className="mt-4 border-l-2 pl-4 text-sm text-white/80" style={{ borderColor: SAND }}>
              Nos dijo que le interesa {plan.wantedButShort === "Estudio" ? "un estudio" : `una residencia de ${plan.wantedButShort}`}.
              Con el capital de hoy, el 20% al contrato encaja mejor con {plan.unit.type === "Estudio" ? "un estudio" : `una de ${plan.unit.type}`}; en la
              presentación Catherine revisa con usted las dos opciones.
            </p>
          )}

          <dl className="mt-7 divide-y divide-white/15 border-y border-white/15">
            {plan.schedule.map(s => (
              <div key={s.when} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-white/75">{s.pct}% · {s.when}</dt>
                <dd className="text-lg tabular-nums">{usd(s.amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-white/80">
            Capital antes de la entrega: <strong className="text-white">{usd(plan.beforeClosing)}</strong> (40%), repartido en
            tres pagos hasta abril de 2027.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            Precios &quot;desde&quot; y calendario del desarrollador al {PRICES_AS_OF}; el precio final depende del piso, la vista y la
            disponibilidad. No incluye gastos de cierre ni cuotas de mantenimiento.
          </p>
        </div>

        {plan.tier !== "C" ? (
          <div>
            <h2 className="text-2xl font-light sm:text-3xl" style={{ fontFamily: serif }}>
              El siguiente paso: su presentación privada por Zoom
            </h2>
            <p className="mt-3 text-[#4F5A52]">
              30 minutos con Catherine Gomez, en español. Le muestra las residencias disponibles que encajan con este plan,
              {a.closing === "Financiamiento hipotecario" ? " las opciones de financiamiento para compradores extranjeros," : ""} los
              gastos a considerar además del precio y cómo se compra desde {c.country || "Colombia"}, paso a paso.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-[#4F5A52] sm:grid-cols-2">
              {["Planos y precios vigentes", "Su calendario de pagos, unidad por unidad", "Cómo se firma y se paga desde el exterior", "Sus preguntas, en vivo"].map(t => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" style={{ color: SAND }} aria-hidden="true" /> {t}</li>
              ))}
            </ul>
            <div className="mt-6 shadow-sm">{calendar}</div>
          </div>
        ) : (
          <div className="border bg-white p-6 sm:p-8" style={{ borderColor: LINE }}>
            <h2 className="text-2xl font-light sm:text-3xl" style={{ fontFamily: serif }}>Su mejor siguiente paso</h2>
            <p className="mt-3 text-[#4F5A52]">
              Para Parkside, el depósito al firmar empieza en {usd(plan.schedule[0].amount)}. Si todavía está armando ese capital,
              le recomendamos empezar por nuestra charla gratuita por Zoom de los jueves: cómo invertir en Miami desde Colombia,
              cuánto se necesita y cómo funcionan los pagos en preconstrucción, con preguntas en vivo.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={webinarUrl} className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white" style={{ background: GREEN }}>
                Reservar mi lugar en la charla
              </a>
              <a href={waUrl} className="border px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em]" style={{ borderColor: LINE, color: GREEN }}>
                Escribir por WhatsApp
              </a>
            </div>
            {!showCalendarC ? (
              <button type="button" onClick={() => setShowCalendarC(true)} className="mt-6 text-sm underline" style={{ color: GREEN }}>
                Prefiero hablar directamente con Catherine
              </button>
            ) : (
              <div className="mt-6">{calendar}</div>
            )}
          </div>
        )}

        <p className="text-center text-sm text-[#4F5A52]">
          ¿Prefiere escribir primero? <a href={waUrl} className="font-medium underline" style={{ color: GREEN }}>WhatsApp</a>
        </p>
      </div>
    )
  }

  // ------------------------------------------------------------- quiz
  const pct = Math.round((step / total) * 100)
  const input = "mt-1 w-full border bg-white px-4 py-3 text-base outline-none"

  return (
    <div className="bg-white p-5 shadow-lg sm:p-8" style={{ color: FOREST }}>
      <div className="flex items-center justify-between text-xs text-[#6B6A62]">
        <span>Paso {Math.min(step + 1, total)} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#EDE7DA]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: SAND }} />
      </div>

      {step < CONTACT ? (
        <div className="mt-6">
          <h2 className="text-2xl font-light leading-snug sm:text-3xl" style={{ fontFamily: serif }}>{QUESTIONS[step].title}</h2>
          {QUESTIONS[step].hint && <p className="mt-2 text-sm text-[#6B6A62]">{QUESTIONS[step].hint}</p>}
          <div className="mt-5 space-y-2.5">
            {QUESTIONS[step].options.map(o => (
              <Option key={o} label={o} active={a[QUESTIONS[step].key] === o} onClick={() => choose(QUESTIONS[step].key, o)} />
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <h2 className="text-2xl font-light leading-snug sm:text-3xl" style={{ fontFamily: serif }}>Su plan está listo. ¿A nombre de quién lo preparamos?</h2>
            <p className="mt-2 text-sm text-[#6B6A62]">Lo verá en pantalla al instante. Sin costo ni compromiso.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Nombre *
              <input required autoComplete="given-name" value={c.firstName} onChange={e => setC({ ...c, firstName: e.target.value })} className={input} style={{ borderColor: LINE }} />
            </label>
            <label className="block text-sm font-medium">Apellido
              <input autoComplete="family-name" value={c.lastName} onChange={e => setC({ ...c, lastName: e.target.value })} className={input} style={{ borderColor: LINE }} />
            </label>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
            <label className="block text-sm font-medium">País
              <select value={c.country} onChange={e => setC({ ...c, country: e.target.value })} className={input} style={{ borderColor: LINE }}>
                {COUNTRIES.map(x => <option key={x.label} value={x.label}>{x.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">WhatsApp {country.code && `(${country.code})`}
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder={country.code === "+57" ? "300 123 4567" : ""} value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} className={input} style={{ borderColor: LINE }} />
            </label>
          </div>
          <label className="block text-sm font-medium">Correo electrónico
            <input type="email" autoComplete="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} className={input} style={{ borderColor: LINE }} />
          </label>

          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>No llenar <input tabIndex={-1} autoComplete="off" value={c.website} onChange={e => setC({ ...c, website: e.target.value })} /></label>
          </div>

          <label className="flex items-start gap-3 text-sm leading-relaxed text-[#57534B]">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} />
            <span>
              Acepto que Catherine Gomez Realtors Group me contacte por WhatsApp, mensaje de texto o llamada sobre mi plan.
              Puedo cancelar en cualquier momento respondiendo STOP.
            </span>
          </label>

          {error && <p className="bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Preparando su plan…</> : <>Ver mi plan de inversión <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
          </button>
        </form>
      )}

      {step > 0 && (
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} className="mt-5 inline-flex items-center gap-1 text-sm text-[#6B6A62]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
        </button>
      )}
    </div>
  )
}
