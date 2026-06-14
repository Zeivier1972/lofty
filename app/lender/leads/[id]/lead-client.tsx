"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Home, BedDouble, MessageSquare, Loader2, CheckSquare, Square, Calculator, FileText, ChevronRight } from "lucide-react"

const LO_STATUSES = [
  { value: "NEW",            label: "Nuevo",            color: "bg-gray-100 text-gray-600" },
  { value: "CONTACTED",      label: "Contactado",        color: "bg-blue-100 text-blue-700" },
  { value: "PRE_APPROVED",   label: "Pre-aprobado",      color: "bg-indigo-100 text-indigo-700" },
  { value: "DOCS_REQUESTED", label: "Docs solicitados",  color: "bg-amber-100 text-amber-700" },
  { value: "CLOSED",         label: "Cerrado ✓",         color: "bg-green-100 text-green-700" },
  { value: "LOST",           label: "Perdido",           color: "bg-red-100 text-red-700" },
]

const DOCS = [
  "W-2 (últimos 2 años)",
  "Tax returns (últimos 2 años)",
  "Pay stubs (últimos 30 días)",
  "Bank statements (últimos 2 meses)",
  "Identificación (ID / pasaporte)",
  "Historial de crédito autorizado",
  "Carta de empleo",
  "Down payment comprobado",
]

interface Props {
  shareId: string
  loStatus: string
  contact: {
    firstName: string
    lastName: string | null
    phone: string | null
    email: string | null
    budgetMax: number | null
    budgetMin: number | null
    location: string | null
    propertyType: string | null
    bedroomsMin: number | null
    source: string | null
    createdAt: string
  }
  messages: { id: string; body: string; direction: string; createdAt: string }[]
  emails: { id: string; subject: string; createdAt: string }[]
  notes: { id: string; author: string; content: string; createdAt: string }[]
}

