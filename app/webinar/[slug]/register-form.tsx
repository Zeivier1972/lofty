"use client"

import { useState } from "react"

/**
 * The signup form. Four fields, because every extra one costs registrations
 * and the rest can be asked on the call.
 *
 * The phone field is optional but asked for, since the reminder sequence is
 * far more effective by SMS than email — and the consent line next to it is
 * what makes texting them lawful. It is a real checkbox rather than small
 * print: an unchecked box means email reminders only, not no reminders.
 */
export function RegisterForm({ slug, joinUrlKnown }: { slug: string; joinUrlKnown: boolean }) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [smsConsent, setSmsConsent] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ joinUrl: string | null; already: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // The referrer and any utm_source travel with the signup so the reporting
      // can tell an Instagram registration from a replay-page one.
      const params = new URLSearchParams(window.location.search)
      const source = params.get("utm_source") || params.get("source") || "webinar-page"

      const res = await fetch("/api/webinar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, firstName, lastName, email, phone, smsConsent, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo completar el registro.")
      setDone({ joinUrl: data.joinUrl ?? null, already: !!data.alreadyRegistered })
    } catch (err: any) {
      setError(err.message || "No se pudo completar el registro.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-bold text-emerald-900">
          {done.already ? "Ya estabas registrado ✓" : "¡Listo, estás registrado! ✓"}
        </p>
        <p className="mt-2 text-sm text-emerald-800">
          Te enviamos la confirmación por correo. Te recordamos un día antes y una hora antes.
        </p>
        {done.joinUrl && (
          <a
            href={done.joinUrl}
            className="mt-4 inline-block rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
          >
            Entrar al webinar →
          </a>
        )}
        {!done.joinUrl && (
          <p className="mt-3 text-xs text-emerald-700">
            El enlace para entrar te llega por correo antes de que empiece.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wf-first" className="mb-1 block text-xs font-semibold text-slate-600">
            Nombre *
          </label>
          <input
            id="wf-first"
            required
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label htmlFor="wf-last" className="mb-1 block text-xs font-semibold text-slate-600">
            Apellido
          </label>
          <input
            id="wf-last"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="wf-email" className="mb-1 block text-xs font-semibold text-slate-600">
          Correo * <span className="font-normal text-slate-400">— ahí llega el enlace</span>
        </label>
        <input
          id="wf-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div>
        <label htmlFor="wf-phone" className="mb-1 block text-xs font-semibold text-slate-600">
          WhatsApp / celular <span className="font-normal text-slate-400">— opcional</span>
        </label>
        <input
          id="wf-phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+57 300 000 0000"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {phone.trim() && (
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={e => setSmsConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Acepto recibir recordatorios de este webinar por mensaje de texto o WhatsApp. Puedes
            responder STOP para no recibir más.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-sky-700 py-3.5 font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
      >
        {busy ? "Registrando…" : "Reservar mi lugar — gratis"}
      </button>

      <p className="text-center text-xs text-slate-400">
        {joinUrlKnown
          ? "Recibes el enlace de Zoom al instante."
          : "Te enviamos el enlace de Zoom por correo antes del evento."}
      </p>
    </form>
  )
}
