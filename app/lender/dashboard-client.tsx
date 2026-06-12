"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Landmark, Lock, Unlock, LogOut, Loader2, MapPin, DollarSign, Home } from "lucide-react"

interface LeadItem {
  id: string
  status: string
  loStatus: string
  price: number
  sharedAt: string
  firstName: string
  lastInitial: string
  lastName: string | null
  phone: string | null
  email: string | null
  budgetMax: number | null
  location: string | null
  propertyType: string | null
  source: string | null
}

const LO_STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  PRE_APPROVED: "Pre-aprobado",
  DOCS_REQUESTED: "Docs solicitados",
  CLOSED: "Cerrado",
  LOST: "Perdido",
}

export default function LenderDashboardClient({
  partner,
  leads,
}: {
  partner: { name: string; company: string | null }
  leads: LeadItem[]
}) {
  const router = useRouter()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function handlePay(shareId: string) {
    setPayingId(shareId)
    setError("")
    try {
      const res = await fetch(`/api/lender/leads/${shareId}/checkout`, { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || "No se pudo iniciar el pago")
        setPayingId(null)
      }
    } catch {
      setError("Error de conexión")
      setPayingId(null)
    }
  }

  async function handleLogout() {
    await fetch("/api/lender/logout", { method: "POST" })
    router.push("/lender/login")
    router.refresh()
  }

  const pending = leads.filter(l => l.status === "PENDING")
  const unlocked = leads.filter(l => l.status === "PAID")

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{partner.name}</p>
            <p className="text-xs text-gray-400">{partner.company || "Loan Officer"}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Salir
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* New leads available */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            Leads disponibles ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(lead => (
              <div key={lead.id} className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {lead.firstName} {lead.lastInitial}
                      <span className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">BLOQUEADO</span>
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      {lead.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.location}</span>}
                      {lead.budgetMax && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />hasta ${lead.budgetMax.toLocaleString()}</span>}
                      {lead.propertyType && <span className="flex items-center gap-1"><Home className="w-3 h-3" />{lead.propertyType.replace(/_/g, " ").toLowerCase()}</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">Teléfono y email se revelan al desbloquear</p>
                  </div>
                  <button
                    onClick={() => handlePay(lead.id)}
                    disabled={payingId === lead.id}
                    className="flex items-center gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    {payingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    Desbloquear ${lead.price}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unlocked leads */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Unlock className="w-4 h-4 text-green-500" />
        Mis leads ({unlocked.length})
      </h2>
      {unlocked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
          Aún no has desbloqueado ningún lead.
        </div>
      ) : (
        <div className="space-y-3">
          {unlocked.map(lead => (
            <Link
              key={lead.id}
              href={`/lender/leads/${lead.id}`}
              className="block bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md p-4 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{lead.firstName} {lead.lastName}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {lead.phone && <span>{lead.phone}</span>}
                    {lead.email && <span className="truncate">{lead.email}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">
                  {LO_STATUS_LABELS[lead.loStatus] || lead.loStatus}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
