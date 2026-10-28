"use client"

/**
 * Parkside — qualification form ("Solicitar mi análisis personalizado").
 *
 * Short on purpose: contact details plus five one-tap questions. The answers
 * land on the contact as a note (see /api/parkside/lead), so the first call
 * starts from budget, timing and goal instead of from zero.
 *
 * The phone is collected as country code + number because most of this
 * audience is in Colombia, and a number without its prefix is assumed to be a
 * US one downstream.
 */

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

const GREEN = "#2E4236"
const SAND = "#B59A6A"

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

const GOALS = ["Renta / inversión", "Vivienda propia o vacacional", "Ambas", "Diversificar patrimonio en dólares", "Aún no lo he definido"]
const BUDGETS = ["Menos de US$500,000", "US$500,000 – US$750,000", "US$750,000 – US$1,000,000", "Más de US$1,000,000", "Prefiero conversarlo"]
const UNIT_TYPES = ["Estudio", "1 habitación", "2 habitaciones", "Aún no lo sé"]
const PAYMENT = ["Contado", "Financiamiento", "Aún no lo sé"]
const TIMING = ["En los próximos 3 meses", "En 3 a 6 meses", "En 6 a 12 meses", "Solo estoy explorando"]

/** Everything Meta (or any other campaign) appended to the link. */
function campaign(): { detail: string; utmCampaign: string } {
  if (typeof window === "undefined") return { detail: "", utmCampaign: "" }
  const q = new URLSearchParams(window.location.search)
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]
  const parts = keys.map(k => (q.get(k) ? `${k}=${q.get(k)}` : "")).filter(Boolean)
  if (!parts.length && document.referrer) parts.push(`referrer=${document.referrer}`)
  return { detail: ["pagina=/parkside", ...parts].join(" · "), utmCampaign: q.get("utm_campaign") || "" }
}

function Choice({
  legend, options, value, onChange,
}: { legend: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-[#2B2A26]">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = value === o
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? "" : o)}
              className="border px-3.5 py-2 text-sm transition"
              style={on
                ? { background: GREEN, borderColor: GREEN, color: "#fff" }
                : { background: "#fff", borderColor: "rgba(46,66,54,.22)", color: "#3D3B35" }}
            >
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function LeadForm({ waUrl }: { waUrl: string | null }) {
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", country: "Colombia", phoneCode: "+57", phone: "",
    goal: "", budget: "", unitType: "", payment: "", timing: "", message: "", website: "",
  })
  const [smsConsent, setSmsConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.firstName.trim()) return setError("Escriba su nombre.")
    if (!f.email.trim() && !f.phone.trim()) return setError("Déjenos un correo o un WhatsApp para enviarle el análisis.")

    const digits = f.phone.replace(/[^\d]/g, "")
    // A number typed with its own "+" prefix is kept as typed.
    const phone = !digits ? "" : f.phone.trim().startsWith("+") ? `+${digits}` : `${f.phoneCode}${digits}`
    const c = campaign()

    setSending(true)
    try {
      const res = await fetch("/api/parkside/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f, phone, smsConsent,
          sourceDetail: c.detail, utmCampaign: c.utmCampaign,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No pudimos enviar su solicitud.")
      setDone(true)
    } catch (err: any) {
      setError(err.message || "No pudimos enviar su solicitud.")
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white p-8 sm:p-10" role="status">
        <CheckCircle2 className="h-10 w-10" style={{ color: GREEN }} aria-hidden="true" />
        <h3 className="mt-5 text-2xl font-light" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Gracias, {f.firstName.split(" ")[0]}. Recibimos su solicitud.
        </h3>
        <p className="mt-4 leading-relaxed text-[#57534B]">
          El equipo de Catherine Gomez revisará sus respuestas y le contactará para preparar su
          análisis de Parkside: planos, precios vigentes y el calendario de depósitos aplicado a
          su caso.
        </p>
        {waUrl && (
          <a
            href={waUrl}
            className="mt-7 inline-block px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-white"
            style={{ background: GREEN }}
          >
            Escribir ahora por WhatsApp
          </a>
        )}
      </div>
    )
  }

  const input = "w-full border bg-white px-3.5 py-3 text-[15px] outline-none transition focus:border-[#2E4236]"
  const inputStyle = { borderColor: "rgba(46,66,54,.22)" }

  return (
    <form onSubmit={submit} className="space-y-7 bg-white p-6 sm:p-9" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">Nombre *</span>
          <input className={input} style={inputStyle} autoComplete="given-name" value={f.firstName} onChange={e => set("firstName")(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">Apellido</span>
          <input className={input} style={inputStyle} autoComplete="family-name" value={f.lastName} onChange={e => set("lastName")(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">Correo electrónico</span>
          <input type="email" className={input} style={inputStyle} autoComplete="email" value={f.email} onChange={e => set("email")(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">País de residencia</span>
          <select
            className={input}
            style={inputStyle}
            value={f.country}
            onChange={e => {
              const c = COUNTRIES.find(x => x.label === e.target.value)
              setF(p => ({ ...p, country: e.target.value, phoneCode: c?.code ?? p.phoneCode }))
            }}
          >
            {COUNTRIES.map(c => <option key={c.label}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">WhatsApp</span>
          <div className="flex">
            <span className="flex items-center border border-r-0 bg-[#F6F3EC] px-3 text-[15px] text-[#57534B]" style={inputStyle}>
              {f.phoneCode || "+"}
            </span>
            <input
              type="tel"
              className={input}
              style={inputStyle}
              autoComplete="tel-national"
              inputMode="tel"
              placeholder={f.phoneCode === "+57" ? "300 123 4567" : ""}
              value={f.phone}
              onChange={e => set("phone")(e.target.value)}
            />
          </div>
        </label>
      </div>

      <Choice legend="¿Cuál es su objetivo principal?" options={GOALS} value={f.goal} onChange={set("goal")} />
      <Choice legend="¿Qué presupuesto contempla?" options={BUDGETS} value={f.budget} onChange={set("budget")} />
      <Choice legend="¿Qué tipo de residencia le interesa?" options={UNIT_TYPES} value={f.unitType} onChange={set("unitType")} />
      <Choice legend="¿Cómo planea pagar?" options={PAYMENT} value={f.payment} onChange={set("payment")} />
      <Choice legend="¿Cuándo piensa invertir?" options={TIMING} value={f.timing} onChange={set("timing")} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#2B2A26]">¿Algo más que debamos saber? (opcional)</span>
        <textarea rows={3} className={`${input} resize-none`} style={inputStyle} value={f.message} onChange={e => set("message")(e.target.value)} />
      </label>

      {/* Honeypot — hidden from people, filled in by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>No llenar <input tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set("website")(e.target.value)} /></label>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-[#57534B]">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} />
        <span>
          Acepto que Catherine Gomez Realtors Group me contacte por WhatsApp, mensaje de texto o
          llamada sobre esta solicitud. Puedo cancelar en cualquier momento respondiendo STOP.
        </span>
      </label>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 px-8 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:opacity-60"
        style={{ background: GREEN }}
      >
        {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {sending ? "Enviando…" : "Solicitar mi análisis personalizado"}
      </button>
      <p className="text-xs leading-relaxed text-[#8A857A]">
        Sus datos se usan solo para atender esta solicitud. Consulte nuestra{" "}
        <a href="/privacy" className="underline" style={{ color: SAND }}>política de privacidad</a>.
      </p>
    </form>
  )
}
