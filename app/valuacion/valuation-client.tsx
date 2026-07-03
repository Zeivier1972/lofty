"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, Phone, Loader2, Home, TrendingUp, Calendar } from "lucide-react"

interface Result {
  estimateLow: number | null
  estimateHigh: number | null
  compCount: number
}

function fmt(n: number | null): string {
  return n ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—"
}

export default function ValuationClient() {
  const [form, setForm] = useState({
    address: "", city: "", zip: "", beds: "", baths: "", sqft: "",
    firstName: "", lastName: "", email: "", phone: "",
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/idx/valuation", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Error")
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-lofty-600 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
            <div>
              <span className="font-bold text-gray-900 text-sm leading-tight block">Catherine Gomez</span>
              <span className="text-xs text-gray-500 leading-tight block">Miami Real Estate</span>
            </div>
          </Link>
          <a href="tel:+13052830872" className="flex items-center gap-1.5 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium">
            <Phone className="w-3.5 h-3.5" /> (305) 283-0872
          </a>
        </div>
      </header>

      <div className="bg-gradient-to-br from-[#0a1628] to-[#1a2f50] text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-12 text-center">
          <p className="text-[#c9a84c] text-xs font-black uppercase tracking-[0.2em] mb-2">Valuación gratuita</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">¿Cuánto vale tu casa hoy?</h1>
          <p className="text-white/70 mt-2 max-w-2xl mx-auto text-sm">Recibe un estimado al instante basado en propiedades comparables del MLS — y un reporte detallado de Catherine, sin costo.</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {result ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <TrendingUp className="w-10 h-10 text-lofty-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Valor estimado de tu propiedad</p>
            <p className="text-3xl md:text-4xl font-extrabold text-lofty-700 mt-2">
              {fmt(result.estimateLow)} – {fmt(result.estimateHigh)}
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Estimado basado en {result.compCount} propiedades comparables activas. Un análisis exacto (CMA) requiere ver tu propiedad — Catherine te lo prepara gratis.
            </p>
            <a href="/book" className="mt-6 inline-flex items-center justify-center gap-2 bg-lofty-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-lofty-700">
              <Calendar className="w-4 h-4" /> Agenda tu CMA gratis con Catherine
            </a>
            <p className="text-xs text-gray-400 mt-4">O llámala directamente: (305) 283-0872</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-800 font-semibold"><Home className="w-4 h-4 text-lofty-600" /> Sobre tu propiedad</div>
            <input required value={form.address} onChange={e => set("address", e.target.value)} placeholder="Dirección *"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Ciudad"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
              <input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="Código postal" inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input value={form.beds} onChange={e => set("beds", e.target.value.replace(/\D/g, ""))} placeholder="Cuartos" inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
              <input value={form.baths} onChange={e => set("baths", e.target.value.replace(/[^\d.]/g, ""))} placeholder="Baños" inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
              <input value={form.sqft} onChange={e => set("sqft", e.target.value.replace(/\D/g, ""))} placeholder="Pies² (SqFt)" inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div className="flex items-center gap-2 text-gray-800 font-semibold pt-2"><Phone className="w-4 h-4 text-lofty-600" /> ¿Dónde te enviamos el reporte?</div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Nombre"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
              <input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Apellido"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="Email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Teléfono"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-lofty-600 text-white rounded-xl font-semibold text-sm hover:bg-lofty-700 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando…</> : <><TrendingUp className="w-4 h-4" /> Ver el valor de mi casa</>}
            </button>
            <p className="text-[11px] text-gray-400 text-center">Es gratis y sin compromiso. Aceptas ser contactado por Catherine Gomez Realtor.</p>
          </form>
        )}
      </main>
    </div>
  )
}
