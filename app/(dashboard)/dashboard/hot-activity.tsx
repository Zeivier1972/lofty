"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Flame, Heart, Eye, Home } from "lucide-react"

interface HotContact { id: string; name: string; phone: string | null; email: string | null; saves: number; views: number; total: number }
interface HotProperty { id: string; address: string; price: number | null; saves: number; views: number; total: number }

export default function HotActivity() {
  const [contacts, setContacts] = useState<HotContact[]>([])
  const [properties, setProperties] = useState<HotProperty[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/dashboard/property-activity")
      .then(r => r.json())
      .then(d => { if (d.ok) { setContacts(d.hotContacts || []); setProperties(d.hotProperties || []) } })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || (contacts.length === 0 && properties.length === 0)) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Hot buyers */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
          <Flame className="w-4 h-4 text-orange-500" /> Compradores calientes
        </h3>
        <p className="text-xs text-gray-400 mb-3">Leads que guardaron o vieron 3+ propiedades</p>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aún no hay leads con 3+ interacciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {contacts.map(c => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" />{c.saves}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{c.views}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hot properties */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
          <Home className="w-4 h-4 text-lofty-600" /> Propiedades populares
        </h3>
        <p className="text-xs text-gray-400 mb-3">Guardadas o vistas 3+ veces</p>
        {properties.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aún no hay propiedades con 3+ interacciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {properties.map(p => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.address}</p>
                  <p className="text-xs text-lofty-700 font-semibold">{p.price ? `$${Number(p.price).toLocaleString()}` : ""}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 ml-2">
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" />{p.saves}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{p.views}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
