"use client"

import { useState } from "react"
import { X, Heart, Loader2 } from "lucide-react"
import type { LeadFields } from "@/lib/idx-favorites"

// Shown the first time a visitor saves a home — captures name/email/phone.
export function LeadCaptureModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (lead: LeadFields) => Promise<void>
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() && !phone.trim()) { setErr("Ingresa tu email o teléfono."); return }
    setSubmitting(true)
    setErr(null)
    try {
      await onSubmit({ firstName, lastName, email, phone })
    } catch (e: any) {
      setErr(e.message || "Error al guardar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Guarda tus propiedades favoritas</h2>
              <p className="text-xs text-gray-500">Catherine te avisa cuando bajen de precio o haya similares.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
          </div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono (opcional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-lofty-600 text-white rounded-xl font-semibold text-sm hover:bg-lofty-700 disabled:opacity-60">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Heart className="w-4 h-4" /> Guardar propiedad</>}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Al continuar aceptas ser contactado por Catherine Gomez Realtor.</p>
        </form>
      </div>
    </div>
  )
}
