"use client"

import { useState } from "react"
import Link from "next/link"
import { TrendingUp, Phone, X } from "lucide-react"

interface HotLead {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  leadScore: number
  lastContacted: string | null
  recentViews: number
}

// Dashboard "Leads Calientes — Actúa Ahora" (same score rule as the AI Agent),
// ready to call, with a per-lead remove button for leads you've already spoken to.
export default function HotScoreLeads({ leads: initial }: { leads: HotLead[] }) {
  const [leads, setLeads] = useState(initial)
  if (leads.length === 0) return null

  function remove(id: string) {
    setLeads(prev => prev.filter(l => l.id !== id))
    fetch("/api/dashboard/hot-lead-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: id }),
    }).catch(() => {})
  }

  const callableIds = leads.filter(l => l.phone).map(l => l.id)

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="flex items-center gap-2 font-bold text-red-800 text-sm">
          <TrendingUp className="w-4 h-4" /> Leads Calientes — Actúa Ahora
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-normal">{leads.length}</span>
        </h3>
        {callableIds.length > 0 && (
          <Link
            href={`/dialer?queue=${callableIds.join(",")}`}
            className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
          >
            <Phone className="w-3.5 h-3.5" /> Llamar a todos ({callableIds.length})
          </Link>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">Leads con mayor puntaje — listos para llamar. Quita (✕) los que ya contactaste.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {leads.slice(0, 8).map(l => (
          <div key={l.id} className="relative bg-white rounded-xl p-3 border border-red-100">
            <button
              onClick={() => remove(l.id)}
              title="Ya hablé con este lead — quitar de la lista"
              className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center justify-between mb-1 pr-4">
              <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                {(l.firstName?.[0] || "") + (l.lastName?.[0] || "")}
              </span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${l.leadScore >= 70 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                {l.leadScore}pts
              </span>
            </div>
            <Link href={`/contacts/${l.id}`}>
              <p className="text-xs font-semibold text-gray-900 hover:underline truncate">{l.firstName} {l.lastName}</p>
            </Link>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {l.lastContacted
                ? `Último contacto: ${Math.round((Date.now() - new Date(l.lastContacted).getTime()) / (24 * 3600000))}d`
                : "Sin contacto previo"}
            </p>
            {l.recentViews > 0 && <p className="text-[10px] text-blue-500 mt-0.5">👁 {l.recentViews} vistas recientes</p>}
            <div className="mt-2">
              {l.phone ? (
                <Link href={`/dialer?contactId=${l.id}`} className="block text-center text-[11px] font-semibold bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700">
                  📞 Llamar
                </Link>
              ) : l.email ? (
                <Link href={`/contacts/${l.id}`} className="block text-center text-[11px] font-semibold bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700">
                  ✉️ Email (sin teléfono)
                </Link>
              ) : (
                <span className="block text-center text-[11px] text-gray-400">Sin teléfono ni email</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
