"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Handshake, Plus, Phone, Mail, Pencil, Trash2, X, Loader2, Users, Eye, Link2, Check } from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"

interface Partner {
  id: string
  name: string
  email: string | null
  phone: string | null
  brokerage: string | null
  feePct: number | null
  isActive: boolean
  notes: string | null
  token: string | null
  referrals: { id: string; status: string }[]
}

interface Update { id: string; author: string; kind: string; body: string; createdAt: string }

interface Referral {
  id: string
  status: string
  notes: string | null
  sentAt: string
  updatedAt: string
  contact: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; buyerLocation: string | null; buyerBudgetMax: number | null }
  partner: { id: string; name: string; brokerage: string | null }
  updates: Update[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SENT:           { label: "Sent",           color: "bg-blue-50 text-blue-700 border-blue-200" },
  CONTACTED:      { label: "Contacted",      color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  SHOWING:        { label: "Showing",        color: "bg-purple-50 text-purple-700 border-purple-200" },
  UNDER_CONTRACT: { label: "Under Contract", color: "bg-amber-50 text-amber-700 border-amber-200" },
  CLOSED:         { label: "Closed ✓",       color: "bg-green-50 text-green-700 border-green-200" },
  LOST:           { label: "Lost",           color: "bg-gray-100 text-gray-500 border-gray-200" },
  RETURNED:       { label: "Returned",       color: "bg-red-50 text-red-600 border-red-200" },
}
const STATUSES = Object.keys(STATUS_META)
const ACTIVE_STATUSES = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"]

const EMPTY_FORM = { name: "", email: "", phone: "", brokerage: "", feePct: "", notes: "" }

export default function ReferralsClient({ partners: initialPartners, referrals: initialReferrals }: {
  partners: Partner[]
  referrals: Referral[]
}) {
  const router = useRouter()
  const [referrals, setReferrals] = useState(initialReferrals)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [partnerFilter, setPartnerFilter] = useState<string>("all")

  async function savePartner() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        brokerage: form.brokerage || null,
        feePct: form.feePct ? Number(form.feePct) : null,
        notes: form.notes || null,
      }
      await fetch(editingId ? `/api/referral-partners/${editingId}` : "/api/referral-partners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function deletePartner(id: string, name: string) {
    if (!confirm(`Delete partner "${name}"? Their referral history will also be removed.`)) return
    await fetch(`/api/referral-partners/${id}`, { method: "DELETE" })
    router.refresh()
  }

  async function updateStatus(referralId: string, status: string) {
    setReferrals(prev => prev.map(r => r.id === referralId ? { ...r, status } : r))
    await fetch(`/api/referrals/${referralId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const visibleReferrals = referrals.filter(r => {
    if (statusFilter === "ACTIVE" && !ACTIVE_STATUSES.includes(r.status)) return false
    if (statusFilter !== "ACTIVE" && statusFilter !== "all" && r.status !== statusFilter) return false
    if (partnerFilter !== "all" && r.partner.id !== partnerFilter) return false
    return true
  })

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Handshake className="w-6 h-6 text-lofty-600" /> Lead Referrals
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Share leads with partner realtors and track how they&apos;re serviced</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Partner
        </button>
      </div>

      {/* Partner cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialPartners.length === 0 && (
          <div className="col-span-full bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No referral partners yet</p>
            <p className="text-sm text-gray-400 mt-1">Add the realtors you share leads with to start tracking referrals.</p>
          </div>
        )}
        {initialPartners.map(p => {
          const active = p.referrals.filter(r => ACTIVE_STATUSES.includes(r.status)).length
          const closed = p.referrals.filter(r => r.status === "CLOSED").length
          return (
            <div key={p.id} className={cn("bg-white rounded-2xl border p-5 shadow-sm", p.isActive ? "border-gray-200" : "border-gray-100 opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{p.name}</p>
                  {p.brokerage && <p className="text-xs text-gray-400 truncate">{p.brokerage}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(p.id)
                      setForm({ name: p.name, email: p.email || "", phone: p.phone || "", brokerage: p.brokerage || "", feePct: p.feePct != null ? String(p.feePct) : "", notes: p.notes || "" })
                      setShowForm(true)
                    }}
                    className="p-1.5 text-gray-400 hover:text-lofty-600 hover:bg-gray-50 rounded-lg"
                  ><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deletePartner(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {p.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3 h-3" />{formatPhone(p.phone)}</p>}
                {p.email && <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{p.email}</p>}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-center">
                <div className="flex-1"><p className="text-lg font-bold text-gray-900">{p.referrals.length}</p><p className="text-[11px] text-gray-400">Total</p></div>
                <div className="flex-1"><p className="text-lg font-bold text-blue-600">{active}</p><p className="text-[11px] text-gray-400">Active</p></div>
                <div className="flex-1"><p className="text-lg font-bold text-green-600">{closed}</p><p className="text-[11px] text-gray-400">Closed</p></div>
                {p.feePct != null && <div className="flex-1"><p className="text-lg font-bold text-amber-600">{p.feePct}%</p><p className="text-[11px] text-gray-400">Fee</p></div>}
              </div>
              {p.token && (
                <div className="flex gap-2 mt-3">
                  <a
                    href={`/partner/login?token=${p.token}&preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 text-gray-600 hover:text-lofty-700 hover:border-lofty-300 rounded-lg text-xs font-medium transition-colors"
                    title="Open their portal exactly as they see it"
                  >
                    <Eye className="w-3.5 h-3.5" /> View portal
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/partner/login?token=${p.token}`)
                      setCopiedId(p.id)
                      setTimeout(() => setCopiedId(null), 2000)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 text-gray-600 hover:text-lofty-700 hover:border-lofty-300 rounded-lg text-xs font-medium transition-colors"
                    title="Copy their access link to share by WhatsApp/text"
                  >
                    {copiedId === p.id ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied!</> : <><Link2 className="w-3.5 h-3.5" /> Copy link</>}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add/edit partner form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editingId ? "Edit Partner" : "Add Referral Partner"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              <input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))} placeholder="Brokerage"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              </div>
              <input value={form.feePct} onChange={e => setForm(f => ({ ...f, feePct: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="Referral fee % (e.g. 25)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (agreement details, specialties...)" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500" />
            </div>
            <button onClick={savePartner} disabled={saving || !form.name.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-lofty-600 text-white rounded-xl hover:bg-lofty-700 disabled:opacity-50 font-semibold text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Add partner"}
            </button>
          </div>
        </div>
      )}

      {/* Referral tracking */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-gray-900 mr-auto">Referred Leads ({visibleReferrals.length})</h2>
          <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600">
            <option value="all">All partners</option>
            {initialPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600">
            <option value="ACTIVE">Active (needs tracking)</option>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>

        {visibleReferrals.length === 0 ? (
          <div className="p-10 text-center">
            <Handshake className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              No referrals here yet. Open a contact and click <strong>Refer to Partner</strong> to share a lead.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-2.5 font-semibold">Lead</th>
                  <th className="px-5 py-2.5 font-semibold">Partner</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Sent</th>
                  <th className="px-5 py-2.5 font-semibold">Partner activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleReferrals.map(r => {
                  const latest = r.updates?.[0]
                  const isExpanded = expandedId === r.id
                  return (
                  <Fragment key={r.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/contacts/${r.contact.id}`} className="font-medium text-lofty-700 hover:underline">
                        {r.contact.firstName} {r.contact.lastName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {[r.contact.phone ? formatPhone(r.contact.phone) : null, r.contact.buyerLocation].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-gray-800">{r.partner.name}</p>
                      {r.partner.brokerage && <p className="text-xs text-gray-400">{r.partner.brokerage}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={r.status}
                        onChange={e => updateStatus(r.id, e.target.value)}
                        className={cn("border rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer", STATUS_META[r.status]?.color || "bg-gray-50")}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{new Date(r.sentAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      {latest ? (
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="text-left group">
                          <p className="text-xs text-gray-700 max-w-[220px] truncate">
                            {latest.kind === "CALL" ? "📞 " : latest.kind === "STATUS" ? "🔄 " : "📝 "}{latest.body}
                          </p>
                          <p className="text-[11px] text-gray-400 group-hover:text-lofty-600">
                            {new Date(latest.createdAt).toLocaleDateString()} · {r.updates.length} update{r.updates.length > 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}
                          </p>
                        </button>
                      ) : (
                        <p className="text-xs text-gray-300 italic">No activity yet</p>
                      )}
                    </td>
                  </tr>
                  {isExpanded && r.updates.length > 0 && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={5} className="px-5 py-3">
                        <ul className="space-y-1.5">
                          {r.updates.map(u => (
                            <li key={u.id} className="text-xs text-gray-600 flex items-start gap-2">
                              <span>{u.kind === "CALL" ? "📞" : u.kind === "STATUS" ? "🔄" : "📝"}</span>
                              <span className="flex-1">{u.body}</span>
                              <span className="text-gray-400 flex-shrink-0">{new Date(u.createdAt).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
