"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Home, BedDouble, MessageSquare, Loader2, CheckCircle2 } from "lucide-react"

const LO_STATUSES = [
  { value: "NEW", label: "Nuevo" },
  { value: "CONTACTED", label: "Contactado" },
  { value: "PRE_APPROVED", label: "Pre-aprobado" },
  { value: "DOCS_REQUESTED", label: "Docs solicitados" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "LOST", label: "Perdido" },
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

export default function LenderLeadClient({ shareId, loStatus, contact, messages, emails, notes: initialNotes }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(loStatus)
  const [savingStatus, setSavingStatus] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [justPaid, setJustPaid] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("paid") === "1"
  )

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
      if (data.note) {
        setNotes([{ ...data.note }, ...notes])
        setNoteText("")
      }
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/lender" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a mis leads
      </Link>

      {justPaid && (
        <div className="mb-5 flex items-center gap-2 p-3.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          ¡Pago confirmado! Este lead es tuyo — aquí está toda la información.
          <button onClick={() => setJustPaid(false)} className="ml-auto text-green-400 hover:text-green-600">×</button>
        </div>
      )}

      {/* Contact card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-lg font-bold text-gray-900">{contact.firstName} {contact.lastName}</h1>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
              <Phone className="w-4 h-4" />{contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 truncate">
              <Mail className="w-4 h-4 shrink-0" /><span className="truncate">{contact.email}</span>
            </a>
          )}
          {contact.location && (
            <span className="flex items-center gap-2 text-gray-600"><MapPin className="w-4 h-4 text-gray-400" />{contact.location}</span>
          )}
          {(contact.budgetMax || contact.budgetMin) && (
            <span className="flex items-center gap-2 text-gray-600">
              <DollarSign className="w-4 h-4 text-gray-400" />
              {contact.budgetMin ? `$${contact.budgetMin.toLocaleString()} – ` : "hasta "}${(contact.budgetMax || 0).toLocaleString()}
            </span>
          )}
          {contact.propertyType && (
            <span className="flex items-center gap-2 text-gray-600"><Home className="w-4 h-4 text-gray-400" />{contact.propertyType.replace(/_/g, " ").toLowerCase()}</span>
          )}
          {contact.bedroomsMin && (
            <span className="flex items-center gap-2 text-gray-600"><BedDouble className="w-4 h-4 text-gray-400" />{contact.bedroomsMin}+ habitaciones</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Mis notas</h2>
        <div className="flex gap-2 mb-4">
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
          <div className="space-y-2.5">
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
          <MessageSquare className="w-4 h-4 text-gray-400" />
          Historial de conversación
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
