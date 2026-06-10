"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2, Phone, CheckCircle2, Grid3X3, Globe, X,
} from "lucide-react"

interface LeadForm {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export default function SearchClient() {
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const [leadForm, setLeadForm] = useState<LeadForm>({ firstName: "", lastName: "", email: "", phone: "" })
  const [submitting, setSubmitting] = useState(false)

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...leadForm, source: "IDX_SEARCH", status: "NEW_LEAD" }),
      })
      setLeadSaved(true)
      setShowLeadModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="bg-white border-b shadow-sm flex-shrink-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lofty-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm leading-tight block">Catherine Gomez</span>
              <span className="text-xs text-gray-500 leading-tight block">Miami Real Estate</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!leadSaved ? (
              <button
                onClick={() => setShowLeadModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
              >
                <Phone className="w-3.5 h-3.5" />
                Hablar con Catherine
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Catherine te contactará pronto
              </div>
            )}
            <Link href="/login" className="text-xs text-gray-500 hover:text-lofty-700 hidden sm:block">
              Agent Login
            </Link>
          </div>
        </div>
      </header>

      {/* MLS iframe — takes all remaining height */}
      <div className="flex-1 min-h-0">
        <iframe
          src="https://sef.mlsmatrix.com/Matrix/public/IDX.aspx?idx=ed2f1f14"
          width="100%"
          height="100%"
          frameBorder="0"
          marginWidth={0}
          marginHeight={0}
          title="Miami MLS Property Search"
          className="block w-full h-full"
        />
      </div>

      {/* Lead capture modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Conecta con Catherine</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Te ayudamos a encontrar tu propiedad ideal en Miami</p>
                </div>
                <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.firstName}
                      onChange={e => setLeadForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Apellido *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.lastName}
                      onChange={e => setLeadForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Email *</label>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Teléfono</label>
                  <input
                    type="tel"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    placeholder="(305) 000-0000"
                  />
                </div>

                <div className="bg-lofty-50 rounded-lg p-3 text-xs text-lofty-700">
                  Catherine Gomez — más de 20 años de experiencia en Miami. Especialista en Brickell, Doral, Coral Gables, Aventura y Miami Beach.
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Conectar con Catherine →"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Seguir explorando
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