function calcMonthlyPayment(price: number, downPct: number, rate: number) {
  const principal = price * (1 - downPct / 100)
  const r = rate / 100 / 12
  const n = 360
  if (r === 0) return principal / n
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export default function LenderLeadClient({ shareId, loStatus, contact, messages, emails, notes: initialNotes }: Props) {
  const [status, setStatus] = useState(loStatus)
  const [savingStatus, setSavingStatus] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  // Mortgage calculator
  const [price, setPrice] = useState(contact.budgetMax || 400000)
  const [downPct, setDownPct] = useState(10)
  const [rate, setRate] = useState(7.0)
  const monthly = calcMonthlyPayment(price, downPct, rate)
  const loanAmount = price * (1 - downPct / 100)

  // Doc checklist (persisted in localStorage per share)
  const storageKey = `docs_${shareId}`
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setCheckedDocs(JSON.parse(saved))
    } catch {}
  }, [storageKey])

  function toggleDoc(doc: string) {
    const next = { ...checkedDocs, [doc]: !checkedDocs[doc] }
    setCheckedDocs(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  const docsCompleted = DOCS.filter(d => checkedDocs[d]).length

  async function updateStatus(newStatus: string) {
    setStatus(newStatus)
    setSavingStatus(true)
    try {
      await fetch(`/api/lender/leads/${shareId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loStatus: newStatus }),
      })
    } finally {
      setSavingStatus(false)
    }
  }

  async function addNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/lender/leads/${shareId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText }),
      })
      const data = await res.json()
      if (data.note) { setNotes([data.note, ...notes]); setNoteText("") }
    } finally {
      setSavingNote(false)
    }
  }

  const statusIdx = LO_STATUSES.findIndex(s => s.value === status)
  const pipelineSteps = LO_STATUSES.filter(s => s.value !== "LOST")

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Link href="/lender" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a mis leads
      </Link>

      {/* Contact card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{contact.firstName} {contact.lastName}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Lead desde {new Date(contact.createdAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
              {contact.source ? ` · ${contact.source}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            <select
              value={status}
              onChange={e => updateStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {LO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 mb-4">
          {contact.phone && (
            <a href={`tel:${contact.phone}`}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Phone className="w-4 h-4" /> Llamar
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`}
              className="flex-1 flex items-center justify-center gap-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Mail className="w-4 h-4" /> Email
            </a>
          )}
          {contact.phone && (
            <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-600 hover:bg-green-50 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </a>
          )}
        </div>

        {/* Property details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {contact.location && <span className="flex items-center gap-1.5 text-gray-600"><MapPin className="w-3.5 h-3.5 text-gray-400" />{contact.location}</span>}
          {(contact.budgetMax || contact.budgetMin) && (
            <span className="flex items-center gap-1.5 text-gray-600">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              {contact.budgetMin ? `$${contact.budgetMin.toLocaleString()} – $${(contact.budgetMax||0).toLocaleString()}` : `hasta $${(contact.budgetMax||0).toLocaleString()}`}
            </span>
          )}
          {contact.propertyType && <span className="flex items-center gap-1.5 text-gray-600"><Home className="w-3.5 h-3.5 text-gray-400" />{contact.propertyType.replace(/_/g, " ").toLowerCase()}</span>}
          {contact.bedroomsMin && <span className="flex items-center gap-1.5 text-gray-600"><BedDouble className="w-3.5 h-3.5 text-gray-400" />{contact.bedroomsMin}+ habitaciones</span>}
        </div>
      </div>

      {/* Pipeline progress */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Progreso del caso</h2>
        <div className="flex items-center gap-0">
          {pipelineSteps.map((s, i) => {
            const done = statusIdx >= i && status !== "LOST"
            const active = status === s.value
            return (
              <div key={s.value} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => updateStatus(s.value)}
                  className={`w-full text-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all truncate ${
                    active ? "bg-indigo-600 text-white shadow-sm" : done ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.label.replace(" ✓", "")}
                </button>
                {i < pipelineSteps.length - 1 && (
                  <ChevronRight className={`w-3 h-3 flex-shrink-0 mx-0.5 ${done && statusIdx > i ? "text-indigo-400" : "text-gray-200"}`} />
                )}
              </div>
            )
          })}
        </div>
        {status === "LOST" && (
          <p className="text-xs text-red-400 mt-2 text-center">Este lead fue marcado como perdido.</p>
        )}
      </div>

      {/* Mortgage calculator */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-500" /> Calculadora hipotecaria
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] text-gray-400 font-medium block mb-1">Precio de compra</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-medium block mb-1">Down payment %</label>
            <select
              value={downPct}
              onChange={e => setDownPct(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {[3.5, 5, 10, 15, 20, 25].map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-medium block mb-1">Tasa de interés %</label>
            <input
              type="number"
              step="0.1"
              value={rate}
              onChange={e => setRate(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-indigo-500 font-medium mb-0.5">Pago mensual</p>
            <p className="text-lg font-bold text-indigo-700">${Math.round(monthly).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-medium mb-0.5">Monto del préstamo</p>
            <p className="text-lg font-bold text-gray-700">${Math.round(loanAmount).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-medium mb-0.5">Down payment</p>
            <p className="text-lg font-bold text-gray-700">${Math.round(price * downPct / 100).toLocaleString()}</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">* Solo principal e interés — no incluye taxes ni seguro.</p>
      </div>

      {/* Document checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" /> Documentos para pre-aprobación
          </h2>
          <span className="text-xs font-medium text-indigo-600">{docsCompleted}/{DOCS.length}</span>
        </div>
        <div className="space-y-2">
          {DOCS.map(doc => (
            <button
              key={doc}
              onClick={() => toggleDoc(doc)}
              className="w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              {checkedDocs[doc]
                ? <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={`text-sm ${checkedDocs[doc] ? "line-through text-gray-400" : "text-gray-700"}`}>{doc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Mis notas</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addNote() }}
            placeholder="Ej: Hablé con el cliente, enviando pre-aprobación..."
            className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={addNote}
            disabled={savingNote || !noteText.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Agregar"}
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-gray-400">Tus notas son visibles para Catherine en el CRM.</p>
        ) : (
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="text-sm bg-gray-50 rounded-xl px-3.5 py-2.5">
                <p className="text-gray-700">{n.content}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString("es-US")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation history */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" /> Historial de conversación
        </h2>
        {messages.length === 0 && emails.length === 0 ? (
          <p className="text-xs text-gray-400">Sin mensajes registrados todavía.</p>
        ) : (
          <div className="space-y-2">
            {messages.map(m => (
              <div key={m.id} className={m.direction === "OUTBOUND" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.direction === "OUTBOUND" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === "OUTBOUND" ? "text-indigo-200" : "text-gray-400"}`}>
                    {new Date(m.createdAt).toLocaleString("es-US")}
                  </p>
                </div>
              </div>
            ))}
            {emails.length > 0 && (
              <div className="pt-3 mt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Emails enviados</p>
                {emails.map(e => (
                  <p key={e.id} className="text-xs text-gray-500">
                    ✉️ {e.subject} <span className="text-gray-300">· {new Date(e.createdAt).toLocaleDateString("es-US")}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
