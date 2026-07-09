"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Flame, Heart, Eye, Home, X, ChevronDown, ChevronUp, Loader2, Phone, Globe } from "lucide-react"

const LS_CONTACTS = "dismissed_hot_contacts"
const LS_PROPS = "dismissed_hot_properties"

interface HotContact { id: string; name: string; phone: string | null; email: string | null; saves: number; views: number; total: number }
interface HotProperty { id: string; address: string; price: number | null; saves: number; views: number; anonViews?: number; total: number }
interface PropertyLead { id: string; name: string; phone: string | null; email: string | null; stage: string | null; views: number; saves: number; total: number }

export default function HotActivity() {
  const [contacts, setContacts] = useState<HotContact[]>([])
  const [properties, setProperties] = useState<HotProperty[]>([])
  const [dismissedContacts, setDismissedContacts] = useState<Set<string>>(new Set())
  const [dismissedProps, setDismissedProps] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  // Tap a property → show WHO is behind its views/saves
  const [expandedProp, setExpandedProp] = useState<string | null>(null)
  const [propLeads, setPropLeads] = useState<Record<string, PropertyLead[]>>({})
  const [loadingLeads, setLoadingLeads] = useState<string | null>(null)

  async function toggleProperty(id: string) {
    if (expandedProp === id) { setExpandedProp(null); return }
    setExpandedProp(id)
    if (propLeads[id]) return
    setLoadingLeads(id)
    try {
      const res = await fetch(`/api/dashboard/property-leads?propertyId=${id}`)
      const d = await res.json()
      if (d.ok) setPropLeads(prev => ({ ...prev, [id]: d.leads || [] }))
    } catch {} finally {
      setLoadingLeads(null)
    }
  }

  useEffect(() => {
    const dc = new Set<string>(JSON.parse(localStorage.getItem(LS_CONTACTS) || "[]"))
    const dp = new Set<string>(JSON.parse(localStorage.getItem(LS_PROPS) || "[]"))
    setDismissedContacts(dc)
    setDismissedProps(dp)

    fetch("/api/dashboard/property-activity")
      .then(r => r.json())
      .then(d => { if (d.ok) { setContacts(d.hotContacts || []); setProperties(d.hotProperties || []) } })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  function dismissContact(id: string) {
    const next = new Set(dismissedContacts).add(id)
    setDismissedContacts(next)
    localStorage.setItem(LS_CONTACTS, JSON.stringify(Array.from(next)))
  }

  function dismissProperty(id: string) {
    const next = new Set(dismissedProps).add(id)
    setDismissedProps(next)
    localStorage.setItem(LS_PROPS, JSON.stringify(Array.from(next)))
  }

  const visibleContacts = contacts.filter(c => !dismissedContacts.has(c.id))
  const visibleProperties = properties.filter(p => !dismissedProps.has(p.id))

  if (!loaded || (visibleContacts.length === 0 && visibleProperties.length === 0)) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Hot buyers */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
          <Flame className="w-4 h-4 text-orange-500" /> Compradores calientes
        </h3>
        <p className="text-xs text-gray-400 mb-3">Leads que guardaron o vieron 3+ propiedades</p>
        {visibleContacts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aún no hay leads con 3+ interacciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visibleContacts.map(c => (
              <li key={c.id} className="flex items-center gap-2 group">
                <Link href={`/contacts/${c.id}`} className="flex items-center justify-between flex-1 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" />{c.saves}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{c.views}</span>
                  </div>
                </Link>
                <button
                  onClick={() => dismissContact(c.id)}
                  className="p-1 rounded-full text-gray-200 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  title="Mark as seen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
        <p className="text-xs text-gray-400 mb-3">❤️ guardadas · 👁 vistas de leads · 🌐 visitas web anónimas</p>
        {visibleProperties.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aún no hay propiedades con 3+ interacciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visibleProperties.map(p => {
              const isExpanded = expandedProp === p.id
              const leads = propLeads[p.id]
              return (
              <li key={p.id} className="group py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleProperty(p.id)}
                    className="flex items-center justify-between flex-1 min-w-0 text-left -mx-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Ver qué leads están detrás de esta actividad"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.address}</p>
                      <p className="text-xs text-lofty-700 font-semibold">{p.price ? `$${Number(p.price).toLocaleString()}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-500 flex-shrink-0 ml-2">
                      <span className="flex items-center gap-1" title="Guardada por leads"><Heart className="w-3.5 h-3.5 text-red-500" />{p.saves}</span>
                      <span className="flex items-center gap-1" title="Vistas de leads identificados"><Eye className="w-3.5 h-3.5" />{p.views}</span>
                      {(p.anonViews ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-gray-400" title="Visitas web anónimas (aún no son leads)"><Globe className="w-3.5 h-3.5" />{p.anonViews}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                  <button
                    onClick={() => dismissProperty(p.id)}
                    className="p-1 rounded-full text-gray-200 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="Mark as seen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Who's behind the numbers */}
                {isExpanded && (
                  <div className="mt-2 ml-1 rounded-xl bg-gray-50 border border-gray-100 p-2.5">
                    {loadingLeads === p.id ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando leads…</p>
                    ) : !leads || leads.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">
                        {(p.anonViews ?? 0) > 0
                          ? `🌐 Las ${p.anonViews} vistas son de visitantes anónimos del sitio web — gente navegando tus listings que aún no se ha identificado como lead (formulario, portal o clic en un email de Sofía).`
                          : "Sin leads identificados en esta propiedad."}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {leads.map(l => (
                          <li key={l.id}>
                            <Link
                              href={`/contacts/${l.id}`}
                              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{l.name}</p>
                                <p className="text-[11px] text-gray-400 truncate">
                                  {[l.stage, l.phone].filter(Boolean).join(" · ") || l.email || "—"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-shrink-0">
                                {l.saves > 0 && <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-red-500" />{l.saves}</span>}
                                <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{l.views}</span>
                                {l.phone && <Phone className="w-3 h-3 text-green-600" />}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
