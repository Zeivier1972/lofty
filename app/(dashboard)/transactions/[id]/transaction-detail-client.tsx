"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, CheckCircle2, Circle, Clock, Plus, Trash2,
  ExternalLink, FileText, Link2, Loader2, AlertCircle, User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

const STATUSES = [
  { value: "ACTIVE_LISTING", label: "Active Listing" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "APPRAISAL", label: "Appraisal" },
  { value: "CLEAR_TO_CLOSE", label: "Clear to Close" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
]

const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"]
const MILESTONE_STATUS_ICON = {
  COMPLETED: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  IN_PROGRESS: <Clock className="w-5 h-5 text-blue-500 animate-pulse" />,
  PENDING: <Circle className="w-5 h-5 text-gray-300" />,
}

interface Milestone {
  id: string; name: string; status: string; dueDate: string | null
  completedDate: string | null; notes: string | null; order: number
}
interface Document { id: string; name: string; url: string; fileType: string | null; uploadedAt: string }
interface Transaction {
  id: string; title: string; address: string; city: string; state: string
  type: string; status: string; salePrice: number | null; listPrice: number | null
  closeDate: string | null; contractDate: string | null; notes: string | null
  milestones: Milestone[]; documents: Document[]
  contact: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null
}

export default function TransactionDetailClient({ transaction: initial }: { transaction: Transaction }) {
  const [tx, setTx] = useState(initial)
  const [milestones, setMilestones] = useState<Milestone[]>(initial.milestones)
  const [documents, setDocuments] = useState<Document[]>(initial.documents)
  const [savingStatus, setSavingStatus] = useState(false)
  const [newMilestone, setNewMilestone] = useState("")
  const [newMilestoneDue, setNewMilestoneDue] = useState("")
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [newDocUrl, setNewDocUrl] = useState("")
  const [addingDoc, setAddingDoc] = useState(false)
  const { toast } = useToast()

  async function updateStatus(status: string) {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      setTx(prev => ({ ...prev, status: data.transaction.status }))
      toast({ title: "Estado actualizado", description: STATUSES.find(s => s.value === status)?.label })
    } finally {
      setSavingStatus(false)
    }
  }

  async function toggleMilestone(m: Milestone) {
    const nextStatus = m.status === "COMPLETED" ? "PENDING" : m.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED"
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, status: nextStatus } : x))
    await fetch(`/api/transactions/${tx.id}/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
  }

  async function addMilestone() {
    if (!newMilestone.trim()) return
    setAddingMilestone(true)
    try {
      const res = await fetch(`/api/transactions/${tx.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMilestone, dueDate: newMilestoneDue || undefined, order: milestones.length }),
      })
      const data = await res.json()
      setMilestones(prev => [...prev, data.milestone])
      setNewMilestone("")
      setNewMilestoneDue("")
    } finally {
      setAddingMilestone(false)
    }
  }

  async function deleteMilestone(id: string) {
    setMilestones(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/transactions/${tx.id}/milestones/${id}`, { method: "DELETE" })
  }

  async function addDocument() {
    if (!newDocName.trim() || !newDocUrl.trim()) return
    setAddingDoc(true)
    try {
      const res = await fetch(`/api/transactions/${tx.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDocName, url: newDocUrl }),
      })
      const data = await res.json()
      setDocuments(prev => [data.doc, ...prev])
      setNewDocName("")
      setNewDocUrl("")
    } finally {
      setAddingDoc(false)
    }
  }

  async function deleteDocument(id: string) {
    setDocuments(prev => prev.filter(d => d.id !== id))
    await fetch(`/api/transactions/${tx.id}/documents/${id}`, { method: "DELETE" })
  }

  const completed = milestones.filter(m => m.status === "COMPLETED").length
  const progress = milestones.length ? Math.round((completed / milestones.length) * 100) : 0

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transactions" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{tx.address}</h1>
          <p className="text-sm text-gray-400">{tx.city}, {tx.state} · {tx.type}</p>
        </div>
        {tx.contact && (
          <Link href={`/contacts/${tx.contact.id}`} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-indigo-50">
            <User className="w-3.5 h-3.5" />
            {tx.contact.firstName} {tx.contact.lastName}
          </Link>
        )}
      </div>

      {/* Status + Price row */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Estado</p>
            <div className="flex items-center gap-2">
              <select
                value={tx.status}
                onChange={e => updateStatus(e.target.value)}
                disabled={savingStatus}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {savingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
          </div>
          {tx.salePrice && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Precio de venta</p>
              <p className="font-bold text-gray-900">${tx.salePrice.toLocaleString()}</p>
            </div>
          )}
          {tx.closeDate && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Cierre</p>
              <p className="font-semibold text-gray-800">{new Date(tx.closeDate).toLocaleDateString("es-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
          {/* Progress */}
          {milestones.length > 0 && (
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progreso</span>
                <span>{completed}/{milestones.length} hitos</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        {tx.contact && (
          <p className="mt-3 text-xs text-gray-400">
            Este progreso es visible en el portal del cliente de <strong>{tx.contact.firstName}</strong>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Hitos del proceso
          </h2>

          <div className="space-y-1.5">
            {milestones.length === 0 && (
              <p className="text-xs text-gray-400 py-2">Sin hitos. Agrega los pasos del proceso.</p>
            )}
            {milestones.map(m => (
              <div key={m.id} className="flex items-center gap-3 group">
                <button onClick={() => toggleMilestone(m)} className="flex-shrink-0 transition-transform hover:scale-110">
                  {MILESTONE_STATUS_ICON[m.status as keyof typeof MILESTONE_STATUS_ICON] || MILESTONE_STATUS_ICON.PENDING}
                </button>
                <span className={cn("flex-1 text-sm", m.status === "COMPLETED" && "line-through text-gray-400")}>
                  {m.name}
                </span>
                {m.dueDate && m.status !== "COMPLETED" && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(m.dueDate).toLocaleDateString("es-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                <button
                  onClick={() => deleteMilestone(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add milestone */}
          <div className="pt-2 border-t border-gray-50 space-y-2">
            <input
              value={newMilestone}
              onChange={e => setNewMilestone(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addMilestone() }}
              placeholder="Nuevo hito (ej: Inspección completada)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newMilestoneDue}
                onChange={e => setNewMilestoneDue(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <Button
                onClick={addMilestone}
                disabled={addingMilestone || !newMilestone.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                {addingMilestone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Agregar
              </Button>
            </div>
          </div>

          {/* Quick add templates */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider">Plantillas rápidas</p>
            <div className="flex flex-wrap gap-1.5">
              {["Oferta aceptada", "Inspección", "Appraisal", "Seguro de título", "Aprobación final", "Firma de cierre", "Entrega de llaves"].map(t => (
                <button
                  key={t}
                  onClick={() => setNewMilestone(t)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Documentos del cliente
          </h2>

          <div className="space-y-2">
            {documents.length === 0 && (
              <p className="text-xs text-gray-400 py-2">Sin documentos. Comparte links de Google Drive, Dropbox, etc.</p>
            )}
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 group">
                <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-blue-600 hover:text-blue-700 truncate flex items-center gap-1"
                >
                  {doc.name}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add document */}
          <div className="pt-2 border-t border-gray-50 space-y-2">
            <input
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              placeholder="Nombre del documento (ej: Contrato de compra)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <input
                value={newDocUrl}
                onChange={e => setNewDocUrl(e.target.value)}
                placeholder="Link de Google Drive, Dropbox…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <Button
                onClick={addDocument}
                disabled={addingDoc || !newDocName.trim() || !newDocUrl.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                {addingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Agregar
              </Button>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-gray-400">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              Asegúrate de que el link sea público o compartido antes de agregarlo.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
