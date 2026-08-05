"use client"

import { useState } from "react"

export default function CaptureForm() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "" })
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending"); setError("")
    try {
      const res = await fetch("/api/leads/costa-rica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, smsConsent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      setStatus("done")
    } catch (err: any) {
      setError(err.message || "No se pudo enviar"); setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-xl font-bold text-emerald-900">¡Listo, {form.firstName}!</h3>
        <p className="text-emerald-800 mt-2">
          Recibirás la información de <strong>One Twenty Brickell</strong> en tu correo, y Catherine te contactará
          personalmente para mostrarte los números y el plan de pagos.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required placeholder="Nombre" value={form.firstName}
          onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="Apellido" value={form.lastName}
          onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <input type="email" placeholder="Correo electrónico" value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <input type="tel" placeholder="WhatsApp / Teléfono (con código de país)" value={form.phone}
        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <textarea placeholder="¿Qué te gustaría saber? (opcional)" value={form.message}
        onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={status === "sending"}
        className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white text-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
        {status === "sending" ? "Enviando…" : "Quiero la información →"}
      </button>
      <p className="text-center text-xs text-gray-400">
        Al enviar, aceptas recibir información y ser contactado por WhatsApp, llamada o correo. Sin spam.
      </p>
    </form>
  )
}
