"use client"

import { useEffect, useState } from "react"
import { Building2, ChevronDown, ChevronUp, Loader2, Mail, MessageSquare, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  neighborhood?: string
  city?: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  description?: string
  photos?: string[]
  mlsId?: string        // shown to the AGENT only — never sent to leads
  propertyType?: string
}

// Normalize MLS subtypes to short labels for the filter chips
function typeLabel(t?: string): string {
  const s = (t || "").toLowerCase()
  if (s.includes("single")) return "Single Family"
  if (s.includes("condo")) return "Condo"
  if (s.includes("town")) return "Townhouse"
  if (s.includes("multi")) return "Multi-Family"
  if (s.includes("villa")) return "Villa"
  return t || ""
}

function area(p: Project) {
  return [p.neighborhood, p.city].filter(Boolean).join(", ") || p.zipCode || "Miami area"
}
function priceRange(p: Project) {
  if (p.priceMin && p.priceMax) return `$${Number(p.priceMin).toLocaleString()} – $${Number(p.priceMax).toLocaleString()}`
  if (p.priceMax) return `up to $${Number(p.priceMax).toLocaleString()}`
  if (p.priceMin) return `from $${Number(p.priceMin).toLocaleString()}`
  return ""
}

export default function PreconstructionSendPanel({ contactId, contactEmail, contactPhone }: {
  contactId: string
  contactEmail: string | null
  contactPhone: string | null
}) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState("")
  const [sending, setSending] = useState<"email" | "sms" | null>(null)
  const [sentMsg, setSentMsg] = useState<string | null>(null)
  // Filters — like the website search: by city and property type
  const [cityFilter, setCityFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")

  const cities = Array.from(new Set(projects.map(p => (p.city || "").trim()).filter(Boolean))).sort()
  const types = Array.from(new Set(projects.map(p => typeLabel(p.propertyType)).filter(Boolean))).sort()

  const visibleProjects = projects.filter(p => {
    const cityOk = cityFilter === "ALL" || (p.city || "").trim() === cityFilter
    const typeOk = typeFilter === "ALL" || typeLabel(p.propertyType) === typeFilter
    return cityOk && typeOk
  })

  useEffect(() => {
    if (!open || loaded) return
    fetch("/api/pre-construction")
      .then(r => r.json())
      .then(d => setProjects(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [open, loaded])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function send(method: "email" | "sms") {
    if (selected.size === 0) return
    setSending(method)
    setSentMsg(null)
    try {
      const res = await fetch(`/api/contacts/${contactId}/send-preconstruction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: Array.from(selected), method, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Send failed")
      setSentMsg(`✅ Sent ${data.sent} project${data.sent !== 1 ? "s" : ""} via ${method}`)
      setSelected(new Set())
      setNote("")
    } catch (e: any) {
      setSentMsg(`⚠️ ${e.message}`)
    } finally { setSending(null) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Send Pre-Construction</p>
            <p className="text-xs text-gray-400">Exclusive new-development projects — commission-protected</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {!loaded ? (
            <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-amber-600 mx-auto" /></div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No pre-construction projects yet. Add them in the Pre-Construction section first.
            </p>
          ) : (
            <>
              {/* City + property type filters (agent-side, like the website search) */}
              {(cities.length > 1 || types.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {cities.length > 1 && (
                    <select
                      value={cityFilter}
                      onChange={e => setCityFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="ALL">Todas las ciudades</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setTypeFilter("ALL")}
                        className={cn("text-xs px-2 py-1 rounded-full border",
                          typeFilter === "ALL" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}
                      >
                        Todos
                      </button>
                      {types.map(t => (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
                          className={cn("text-xs px-2 py-1 rounded-full border",
                            typeFilter === t ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {visibleProjects.length !== projects.length && (
                    <span className="text-[11px] text-gray-400">{visibleProjects.length} de {projects.length}</span>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {visibleProjects.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Sin proyectos con esos filtros.</p>
                )}
                {visibleProjects.map(p => {
                  const isSel = selected.has(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={cn("w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors",
                        isSel ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300")}
                    >
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border",
                        isSel ? "bg-amber-500 border-amber-500" : "border-gray-300")}>
                        {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      {p.photos?.[0]
                        ? <img src={p.photos[0]} alt={area(p)} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-gray-300" /></div>}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{area(p)}</p>
                        <p className="text-xs text-gray-500">
                          {[priceRange(p), p.bedrooms ? `${p.bedrooms} bd` : "", p.deliveryDate].filter(Boolean).join(" · ")}
                        </p>
                        {(p.propertyType || p.mlsId) && (
                          <p className="text-[11px] text-gray-400 truncate">
                            {typeLabel(p.propertyType)}
                            {p.propertyType && p.mlsId ? " · " : ""}
                            {p.mlsId && <span className="font-mono" title="Solo para ti — nunca se envía al lead">MLS# {p.mlsId}</span>}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Add a personal note (optional)…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              {sentMsg && <p className="text-sm text-center text-gray-600">{sentMsg}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => send("email")}
                  disabled={!!sending || selected.size === 0 || !contactEmail}
                  title={!contactEmail ? "This contact has no email address" : "Send by email"}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-lofty-600 text-white hover:bg-lofty-700 disabled:opacity-50"
                >
                  {sending === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send {selected.size} via Email
                </button>
                <button
                  onClick={() => send("sms")}
                  disabled={!!sending || selected.size === 0 || !contactPhone}
                  title={!contactPhone ? "This contact has no phone number" : "Send by SMS"}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border border-lofty-300 text-lofty-700 hover:bg-lofty-50 disabled:opacity-50"
                >
                  {sending === "sms" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Send {selected.size} via SMS
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Leads only see area, price range, beds, delivery date, description &amp; photo — never the builder, community name, or URL.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
