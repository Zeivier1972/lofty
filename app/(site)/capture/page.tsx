"use client"

import { useState } from "react"
import { Home, User, Phone, Mail, DollarSign, MapPin, CheckCircle } from "lucide-react"

export default function LeadCapturePage() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", message: "",
    type: "buyer", budget: "", area: "", smsConsent: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName || (!form.email && !form.phone)) {
      setError("Por favor completa tu nombre y al menos un método de contacto.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE" }),
      })
      if (res.ok) setSubmitted(true)
      else setError("Error al enviar. Intenta de nuevo.")
    } catch {
      setError("Error de conexión. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lofty-900 to-lofty-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Gracias!</h2>
          <p className="text-gray-500 mb-6">Hemos recibido tu información. Un especialista se comunicará contigo muy pronto.</p>
          <a href="/" className="text-lofty-600 hover:underline text-sm">Volver al inicio</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lofty-900 to-lofty-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-lofty-700 text-white px-8 py-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold">Tu Próximo Hogar</p>
              <p className="text-lofty-200 text-xs">Conecta con un especialista</p>
            </div>
          </div>
          <h1 className="text-xl font-bold">¿Listo para encontrar tu propiedad ideal?</h1>
          <p className="text-lofty-200 text-sm mt-1">Déjanos tus datos y te contactamos en menos de 2 horas.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">¿Qué buscas?</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "buyer", label: "Comprar propiedad" }, { v: "seller", label: "Vender mi propiedad" }].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => f("type", opt.v)}
                  className={`py-2.5 px-4 rounded-xl text-sm font-medium border-2 transition-colors ${form.type === opt.v ? "border-lofty-600 bg-lofty-50 text-lofty-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="María" value={form.firstName} onChange={e => f("firstName", e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Apellido</label>
              <input type="text" placeholder="García" value={form.lastName} onChange={e => f("lastName", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="email" placeholder="maria@email.com" value={form.email} onChange={e => f("email", e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="tel" placeholder="(305) 555-0100" value={form.phone} onChange={e => f("phone", e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
            </div>
          </div>

          {/* Budget + Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {form.type === "seller" ? "Valor estimado" : "Presupuesto"}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="$350,000" value={form.budget} onChange={e => f("budget", e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Área / Ciudad</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Miami, FL" value={form.area} onChange={e => f("area", e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">¿Algo más que debamos saber?</label>
            <textarea rows={2} placeholder="Cuéntanos sobre lo que buscas..." value={form.message} onChange={e => f("message", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lofty-500" />
          </div>

          {/* SMS Consent */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.smsConsent} onChange={e => f("smsConsent", e.target.checked)} className="mt-0.5 w-4 h-4 accent-lofty-600" />
            <span className="text-xs text-gray-500 leading-relaxed">
              Acepto recibir mensajes de texto (SMS) con información sobre propiedades. Puedes cancelar en cualquier momento respondiendo STOP. Se aplican tarifas de mensajes.
            </span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={saving} className="w-full bg-lofty-600 hover:bg-lofty-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Enviando..." : "Quiero que me contacten →"}
          </button>

          <p className="text-center text-xs text-gray-400">Tu información es 100% confidencial. Sin spam.</p>
        </form>
      </div>
    </div>
  )
}
