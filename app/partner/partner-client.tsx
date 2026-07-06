"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Handshake, Phone, Mail, MapPin, DollarSign, BedDouble, Clock, LogOut, Loader2, StickyNote, PhoneCall, ChevronDown, ChevronUp } from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"

interface Update { id: string; author: string; kind: string; body: string; createdAt: string }
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
      setReferrals(prev => prev.map(r => {
        if (r.id !== referralId) return r
        return {
          ...r,
          status: payload.status || r.status,
          updates: [...(data.updates || []), ...r.updates],
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

                  {/* History */}
                  {r.updates.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History</p>
                      <ul className="space-y-2 max-h-56 overflow-y-auto">
                        {r.updates.map(u => (
                          <li key={u.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 flex-shrink-0">
                              {u.kind === "CALL" ? "📞" : u.kind === "STATUS" ? "🔄" : "📝"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-gray-700">{u.body}</p>
                              <p className="text-[11px] text-gray-400">
                                {u.author === "AGENT" ? agentName : "You"} · {new Date(u.createdAt).toLocaleString()}
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
