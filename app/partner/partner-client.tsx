"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Handshake, Phone, Mail, MapPin, DollarSign, BedDouble, Clock, LogOut, Loader2, StickyNote, PhoneCall, ChevronDown, ChevronUp, Search, Building2, SlidersHorizontal } from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"

const PROP_TYPES = [
  { value: "Single Family Residence", label: "Casa" },
  { value: "Condominium", label: "Condo" },
  { value: "Townhouse", label: "Townhouse" },
  { value: "Multi Family", label: "Multi-Family" },
]

// Property tools for one referred lead: edit buyer prefs, search the IDX/MLS and
// send homes, and send pre-construction — the same actions the agent has in the CRM.
function LeadTools({ contact }: { contact: any }) {
  const [tab, setTab] = useState<"prefs" | "search" | "precon">("search")

  // ── Buyer preferences ──
  const [loc, setLoc] = useState(contact.buyerLocation || "")
  const [bmax, setBmax] = useState(contact.buyerBudgetMax != null ? String(contact.buyerBudgetMax) : "")
  const [beds, setBeds] = useState(contact.buyerBedroomsMin != null ? String(contact.buyerBedroomsMin) : "")
  const [ptype, setPtype] = useState(contact.buyerPropertyType || "")
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState("")

  async function savePrefs() {
    setSavingPrefs(true); setPrefsMsg("")
    try {
      const res = await fetch("/api/partner/prefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id, buyerLocation: loc, buyerBudgetMax: bmax, buyerBedroomsMin: beds, buyerPropertyType: ptype }),
      })
      if (!res.ok) throw new Error()
      setPrefsMsg("✓ Preferencias guardadas")
    } catch { setPrefsMsg("No se pudo guardar") } finally { setSavingPrefs(false) }
  }

  // ── IDX search + send ──
  const [mode, setMode] = useState<"sale" | "rent">("sale")
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Record<string, any>>({})
  const [sendMsg, setSendMsg] = useState("")
  const [sendingBatch, setSendingBatch] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const selectedList = Object.values(selected)

  async function runSearch() {
    setSearching(true); setResults([])
    try {
      const qs = new URLSearchParams()
      if (loc) qs.set("city", loc)
      if (bmax) qs.set("maxPrice", bmax)
      if (beds) qs.set("beds", beds)
      if (ptype) qs.set("type", ptype)
      qs.set("mode", mode); qs.set("limit", "12")
      const res = await fetch(`/api/idx/search?${qs.toString()}`)
      const d = await res.json()
      setResults(Array.isArray(d.results) ? d.results : (Array.isArray(d.listings) ? d.listings : []))
    } catch { setResults([]) } finally { setSearching(false) }
  }

  function toggleSelect(l: any) {
    setSelected(s => {
      const next = { ...s }
      if (next[l.listingKey]) delete next[l.listingKey]
      else next[l.listingKey] = l
      return next
    })
    setSendMsg("")
  }

  function batchBody(method: "email" | "sms", preview = false) {
    return JSON.stringify({
      method, preview,
      listings: selectedList.map((l: any) => ({
        address: l.address, city: l.city, state: l.state, price: l.price,
        beds: l.beds, baths: l.baths, sqft: l.sqft, photoUrl: l.photo,
        listingId: l.listingId, listingKey: l.listingKey,
      })),
    })
  }

  async function previewBatch() {
    if (!selectedList.length) { setSendMsg("Selecciona al menos una propiedad"); return }
    setPreviewLoading(true); setPreviewHtml(null)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/send-properties-batch`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: batchBody("email", true),
      })
      const d = await res.json()
      setPreviewHtml(d.ok ? (d.html || "") : "")
    } catch { setPreviewHtml("") } finally { setPreviewLoading(false) }
  }

  async function sendBatch(method: "email" | "sms") {
    if (!selectedList.length) { setSendMsg("Selecciona al menos una propiedad"); return }
    setSendingBatch(true); setSendMsg("Enviando…")
    try {
      const res = await fetch(`/api/contacts/${contact.id}/send-properties-batch`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: batchBody(method),
      })
      const d = await res.json()
      if (d.ok) { setSendMsg(`✓ ${selectedList.length} enviada(s) por ${method === "email" ? "email" : "SMS"}`); setSelected({}); setPreviewHtml(null) }
      else setSendMsg(d.error || "Error")
    } catch { setSendMsg("Error") } finally { setSendingBatch(false) }
  }

  // ── Pre-construction ──
  const [projects, setProjects] = useState<any[] | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [preconMsg, setPreconMsg] = useState("")
  const [loadingProjects, setLoadingProjects] = useState(false)

  async function loadProjects() {
    setLoadingProjects(true)
    try {
      const res = await fetch("/api/pre-construction")
      const d = await res.json()
      setProjects(Array.isArray(d) ? d : [])
    } catch { setProjects([]) } finally { setLoadingProjects(false) }
  }

  async function sendPrecon(method: "email" | "sms") {
    if (!sel.length) { setPreconMsg("Elige al menos un proyecto"); return }
    setPreconMsg("Enviando…")
    try {
      const res = await fetch(`/api/contacts/${contact.id}/send-preconstruction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: sel, method }),
      })
      const d = await res.json()
      setPreconMsg(d.ok ? `✓ Enviado por ${method === "email" ? "email" : "SMS"}` : (d.error || "Error"))
    } catch { setPreconMsg("Error") }
  }

  const priceStr = (p: number | null) => p == null ? "" : `$${Number(p).toLocaleString()}`

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/60">
      <div className="flex gap-1.5 mb-3">
        {[
          { id: "search", label: "Buscar y enviar", icon: Search },
          { id: "precon", label: "Preconstrucción", icon: Building2, onClick: () => { if (!projects) loadProjects() } },
          { id: "prefs", label: "Preferencias", icon: SlidersHorizontal },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as any); t.onClick?.() }}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border", tab === t.id ? "bg-lofty-600 text-white border-lofty-600" : "bg-white text-gray-600 border-gray-200")}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "prefs" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Ciudad / ZIP (ej: Doral, 33172)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            <input value={bmax} onChange={e => setBmax(e.target.value.replace(/[^\d]/g, ""))} placeholder="Presupuesto máx" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            <input value={beds} onChange={e => setBeds(e.target.value.replace(/[^\d]/g, ""))} placeholder="Cuartos mín" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            <select value={ptype} onChange={e => setPtype(e.target.value)} className="border rounded-lg px-2.5 py-1.5 text-sm">
              <option value="">Cualquier tipo</option>
              {PROP_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={savePrefs} disabled={savingPrefs} className="px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
              {savingPrefs ? "Guardando…" : "Guardar preferencias"}
            </button>
            {prefsMsg && <span className="text-xs text-emerald-600">{prefsMsg}</span>}
          </div>
        </div>
      )}

      {tab === "search" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button onClick={() => setMode("sale")} className={cn("px-3 py-1.5 text-xs font-semibold", mode === "sale" ? "bg-lofty-600 text-white" : "bg-white text-gray-600")}>En venta</button>
              <button onClick={() => setMode("rent")} className={cn("px-3 py-1.5 text-xs font-semibold", mode === "rent" ? "bg-lofty-600 text-white" : "bg-white text-gray-600")}>En renta</button>
            </div>
            <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Ciudad / ZIP" className="border rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-[120px]" />
            <input value={bmax} onChange={e => setBmax(e.target.value.replace(/[^\d]/g, ""))} placeholder="Precio máx" className="border rounded-lg px-2.5 py-1.5 text-sm w-28" />
            <button onClick={runSearch} disabled={searching} className="px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Buscar
            </button>
          </div>
          {results.length > 0 && (
            <>
              {/* Bulk action bar — select several and send them together */}
              <div className="flex flex-wrap items-center gap-2 sticky top-0 bg-gray-50/60 py-1">
                <span className="text-xs text-gray-500">{selectedList.length} seleccionada(s)</span>
                <button onClick={previewBatch} disabled={!selectedList.length || previewLoading} className="text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg px-2.5 py-1 disabled:opacity-40 flex items-center gap-1">
                  {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "👁"} Vista previa
                </button>
                <button onClick={() => sendBatch("email")} disabled={!selectedList.length || sendingBatch} className="text-xs font-semibold text-white bg-lofty-600 rounded-lg px-2.5 py-1 disabled:opacity-40">📧 Enviar email</button>
                <button onClick={() => sendBatch("sms")} disabled={!selectedList.length || sendingBatch} className="text-xs font-semibold text-white bg-lofty-600 rounded-lg px-2.5 py-1 disabled:opacity-40">💬 Enviar SMS</button>
                {sendMsg && <span className="text-xs text-emerald-600">{sendMsg}</span>}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map(l => {
                  const isSel = !!selected[l.listingKey]
                  return (
                    <label key={l.listingKey} className={cn("flex gap-3 border rounded-lg p-2 bg-white cursor-pointer", isSel ? "border-lofty-400 ring-1 ring-lofty-200" : "border-gray-200")}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(l)} className="mt-1 flex-shrink-0" />
                      {l.photo && <img src={l.photo} alt="" className="w-20 h-16 object-cover rounded-md flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-emerald-600">{priceStr(l.price)}</p>
                        <p className="text-xs text-gray-700 truncate">{l.address}</p>
                        <p className="text-[11px] text-gray-400">{[l.beds && `${l.beds} hab`, l.baths && `${l.baths} ba`, l.sqft && `${Number(l.sqft).toLocaleString()} sqft`].filter(Boolean).join(" · ")}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {!searching && results.length === 0 && <p className="text-xs text-gray-400">Busca propiedades del MLS, selecciona varias y envíalas juntas al lead.</p>}

          {/* Email preview modal */}
          {previewHtml !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewHtml(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-2 border-b">
                  <span className="text-sm font-semibold text-gray-700">Vista previa del email</span>
                  <button onClick={() => setPreviewHtml(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
                </div>
                <iframe title="preview" srcDoc={previewHtml} className="w-full flex-1 min-h-[400px] bg-white" />
                <div className="flex justify-end gap-2 px-4 py-2 border-t">
                  <button onClick={() => setPreviewHtml(null)} className="text-sm text-gray-600 px-3 py-1.5">Cerrar</button>
                  <button onClick={() => sendBatch("email")} disabled={sendingBatch} className="text-sm font-semibold text-white bg-lofty-600 rounded-lg px-4 py-1.5 disabled:opacity-50">Enviar email</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "precon" && (
        <div className="space-y-2">
          {loadingProjects || projects === null ? (
            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando proyectos…</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-gray-400">No hay proyectos de preconstrucción disponibles.</p>
          ) : (
            <>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {projects.map(p => {
                  const img = Array.isArray(p.photos) && p.photos[0] ? p.photos[0] : null
                  return (
                    <label key={p.id} className="flex items-center gap-2.5 text-sm border border-gray-200 rounded-lg p-2 bg-white cursor-pointer">
                      <input type="checkbox" checked={sel.includes(p.id)} onChange={e => setSel(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))} className="flex-shrink-0" />
                      {img
                        ? <img src={img} alt="" className="w-16 h-12 object-cover rounded-md flex-shrink-0" />
                        : <span className="w-16 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-gray-300" /></span>}
                      <span className="min-w-0">
                        <span className="font-semibold text-gray-800 block truncate">{p.name}</span>
                        <span className="text-[11px] text-gray-400">{[p.city, p.priceMin ? `desde $${Number(p.priceMin).toLocaleString()}` : ""].filter(Boolean).join(" · ")}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => sendPrecon("email")} className="text-[11px] font-semibold text-lofty-700 hover:underline">📧 Enviar por email</button>
                <button onClick={() => sendPrecon("sms")} className="text-[11px] font-semibold text-lofty-700 hover:underline">💬 Enviar por SMS</button>
                {preconMsg && <span className="text-[11px] text-emerald-600">{preconMsg}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface Update { id: string; author: string; kind: string; body: string; createdAt: string }
interface HistoryItem { id: string; ts: string; icon: string; who: string; text: string }
interface CrmStage { id: string; name: string }

interface Referral {
  id: string
  status: string
  notes: string | null
  sentAt: string
  contact: {
    id: string; firstName: string; lastName: string; phone: string | null; email: string | null
    buyerLocation: string | null; buyerBudgetMin: number | null; buyerBudgetMax: number | null
    buyerBedroomsMin: number | null; buyerPropertyType: string | null; buyerTimelineMonths: number | null
    pipelineLeads?: { stage: { id: string; name: string } | null }[]
  }
  updates: Update[]
  history: HistoryItem[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SENT:           { label: "New",            color: "bg-blue-50 text-blue-700 border-blue-200" },
  CONTACTED:      { label: "Contacted",      color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  SHOWING:        { label: "Showing",        color: "bg-purple-50 text-purple-700 border-purple-200" },
  UNDER_CONTRACT: { label: "Under Contract", color: "bg-amber-50 text-amber-700 border-amber-200" },
  CLOSED:         { label: "Closed ✓",       color: "bg-green-50 text-green-700 border-green-200" },
  LOST:           { label: "Lost",           color: "bg-gray-100 text-gray-500 border-gray-200" },
  RETURNED:       { label: "Returned",       color: "bg-red-50 text-red-600 border-red-200" },
}
const STATUSES = Object.keys(STATUS_META)

export default function PartnerClient({ partnerName, agentName, agentPhone, referrals: initialReferrals, crmStages }: {
  partnerName: string
  agentName: string
  agentPhone: string
  referrals: Referral[]
  crmStages: CrmStage[]
}) {
  const router = useRouter()
  const [referrals, setReferrals] = useState(initialReferrals)
  const [expanded, setExpanded] = useState<string | null>(initialReferrals[0]?.id || null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function updateReferral(referralId: string, payload: { status?: string; note?: string; kind?: string; crmStageId?: string }) {
    setSaving(referralId)
    try {
      const res = await fetch("/api/partner/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      const newStage = payload.crmStageId ? crmStages.find(st => st.id === payload.crmStageId) : null
      // Optimistically add what the partner just did to the shared history feed.
      const now = new Date().toISOString()
      const added: HistoryItem[] = []
      if (payload.note?.trim()) {
        added.push({ id: `tmp-${now}-n`, ts: now, icon: payload.kind === "CALL" ? "📞" : "📝", who: partnerName, text: payload.note.trim() })
      }
      if (payload.status) added.push({ id: `tmp-${now}-s`, ts: now, icon: "🔄", who: partnerName, text: `Estado → ${STATUS_META[payload.status]?.label || payload.status}` })
      if (newStage) added.push({ id: `tmp-${now}-c`, ts: now, icon: "🔄", who: partnerName, text: `Etapa CRM → ${newStage.name}` })
      setReferrals(prev => prev.map(r => {
        if (r.id !== referralId) return r
        return {
          ...r,
          status: payload.status || r.status,
          updates: [...(data.updates || []), ...r.updates],
          history: [...added, ...(r.history || [])],
          contact: newStage
            ? { ...r.contact, pipelineLeads: [{ stage: { id: newStage.id, name: newStage.name } }] }
            : r.contact,
        }
      }))
      if (payload.note) setNoteDrafts(d => ({ ...d, [referralId]: "" }))
    } catch (e: any) {
      alert(e.message)
    } finally { setSaving(null) }
  }

  async function logout() {
    await fetch("/api/partner/logout", { method: "POST" })
    router.push("/partner/login")
    router.refresh()
  }

  const active = referrals.filter(r => !["CLOSED", "LOST", "RETURNED"].includes(r.status))
  const done = referrals.filter(r => ["CLOSED", "LOST", "RETURNED"].includes(r.status))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a1628] to-[#1a2f50] px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Handshake className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-yellow-300 text-[11px] font-semibold tracking-widest uppercase">Partner Portal</p>
              <h1 className="text-white font-bold leading-tight">Hola, {partnerName} 👋</h1>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-blue-200 hover:text-white text-xs">
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <p className="text-sm text-gray-500">
          {active.length} active lead{active.length !== 1 ? "s" : ""} referred by <strong>{agentName}</strong>.
          Update the status and log your calls/notes — {agentName.split(" ")[0]} sees your progress automatically.
        </p>

        {[...active, ...done].map(r => {
          const c = r.contact
          const isOpen = expanded === r.id
          const budget = c.buyerBudgetMax
            ? `${c.buyerBudgetMin ? "$" + Number(c.buyerBudgetMin).toLocaleString() + " – " : "up to "}$${Number(c.buyerBudgetMax).toLocaleString()}`
            : null
          return (
            <div key={r.id} className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden", isOpen ? "border-lofty-300" : "border-gray-200")}>
              {/* Card header */}
              <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Referred {new Date(r.sentAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", STATUS_META[r.status]?.color)}>
                    {STATUS_META[r.status]?.label || r.status}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Contact info + prefs */}
                  <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-lofty-700 font-semibold">
                        <Phone className="w-4 h-4" />{formatPhone(c.phone)}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-gray-600 truncate">
                        <Mail className="w-4 h-4 flex-shrink-0" />{c.email}
                      </a>
                    )}
                    {c.buyerLocation && <p className="flex items-center gap-2 text-gray-600"><MapPin className="w-4 h-4" />{c.buyerLocation}</p>}
                    {budget && <p className="flex items-center gap-2 text-gray-600"><DollarSign className="w-4 h-4" />{budget}</p>}
                    {c.buyerBedroomsMin && <p className="flex items-center gap-2 text-gray-600"><BedDouble className="w-4 h-4" />{c.buyerBedroomsMin}+ bedrooms</p>}
                    {c.buyerTimelineMonths && <p className="flex items-center gap-2 text-gray-600"><Clock className="w-4 h-4" />~{c.buyerTimelineMonths} month timeline</p>}
                  </div>
                  {r.notes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <strong>Note from {agentName.split(" ")[0]}:</strong> {r.notes}
                    </p>
                  )}

                  {/* Status selector */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateReferral(r.id, { status: s })}
                          disabled={saving === r.id}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                            r.status === s ? STATUS_META[s].color + " ring-2 ring-offset-1 ring-lofty-300" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                          )}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CRM follow-up stage — drives automated texts/emails to the lead */}
                  {crmStages.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Seguimiento automático</p>
                      <p className="text-[11px] text-gray-400 mb-2">
                        Etapa del lead en el CRM — el sistema le envía los mensajes de seguimiento según la etapa.
                        {(() => {
                          const cur = c.pipelineLeads?.[0]?.stage
                          return cur && !crmStages.some(st => st.id === cur.id)
                            ? ` Etapa actual: ${cur.name}.`
                            : ""
                        })()}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {crmStages.map(st => {
                          const isCurrent = c.pipelineLeads?.[0]?.stage?.id === st.id
                          return (
                            <button
                              key={st.id}
                              onClick={() => !isCurrent && updateReferral(r.id, { crmStageId: st.id })}
                              disabled={saving === r.id}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                                isCurrent
                                  ? "bg-lofty-50 text-lofty-700 border-lofty-300 ring-2 ring-offset-1 ring-lofty-300"
                                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                              )}
                            >
                              {st.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add note / log call */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add update</p>
                    <textarea
                      value={noteDrafts[r.id] || ""}
                      onChange={e => setNoteDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="What happened? (called, left voicemail, showed 2 properties...)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => (noteDrafts[r.id] || "").trim() && updateReferral(r.id, { note: noteDrafts[r.id], kind: "NOTE" })}
                        disabled={saving === r.id || !(noteDrafts[r.id] || "").trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-semibold hover:bg-lofty-700 disabled:opacity-50"
                      >
                        {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />} Save note
                      </button>
                      <button
                        onClick={() => (noteDrafts[r.id] || "").trim() && updateReferral(r.id, { note: noteDrafts[r.id], kind: "CALL" })}
                        disabled={saving === r.id || !(noteDrafts[r.id] || "").trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-lofty-200 text-lofty-700 rounded-lg text-xs font-semibold hover:bg-lofty-50 disabled:opacity-50"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Log as call
                      </button>
                    </div>
                  </div>

                  {/* Property tools — same as the CRM: search IDX, send homes,
                      send pre-construction, edit buyer preferences. */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Herramientas de propiedades</p>
                    <LeadTools contact={r.contact} />
                  </div>

                  {/* Full shared history — the agent's notes + all lead activity
                      (emails opened, calls, texts, saves) + your own notes. */}
                  {(r.history?.length || 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historial completo del lead</p>
                      <ul className="space-y-2 max-h-72 overflow-y-auto">
                        {r.history.map(h => (
                          <li key={h.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 flex-shrink-0">{h.icon}</span>
                            <div className="min-w-0">
                              <p className="text-gray-700 whitespace-pre-wrap break-words">{h.text}</p>
                              <p className="text-[11px] text-gray-400">
                                {h.who ? `${h.who} · ` : ""}{new Date(h.ts).toLocaleString()}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {referrals.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <Handshake className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No leads referred to you yet.</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-6">
          Questions? Contact {agentName} · {agentPhone}
        </p>
      </div>
    </div>
  )
}
