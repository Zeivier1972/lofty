"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Landmark, Unlock, LogOut, Loader2, MapPin, DollarSign, Home, CheckCircle2, AlertCircle, Clock } from "lucide-react"

interface LeadItem {
  id: string
  status: string
  loStatus: string
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

interface PartnerInfo {
  name: string
  company: string | null
  subscriptionStatus: string
  subscriptionEndDate: string | null
  monthlyFee: number
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
  partner: PartnerInfo
  leads: LeadItem[]
}) {
  const router = useRouter()
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState("")

  const isSubscribed = partner.subscriptionStatus === "active"
  const isPastDue = partner.subscriptionStatus === "past_due"

  async function handleSubscribe() {
    setSubscribing(true)
    setError("")
    try {
      const res = await fetch("/api/lender/subscribe", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || "No se pudo iniciar el pago")
        setSubscribing(false)
      }
    } catch {
      setError("Error de conexión")
      setSubscribing(false)
    }
  }

  async function handleLogout() {
    await fetch("/api/lender/logout", { method: "POST" })
    router.push("/lender/login")
    router.refresh()
  }

  const unlockedLeads = leads.filter(l => l.phone !== null || l.email !== null)
  const lockedLeads = leads.filter(l => l.phone === null && l.email === null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Subscription status banner */}
      {isSubscribed ? (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Suscripción activa</p>
            {partner.subscriptionEndDate && (
              <p className="text-xs text-green-600">
                Próximo cobro: {new Date(partner.subscriptionEndDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <span className="text-sm font-bold text-green-700">${partner.monthlyFee}/mes</span>
        </div>
      ) : isPastDue ? (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-800">Pago fallido — suscripción suspendida</p>
          </div>
          <p className="text-xs text-red-600 mb-3">Tu método de pago fue rechazado. Actualiza tu tarjeta para recuperar el acceso.</p>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Actualizar suscripción — ${partner.monthlyFee}/mes
          </button>
        </div>
      ) : (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-5">
          <div className="flex items-start gap-3 mb-4">
            <Clock className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">Suscripción requerida</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                Suscríbete para acceder a los {leads.length} lead{leads.length !== 1 ? "s" : ""} que Catherine te compartió.
                Acceso ilimitado a todos los leads por un pago mensual fijo.
              </p>
            </div>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Suscribirme — ${partner.monthlyFee}/mes
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Unlocked leads */}
      {unlockedLeads.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-green-500" />
            Mis leads ({unlockedLeads.length})
          </h2>
          <div className="space-y-3">
            {unlockedLeads.map(lead => (
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
        </div>
      )}

      {/* Locked leads (no subscription) */}
      {lockedLeads.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">
            Disponibles con suscripción ({lockedLeads.length})
          </h2>
          <div className="space-y-3">
            {lockedLeads.map(lead => (
              <div key={lead.id} className="bg-white rounded-2xl border border-dashed border-gray-200 p-4 opacity-70">
                <p className="font-semibold text-gray-700">
                  {lead.firstName} {lead.lastInitial}
                  <span className="ml-2 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">BLOQUEADO</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  {lead.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.location}</span>}
                  {lead.budgetMax && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />hasta ${lead.budgetMax.toLocaleString()}</span>}
                  {lead.propertyType && <span className="flex items-center gap-1"><Home className="w-3 h-3" />{lead.propertyType.replace(/_/g, " ").toLowerCase()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Landmark className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Catherine aún no te ha compartido leads.</p>
        </div>
      )}
    </div>
  )
}
