"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users, Plus, Search, Download, Upload,
  Phone, Mail, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreVertical,
  Trash2, Edit, Eye, MessageSquare, X, Send, CheckSquare,
  FileText, AlertCircle, CheckCircle2, Zap, Settings2, MoveRight, Loader2,
  PhoneCall, PhoneOff, SkipForward, CheckCircle, Clock, Tag, Voicemail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatPhone, getInitials } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import HelpPanel from "@/components/help-panel"

const STATUSES = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE_CLIENT", label: "Active Client" },
  { value: "PAST_CLIENT", label: "Past Client" },
  { value: "SPHERE_OF_INFLUENCE", label: "Sphere" },
]

const SOURCES = [
  "WEBSITE", "REFERRAL", "ZILLOW", "REALTOR", "FACEBOOK",
  "INSTAGRAM", "GOOGLE", "OPEN_HOUSE", "COLD_CALL", "OTHER",
]

interface Stage {
  id: string
  name: string
  color: string
  order: number
}

interface ContactsClientProps {
  contacts: any[]
  total: number
  page: number
  pageSize: number
  tags: any[]
  filters: { status?: string; search?: string; source?: string; tags?: string; smartPlanId?: string; smartPlanEnrolled?: string }
  activeTab: string
  stageCounts: Record<string, number>
  stages: Stage[]
  pipelineId: string
}

function PipelineSettingsModal({
  stages: initialStages,
  pipelineId,
  onClose,
  onSaved,
}: {
  stages: Stage[]
  pipelineId: string
  onClose: () => void
  onSaved: (stages: Stage[]) => void
}) {
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function addStage() {
    if (!newName.trim()) return
    try {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, name: newName.trim(), color: "#3B82F6" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStages(s => [...s, data])
      setNewName("")
    } catch (e: any) {
      toast({ title: e.message || "Failed to add stage", variant: "destructive" })
    }
  }

  async function deleteStage(id: string) {
    try {
      const res = await fetch(`/api/pipeline/stages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setStages(s => s.filter(x => x.id !== id))
    } catch (e: any) {
      toast({ title: e.message || "Failed to delete stage", variant: "destructive" })
    }
  }

  function handleSave() {
    onSaved(stages)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900 uppercase tracking-wide text-sm">Pipeline Settings</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add new stage */}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addStage()}
              placeholder="Add new pipeline stage"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none"
            />
            <Button onClick={addStage} disabled={!newName.trim()} size="sm" className="bg-lofty-100 text-lofty-700 hover:bg-lofty-200 border-0 font-semibold">
              OK
            </Button>
          </div>

          {/* Stage list */}
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {stages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No stages yet. Add one above.</p>
            )}
            {stages.map(stage => (
              <div key={stage.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 bg-white hover:bg-gray-50">
                <div className="flex flex-col gap-0.5 cursor-grab text-gray-300">
                  <div className="flex gap-0.5"><span className="w-1 h-1 bg-gray-300 rounded-full" /><span className="w-1 h-1 bg-gray-300 rounded-full" /></div>
                  <div className="flex gap-0.5"><span className="w-1 h-1 bg-gray-300 rounded-full" /><span className="w-1 h-1 bg-gray-300 rounded-full" /></div>
                  <div className="flex gap-0.5"><span className="w-1 h-1 bg-gray-300 rounded-full" /><span className="w-1 h-1 bg-gray-300 rounded-full" /></div>
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{stage.name}</span>
                <button onClick={() => deleteStage(stage.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={handleSave} className="flex-1 bg-lofty-600 hover:bg-lofty-700">Save</Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; updated?: number; stagePlaced?: number; stageMoved?: number; emailsSent?: number; skipped: number; errors: string[]; total: number } | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; imported: number } | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const { toast } = useToast()

  function parsePreview(raw: string) {
    const lines = raw.trim().split(/\r?\n/).filter(l => l.trim()).slice(0, 6)
    if (lines.length < 2) return null
    const parseRow = (row: string): string[] => {
      const result: string[] = []
      let cur = "", inQ = false
      for (const ch of row) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = "" }
        else { cur += ch }
      }
      result.push(cur.trim())
      return result
    }
    const headers = parseRow(lines[0])
    const rows = lines.slice(1).map(parseRow)
    return { headers, rows }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsv(text)
      setPreview(parsePreview(text))
    }
    reader.readAsText(file)
  }

  function handlePaste(text: string) {
    setCsv(text)
    setPreview(parsePreview(text))
  }

  async function handleImport() {
    if (!csv.trim()) return
    setImporting(true)
    setProgress(null)

    const lines = csv.trim().split(/\r?\n/).filter((l: string) => l.trim())
    const header = lines[0]
    const dataRows = lines.slice(1)
    const CHUNK = 500
    const chunks: string[] = []
    for (let i = 0; i < dataRows.length; i += CHUNK) {
      chunks.push([header, ...dataRows.slice(i, i + CHUNK)].join("\n"))
    }

    const totals = { imported: 0, updated: 0, stagePlaced: 0, stageMoved: 0, skipped: 0, emailsSent: 0, errors: [] as string[], total: dataRows.length }

    async function sendChunk(chunkCsv: string, attempt = 1): Promise<any> {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: chunkCsv }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt))
          return sendChunk(chunkCsv, attempt + 1)
        }
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return data
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const rowsDone = i * CHUNK
        setProgress({ done: rowsDone, total: dataRows.length, imported: totals.imported })
        const data = await sendChunk(chunks[i])
        totals.imported   += data.imported   || 0
        totals.stagePlaced += data.stagePlaced || 0
        totals.stageMoved  += data.stageMoved  || 0
        totals.updated    += data.updated    || 0
        totals.skipped    += data.skipped    || 0
        totals.emailsSent += data.emailsSent || 0
        totals.errors.push(...(data.errors || []))
      }
      setProgress(null)
      setResult(totals)
      if (totals.imported > 0) onImported()
    } catch (e: any) {
      setProgress(null)
      toast({ title: e.message || "Import failed", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lofty-100 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-lofty-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Importar Leads (CSV)</h2>
              <p className="text-xs text-gray-500">Compatible con exportaciones de Casai · Lead Type: Buyer, Seller, Rental</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Importación completa</p>
                <p className="text-sm text-green-700">{result.imported} nuevos · {result.updated ?? 0} actualizados · {result.skipped} omitidos · {result.total} total</p>
                {((result.stagePlaced ?? 0) > 0 || (result.stageMoved ?? 0) > 0) && (
                  <p className="text-sm text-green-700">📊 Pipeline: {result.stagePlaced ?? 0} agregados a su etapa · {result.stageMoved ?? 0} movidos a la etapa correcta</p>
                )}
                {result.emailsSent != null && result.emailsSent > 0 && (
                  <p className="text-sm text-green-700">📧 {result.emailsSent} correos de bienvenida enviados</p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-700 mb-1">Errores ({result.errors.length}):</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <Button onClick={onClose} className="w-full bg-lofty-600 hover:bg-lofty-700">Listo</Button>
          </div>
        ) : progress ? (
          <div className="p-8 text-center space-y-5">
            <Loader2 className="w-10 h-10 text-lofty-600 animate-spin mx-auto" />
            <div>
              <p className="font-semibold text-gray-900 mb-1">Importando contactos...</p>
              <p className="text-sm text-gray-500">
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()} filas · {progress.imported.toLocaleString()} importados
              </p>
              <p className="text-xs text-gray-400 mt-1">No cierres esta pantalla</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-lofty-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Upload zone */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-lofty-400 transition-colors">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 mb-1">Arrastra tu CSV aquí o haz clic para seleccionar</p>
              <p className="text-xs text-gray-400 mb-3">Formatos soportados: exportación Casai · CSV simple</p>
              <label className="cursor-pointer">
                <span className="bg-lofty-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-lofty-700 transition-colors">Seleccionar archivo</span>
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
            </div>

            {/* Supported columns info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1.5">Columnas reconocidas del export de Lofty:</p>
              <div className="flex flex-wrap gap-1">
                {["First Name","Last Name","Email","Phone","Lead Type","Mailing Street Addr.","Mailing City","Mailing State","Mailing Zip Code","Source","Tag","Group1","Group2","Pipeline","Birthday","Max Price","Min Price","Min Bedroom","Property Type","Inquired City","Unsubscribed","Phone DNC status","Number Consent","Buyer Timeframe","Pre-Qualified","Family Member First Name"].map(col => (
                  <span key={col} className="text-[10px] px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-600">{col}</span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            {preview && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Vista previa — primeras {preview.rows.length} filas:</p>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {preview.headers.slice(0, 8).map((h, i) => (
                          <th key={i} className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                        ))}
                        {preview.headers.length > 8 && <th className="px-2 py-1.5 text-gray-400">+{preview.headers.length - 8} más</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-100 last:border-0">
                          {row.slice(0, 8).map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 text-gray-700 max-w-[120px] truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-1">{csv.trim().split(/\r?\n/).length - 1} filas en total (sin encabezado)</p>
              </div>
            )}

            {/* Paste fallback */}
            {!preview && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">O pega el CSV directamente</label>
                <textarea
                  value={csv}
                  onChange={e => handlePaste(e.target.value)}
                  rows={6}
                  placeholder="First Name,Last Name,Email,Phone,Lead Type..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
                />
              </div>
            )}

            {csv && preview && (
              <button onClick={() => { setCsv(""); setPreview(null) }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                × Borrar y elegir otro archivo
              </button>
            )}

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={importing || !csv.trim()} className="flex-1 bg-lofty-600 hover:bg-lofty-700 gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Importar${preview ? ` ${csv.trim().split(/\r?\n/).length - 1} leads` : ""}`}
              </Button>
              <Button onClick={onClose} variant="outline">Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BulkSMSModal({ contactIds, onClose }: { contactIds: string[]; onClose: () => void }) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  async function send() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/bulk/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `Text sent to ${data.sent} contact${data.sent !== 1 ? "s" : ""}` })
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Failed to send", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bulk Text Message</h2>
              <p className="text-xs text-gray-500">{contactIds.length} recipients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Type your message here..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={send} disabled={sending || !message.trim()} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : `Send to ${contactIds.length}`}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function BulkEmailModal({ contactIds, onClose }: { contactIds: string[]; onClose: () => void }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  async function send() {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/bulk/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `Email sent to ${data.sent} contact${data.sent !== 1 ? "s" : ""}` })
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Failed to send", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bulk Email</h2>
              <p className="text-xs text-gray-500">{contactIds.length} recipients · Use {"{first_name}"} for personalization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-lofty-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={7}
              placeholder={"Hi {first_name},\n\nYour message here..."}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()} className="flex-1 bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : `Send to ${contactIds.length}`}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Auto Power Dialer ─────────────────────────────────────────────────────────
const DEFAULT_VM = "Hola, soy Sofía de Catherine Gomez Realtor en Miami. Te llamé porque mostraste interés en propiedades y quería platicar contigo. Por favor llámanos al 305-283-0872 o agenda una consulta gratuita en nuestra página web. ¡Que tengas un excelente día!"

function PowerDialerModal({ contactIds, contacts: contactList, contactCount, onClose }: {
  contactIds: string[]
  contacts: any[]
  contactCount: number
  onClose: () => void
}) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<"config" | "templates" | "running" | "done">("config")
  const [callerType, setCallerType] = useState<"sofia" | "catherine">("sofia")
  const [voicemailMsg, setVoicemailMsg] = useState(DEFAULT_VM)
  const [starting, setStarting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<any>(null)
  // Catherine manual dialer state
  const [manualIndex, setManualIndex] = useState(0)
  const [manualNote, setManualNote] = useState("")
  const [manualLog, setManualLog] = useState<{ name: string; outcome: string }[]>([])
  const [loggingCall, setLoggingCall] = useState(false)
  const manualContacts = contactList.filter(c => c.phone)

  // Twilio browser softphone state
  const [twilioDevice, setTwilioDevice] = useState<any>(null)
  const [activeCall, setActiveCall] = useState<any>(null)
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected">("idle")
  const [callSeconds, setCallSeconds] = useState(0)
  const [deviceReady, setDeviceReady] = useState(false)
  const [browserCallFailed, setBrowserCallFailed] = useState(false)

  // Voicemail template state
  type VmTemplate = { id: string; name: string; text: string; audioUrl?: string }
  const [templates, setTemplates] = useState<VmTemplate[]>([])
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null)
  const [tplForm, setTplForm] = useState<Partial<VmTemplate> | null>(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)
  const [droppingVM, setDroppingVM] = useState(false)
  const [showScript, setShowScript] = useState(false)
  // In-browser recording state
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])

  // Fetch templates on mount
  useEffect(() => {
    fetch("/api/settings/voicemail-templates")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data) })
      .catch(() => {})
  }, [])

  const selectTemplate = (tpl: VmTemplate) => {
    setSelectedTplId(tpl.id)
    setVoicemailMsg(tpl.text)
  }

  const saveTemplate = async () => {
    if (!tplForm?.name?.trim() || !tplForm?.text?.trim()) return
    setSavingTpl(true)
    try {
      const res = await fetch("/api/settings/voicemail-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tplForm),
      })
      const saved = await res.json()
      setTemplates(prev => {
        const idx = prev.findIndex(t => t.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [...prev, saved]
      })
      setTplForm(null)
      toast({ title: "Mensaje guardado" })
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    } finally { setSavingTpl(false) }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar este mensaje?")) return
    await fetch(`/api/settings/voicemail-templates?id=${id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (selectedTplId === id) setSelectedTplId(null)
    toast({ title: "Mensaje eliminado" })
  }

  const uploadAudio = async (file: File) => {
    setUploadingAudio(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.url) setTplForm(prev => prev ? { ...prev, audioUrl: data.url } : prev)
      else toast({ title: "Error al subir audio", variant: "destructive" })
    } catch {
      toast({ title: "Error al subir audio", variant: "destructive" })
    } finally { setUploadingAudio(false) }
  }

  const dropVoicemail = async (phone: string, audioUrl: string) => {
    setDroppingVM(true)
    try {
      const res = await fetch("/api/dialer/voicemail-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, audioUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Mensaje de voz enviado ✓" })
      await logManualCall("voicemail")
    } catch (e: any) {
      toast({ title: e.message || "No se pudo enviar el mensaje", variant: "destructive" })
    } finally { setDroppingVM(false) }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      recordChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" })
        const file = new File([blob], "voicemail.webm", { type: "audio/webm" })
        await uploadAudio(file)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordSecs(0)
    } catch {
      toast({ title: "No se pudo acceder al micrófono", variant: "destructive" })
    }
  }

  // Timer while recording
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setRecordSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  // Initialize Twilio Device when Catherine mode starts
  useEffect(() => {
    if (phase !== "running" || callerType !== "catherine") return
    let device: any = null
    ;(async () => {
      try {
        const tokenRes = await fetch("/api/twilio/token")
        const { token, error } = await tokenRes.json()
        if (error) { setBrowserCallFailed(true); return }
        const { Device } = await import("@twilio/voice-sdk")
        device = new Device(token, { codecPreferences: ["opus", "pcmu"] as any })
        device.on("error", () => { setCallStatus("idle"); setActiveCall(null) })
        setTwilioDevice(device)
        setDeviceReady(true)
      } catch { setBrowserCallFailed(true) }
    })()
    return () => { device?.destroy(); setTwilioDevice(null); setDeviceReady(false) }
  }, [phase, callerType])

  // Timer while on a call
  useEffect(() => {
    if (callStatus !== "connected") { setCallSeconds(0); return }
    const t = setInterval(() => setCallSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [callStatus])

  // Reset call state when advancing to next contact
  useEffect(() => { setCallStatus("idle"); setActiveCall(null) }, [manualIndex])

  const startBrowserCall = async (phone: string) => {
    if (!twilioDevice) return
    setCallStatus("connecting")
    try {
      const digits = phone.replace(/\D/g, "")
      const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
      const call = await twilioDevice.connect({ params: { To: e164 } })
      setActiveCall(call)
      call.on("accept", () => setCallStatus("connected"))
      call.on("disconnect", () => { setCallStatus("idle"); setActiveCall(null) })
      call.on("cancel", () => { setCallStatus("idle"); setActiveCall(null) })
      call.on("error", () => { setCallStatus("idle"); setActiveCall(null) })
    } catch {
      setCallStatus("idle")
      toast({ title: "No se pudo conectar la llamada", variant: "destructive" })
    }
  }

  const hangUp = () => { activeCall?.disconnect(); setCallStatus("idle"); setActiveCall(null) }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  // Poll session status every 3s while running
  useEffect(() => {
    if (phase !== "running" || !sessionId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/power-dial/${sessionId}`)
        const data = await res.json()
        setSessionData(data)
        if (data.status === "COMPLETED" || data.status === "STOPPED") {
          setPhase("done")
          clearInterval(interval)
        }
      } catch { /* retry next tick */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [phase, sessionId])

  const startSession = async () => {
    setStarting(true)
    try {
      const res = await fetch("/api/power-dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, voicemailMsg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSessionId(data.sessionId)
      setSessionData({ currentIndex: 0, totalCount: data.totalCount, callLog: [], status: "ACTIVE" })
      setPhase("running")
      if (data.skipped > 0) toast({ title: `${data.skipped} contactos sin teléfono fueron omitidos` })
    } catch (e: any) {
      toast({ title: e.message || "No se pudo iniciar la sesión", variant: "destructive" })
    } finally { setStarting(false) }
  }

  const stopSession = async () => {
    if (!sessionId) return
    await fetch(`/api/power-dial/${sessionId}`, { method: "DELETE" })
    setPhase("done")
    toast({ title: "Sesión de marcación detenida" })
  }

  const logManualCall = async (outcome: "connected" | "voicemail" | "no_answer" | "skip") => {
    const contact = manualContacts[manualIndex]
    if (!contact) return
    if (outcome !== "skip") {
      setLoggingCall(true)
      try {
        await fetch(`/api/contacts/${contact.id}/log-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outcome,
            note: manualNote.trim() || undefined,
            callerName: "Catherine",
          }),
        })
      } catch { /* non-blocking */ }
      finally { setLoggingCall(false) }
    }
    const newLog = [...manualLog, { name: `${contact.firstName} ${contact.lastName}`, outcome }]
    setManualLog(newLog)
    if (manualIndex + 1 >= manualContacts.length) {
      setSessionData({ callLog: newLog.map(e => ({ ...e, at: new Date().toISOString() })), totalCount: manualContacts.length })
      setPhase("done")
    } else {
      setManualIndex(i => i + 1)
      setManualNote("")
    }
  }

  const outcomeIcon = (outcome: string) => {
    if (outcome === "connected") return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    if (outcome === "voicemail") return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
    return <PhoneOff className="w-3.5 h-3.5 text-gray-400" />
  }
  const outcomeLabel = (outcome: string) => {
    if (outcome === "connected") return "Conectado"
    if (outcome === "voicemail") return "Buzón de voz"
    return "Sin respuesta"
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gray-900 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            {phase === "templates" && (
              <button onClick={() => setPhase("config")} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white mr-1">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
              {phase === "templates" ? <Voicemail className="w-5 h-5 text-white" /> : <PhoneCall className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">
                {phase === "templates" ? "Mensajes pre-grabados" :
                 callerType === "sofia" ? "Auto Dialer — Sofía" : "Manual Dialer — Catherine"}
              </h2>
              <p className="text-gray-400 text-xs">
                {phase === "templates" ? `${templates.length} mensaje${templates.length !== 1 ? "s" : ""} guardado${templates.length !== 1 ? "s" : ""}` :
                 phase === "config" ? `${contactCount} contactos seleccionados` :
                 phase === "running" && callerType === "sofia" ? `Llamada ${(sessionData?.currentIndex ?? 0) + 1} de ${sessionData?.totalCount ?? "…"}` :
                 phase === "running" ? `${manualIndex + 1} de ${manualContacts.length}` :
                 `Sesión completada`}
              </p>
            </div>
          </div>
          {phase !== "running" && (
            <button onClick={phase === "templates" ? () => setPhase("config") : onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {phase === "running" && sessionData && (
          <div className="h-1.5 bg-gray-200 flex-shrink-0">
            <div
              className="h-1.5 bg-green-500 transition-all duration-1000"
              style={{ width: `${Math.round(((sessionData.completedCount ?? 0) / (sessionData.totalCount || 1)) * 100)}%` }}
            />
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {/* Config phase */}
          {phase === "config" && (
            <div className="p-6 space-y-5">
              {/* Caller selector */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">¿Quién hace las llamadas?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCallerType("sofia")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left",
                      callerType === "sofia" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg">🤖</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Sofía (IA)</p>
                      <p className="text-xs text-gray-500 mt-0.5">Auto-llama · Deja buzón · Sola</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallerType("catherine")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left",
                      callerType === "catherine" ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg">👩</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Catherine (Manual)</p>
                      <p className="text-xs text-gray-500 mt-0.5">Click-to-call · Tú controlas</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sofia config */}
              {callerType === "sofia" && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 space-y-1">
                    <p className="font-semibold">Sofía llama automáticamente:</p>
                    <p>• Si contesta → conversación de ventas, agenda cita</p>
                    <p>• Si buzón → deja el mensaje de abajo y pasa al siguiente</p>
                    <p>• Pipeline se actualiza automáticamente tras cada llamada</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Mensaje para buzón de voz</label>
                      <button
                        onClick={() => setPhase("templates")}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Voicemail className="w-3 h-3" /> Administrar mensajes
                      </button>
                    </div>
                    {templates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => selectTemplate(t)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors",
                              selectedTplId === t.id
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-700"
                            )}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={voicemailMsg}
                      onChange={e => { setVoicemailMsg(e.target.value); setSelectedTplId(null) }}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{voicemailMsg.length} caracteres</p>
                  </div>
                  <Button onClick={startSession} disabled={starting} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11">
                    {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                    {starting ? "Iniciando…" : `Iniciar con Sofía (${contactCount} contactos)`}
                  </Button>
                </>
              )}

              {/* Catherine config */}
              {callerType === "catherine" && (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
                    <p className="font-semibold">Catherine llama manualmente:</p>
                    <p>• Se muestra un contacto a la vez con su número</p>
                    <p>• Toca el número para llamar desde tu teléfono</p>
                    <p>• Registra el resultado → pipeline se actualiza solo</p>
                    <p>• Sofía continuará con los follow-ups automáticos</p>
                  </div>
                  {manualContacts.length === 0 ? (
                    <p className="text-sm text-red-500 text-center py-4">Ninguno de los contactos seleccionados tiene número de teléfono.</p>
                  ) : (
                    <Button
                      onClick={() => setPhase("running")}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11"
                    >
                      <PhoneCall className="w-4 h-4" /> Iniciar con Catherine ({manualContacts.length} contactos)
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Template manager phase */}
          {phase === "templates" && (
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Saved templates list */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.text}</p>
                          {t.audioUrl && (
                            <audio src={t.audioUrl} controls className="mt-2 w-full h-8" />
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setTplForm({ id: t.id, name: t.name, text: t.text, audioUrl: t.audioUrl })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {templates.length === 0 && !tplForm && (
                <p className="text-sm text-gray-400 text-center py-4">No hay mensajes guardados aún.</p>
              )}

              {/* Add / Edit form */}
              {tplForm ? (
                <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700">{tplForm.id ? "Editar mensaje" : "Nuevo mensaje"}</p>
                  <input
                    type="text"
                    placeholder="Nombre del mensaje (ej: Buzón estándar)"
                    value={tplForm.name || ""}
                    onChange={e => setTplForm(p => p ? { ...p, name: e.target.value } : p)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                  <textarea
                    placeholder="Escribe el mensaje aquí..."
                    value={tplForm.text || ""}
                    onChange={e => setTplForm(p => p ? { ...p, text: e.target.value } : p)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white"
                  />
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1.5">Grabación de audio (opcional)</p>
                    {tplForm.audioUrl ? (
                      <div className="flex items-center gap-2">
                        <audio src={tplForm.audioUrl} controls className="flex-1 h-8" />
                        <button onClick={() => setTplForm(p => p ? { ...p, audioUrl: undefined } : p)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : uploadingAudio ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Subiendo audio…
                      </div>
                    ) : recording ? (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-red-300 bg-red-50">
                        <div className="flex items-center gap-2 text-xs text-red-700 font-semibold">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          Grabando… {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, "0")}
                        </div>
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <PhoneOff className="w-3 h-3" /> Detener
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={startRecording}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-xs text-red-700 font-semibold transition-colors"
                        >
                          <div className="w-2 h-2 bg-red-500 rounded-full" /> Grabar ahora
                        </button>
                        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-xs text-gray-500 cursor-pointer bg-white transition-colors">
                          <Voicemail className="w-3.5 h-3.5" /> Subir archivo
                          <input type="file" accept="audio/*" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) uploadAudio(e.target.files[0]) }} />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveTemplate} disabled={savingTpl || !tplForm.name?.trim() || !tplForm.text?.trim()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm">
                      {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar mensaje"}
                    </Button>
                    <Button variant="outline" onClick={() => setTplForm(null)} className="h-9 text-sm">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setTplForm({ name: "", text: DEFAULT_VM })}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar nuevo mensaje
                </button>
              )}

              <Button onClick={() => setPhase("config")} variant="outline" className="w-full h-9 text-sm">
                ← Volver al dialer
              </Button>
            </div>
          )}

          {/* Catherine browser softphone running */}
          {phase === "running" && callerType === "catherine" && (() => {
            const contact = manualContacts[manualIndex]
            if (!contact) return null
            return (
              <div className="p-6 space-y-4">
                {/* Contact card */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {contact.firstName?.[0]}{contact.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-semibold mb-0.5">{manualIndex + 1} de {manualContacts.length}</p>
                    <h3 className="font-bold text-gray-900">{contact.firstName} {contact.lastName}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{contact.phone}</p>
                  </div>
                </div>

                {/* Softphone call control */}
                {browserCallFailed ? (
                  /* Fallback: show tel: link when browser calling isn't configured */
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Llamada por navegador no configurada — usa tu teléfono.
                    </p>
                    <a href={`tel:${contact.phone}`}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors">
                      <Phone className="w-5 h-5" /> Llamar {contact.phone}
                    </a>
                  </div>
                ) : callStatus === "idle" ? (
                  <button
                    onClick={() => startBrowserCall(contact.phone)}
                    disabled={!deviceReady}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold transition-colors"
                  >
                    {!deviceReady ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                    {deviceReady ? `Llamar a ${contact.firstName}` : "Iniciando teléfono…"}
                  </button>
                ) : callStatus === "connecting" ? (
                  <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                      <span className="font-semibold text-amber-700 text-sm">Marcando…</span>
                    </div>
                    <button onClick={hangUp} className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* connected */
                  <div className="flex items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="font-semibold text-green-700 text-sm">En llamada — {fmtTime(callSeconds)}</span>
                    </div>
                    <button onClick={hangUp} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      <PhoneOff className="w-4 h-4" /> Colgar
                    </button>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Notas (opcional)</label>
                  <textarea
                    value={manualNote}
                    onChange={e => setManualNote(e.target.value)}
                    rows={2}
                    placeholder="Interesado en Doral, llama de vuelta el martes..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>

                {/* Outcome buttons (always visible so Catherine can log even if call was via phone) */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => logManualCall("connected")} disabled={loggingCall}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 transition-colors disabled:opacity-50">
                    <CheckCircle className="w-5 h-5" /><span className="text-xs font-semibold">Contestó</span>
                  </button>
                  <button onClick={() => logManualCall("voicemail")} disabled={loggingCall}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-colors disabled:opacity-50">
                    <MessageSquare className="w-5 h-5" /><span className="text-xs font-semibold">Buzón de voz</span>
                  </button>
                  <button onClick={() => logManualCall("no_answer")} disabled={loggingCall}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition-colors disabled:opacity-50">
                    <Clock className="w-5 h-5" /><span className="text-xs font-semibold">No contestó</span>
                  </button>
                  <button onClick={() => logManualCall("skip")} disabled={loggingCall}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition-colors">
                    <SkipForward className="w-5 h-5" /><span className="text-xs font-semibold">Omitir</span>
                  </button>
                </div>

                {/* Voicemail drop section */}
                {templates.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowScript(s => !s)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Voicemail className="w-3.5 h-3.5 text-blue-600" />
                        Mensajes pre-grabados
                      </span>
                      {showScript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showScript && (
                      <div className="border-t border-gray-100 p-3 space-y-2">
                        {templates.map(t => {
                          const isSel = selectedTplId === t.id
                          return (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTplId(isSel ? null : t.id)}
                              className={cn(
                                "p-2.5 rounded-lg border cursor-pointer transition-colors",
                                isSel ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.text}</p>
                              {isSel && t.audioUrl && (
                                <audio src={t.audioUrl} controls className="mt-2 w-full h-8" />
                              )}
                              {isSel && t.audioUrl && (
                                <button
                                  onClick={e => { e.stopPropagation(); dropVoicemail(contact.phone, t.audioUrl!) }}
                                  disabled={droppingVM || loggingCall}
                                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                                >
                                  {droppingVM ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Voicemail className="w-3.5 h-3.5" />}
                                  Dejar mensaje grabado
                                </button>
                              )}
                              {isSel && !t.audioUrl && (
                                <p className="mt-1.5 text-xs text-gray-400 italic">Lee este mensaje en el buzón de voz</p>
                              )}
                            </div>
                          )
                        })}
                        <button
                          onClick={() => setPhase("templates")}
                          className="w-full text-xs text-indigo-600 hover:text-indigo-800 py-1.5"
                        >
                          + Administrar mensajes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Queue dots */}
                <div className="flex gap-1.5 justify-center">
                  {manualContacts.map((_, i) => (
                    <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
                      i < manualIndex ? "bg-gray-300" : i === manualIndex ? "bg-indigo-600" : "bg-gray-200")} />
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Sofia running phase */}
          {phase === "running" && callerType === "sofia" && sessionData && (
            <div className="p-6 space-y-5">
              {/* Current call */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Llamando ahora</p>
                  <p className="font-bold text-gray-900">{sessionData.currentContact?.name ?? "—"}</p>
                  <p className="text-sm text-gray-500">{sessionData.currentContact?.phone ?? ""}</p>
                </div>
              </div>

              {/* Call log */}
              {sessionData.callLog?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Historial de llamadas</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {[...sessionData.callLog].reverse().map((entry: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-gray-50 text-sm">
                        {outcomeIcon(entry.outcome)}
                        <span className="flex-1 font-medium text-gray-800 truncate">{entry.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{outcomeLabel(entry.outcome)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={stopSession}
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 gap-2"
              >
                <PhoneOff className="w-4 h-4" /> Detener sesión
              </Button>
            </div>
          )}

          {/* Done phase */}
          {phase === "done" && sessionData && (
            <div className="p-6 space-y-4">
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Sesión completada</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {sessionData.callLog?.length ?? 0} de {sessionData.totalCount} contactos procesados
                </p>
              </div>

              {/* Summary counts */}
              <div className="grid grid-cols-3 gap-3">
                {["connected", "voicemail", "no_answer"].map(type => {
                  const count = (sessionData.callLog || []).filter((e: any) => e.outcome === type).length
                  return (
                    <div key={type} className="text-center bg-gray-50 rounded-xl p-3">
                      <p className="text-xl font-bold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500">{outcomeLabel(type)}</p>
                    </div>
                  )
                })}
              </div>

              <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700">Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function relativeTime(date: string | null) {
  if (!date) return "—"
  const ms = Date.now() - new Date(date).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

export default function ContactsClient({ contacts, total, page, pageSize, tags, smartPlans = [], filters, activeTab, stageCounts, stages: initialStages, pipelineId }: ContactsClientProps & { smartPlans?: { id: string; name: string }[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState(filters.search || "")
  const getInitialCategory = () => {
    if (filters.source) return "source"
    if (filters.status) return "status"
    if (filters.tags) return "tag"
    return ""
  }
  const [filterCategory, setFilterCategory] = useState<string>(getInitialCategory)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkSMS, setShowBulkSMS] = useState(false)
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showPipelineSettings, setShowPipelineSettings] = useState(false)
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [updatingStage, setUpdatingStage] = useState<string | null>(null)
  const [deletingContact, setDeletingContact] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkMoving, setBulkMoving] = useState(false)
  const [bulkTagging, setBulkTagging] = useState(false)
  const [bulkEnrolling, setBulkEnrolling] = useState(false)
  const [globalSelectAll, setGlobalSelectAll] = useState(false)
  const [showPowerDialer, setShowPowerDialer] = useState(false)

  const totalPages = Math.ceil(total / pageSize)
  const allSelected = contacts.length > 0 && contacts.every(c => selected.has(c.id))
  const someSelected = selected.size > 0

  const goTab = (tabId: string) => {
    const params = new URLSearchParams()
    if (tabId !== "all") params.set("tab", tabId)
    if (filters.search) params.set("search", filters.search)
    if (filters.tags) params.set("tags", filters.tags)
    router.push(`/contacts?${params.toString()}`)
  }

  const assignStage = async (contactId: string, stageId: string) => {
    setUpdatingStage(contactId)
    try {
      const res = await fetch("/api/pipeline/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, stageId, pipelineId }),
      })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      toast({ title: "Failed to update stage", variant: "destructive" })
    } finally {
      setUpdatingStage(null)
    }
  }

  const deleteContact = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    setDeletingContact(id)
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      toast({ title: "Contact deleted" })
      router.refresh()
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    } finally {
      setDeletingContact(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()); setGlobalSelectAll(false) }
    else setSelected(new Set(contacts.map(c => c.id)))
  }

  const bulkDeleteContacts = async () => {
    if (!selected.size) return
    if (!confirm(`Permanently delete ${selected.size} contact${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) throw new Error()
      toast({ title: `${selected.size} contacts deleted` })
      setSelected(new Set())
      router.refresh()
    } catch {
      toast({ title: "Failed to delete contacts", variant: "destructive" })
    } finally { setBulkDeleting(false) }
  }

  const bulkMoveToStage = async (stageId: string, stageName: string) => {
    if (!selected.size) return
    setBulkMoving(true)
    try {
      const res = await fetch("/api/pipeline/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selected), stageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `${data.added} contact${data.added !== 1 ? "s" : ""} moved to ${stageName}` })
      setSelected(new Set())
      router.refresh()
    } catch {
      toast({ title: "Failed to move contacts", variant: "destructive" })
    } finally { setBulkMoving(false) }
  }

  const bulkEnrollPlan = async (planId: string, planName: string) => {
    if (!selected.size && !globalSelectAll) return
    setBulkEnrolling(true)
    try {
      let contactIds = Array.from(selected)

      // In global-select mode, fetch all matching IDs from the server first
      if (globalSelectAll) {
        const params = buildParams()
        const idsRes = await fetch(`/api/contacts/ids?${params}`)
        const idsData = await idsRes.json()
        if (!idsRes.ok) throw new Error(idsData.error)
        contactIds = idsData.ids
      }

      const res = await fetch("/api/smart-plans/bulk-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, contactIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `${data.enrolled} contact${data.enrolled !== 1 ? "s" : ""} enrolled in "${planName}"` })
      setSelected(new Set())
      setGlobalSelectAll(false)
      router.refresh()
    } catch {
      toast({ title: "Failed to enroll contacts", variant: "destructive" })
    } finally { setBulkEnrolling(false) }
  }

  const bulkApplyTag = async (tagId: string, tagName: string) => {
    if (!selected.size) return
    setBulkTagging(true)
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), tagId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `Tag "${tagName}" applied to ${data.tagged} contact${data.tagged !== 1 ? "s" : ""}` })
      router.refresh()
    } catch {
      toast({ title: "Failed to apply tag", variant: "destructive" })
    } finally { setBulkTagging(false) }
  }

  const activeTagIds = filters.tags ? filters.tags.split(",").filter(Boolean) : []

  const buildParams = (overrides: Record<string, string | undefined> = {}) => {
    const base: Record<string, string | undefined> = {
      search: filters.search,
      status: filters.status,
      source: filters.source,
      tags: filters.tags,
      smartPlanId: filters.smartPlanId,
      smartPlanEnrolled: filters.smartPlanEnrolled,
      tab: activeTab !== "all" ? activeTab : undefined,
    }
    const merged = { ...base, ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "ALL") params.set(k, v)
    }
    params.delete("page")
    return params
  }

  const updateFilter = (key: string, value: string) => {
    const params = buildParams({ [key]: value !== "ALL" ? value : undefined })
    router.push(`/contacts?${params.toString()}`)
  }

  const toggleTagFilter = (tagId: string) => {
    const next = activeTagIds.includes(tagId)
      ? activeTagIds.filter(id => id !== tagId)
      : [...activeTagIds, tagId]
    const params = buildParams({ tags: next.length > 0 ? next.join(",") : undefined })
    router.push(`/contacts?${params.toString()}`)
  }

  const clearTagFilter = () => {
    const params = buildParams({ tags: undefined })
    router.push(`/contacts?${params.toString()}`)
  }

  const clearAllFilters = () => {
    setFilterCategory("")
    const params = buildParams({ source: undefined, status: undefined, tags: undefined, smartPlanId: undefined, smartPlanEnrolled: undefined })
    router.push(`/contacts?${params.toString()}`)
  }

  const hasActiveFilter = !!(filters.source || filters.status || filters.tags || filters.smartPlanId)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = buildParams({ search: search || undefined })
    router.push(`/contacts?${params.toString()}`)
  }

  // Pagination that keeps the current stage tab, search, and filters
  const gotoPage = (p: number) => {
    const params = buildParams()
    if (p > 1) params.set("page", String(p))
    router.push(`/contacts?${params.toString()}`)
  }

  // Live search: apply automatically 500ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search || "") !== (filters.search || "")) {
        const params = buildParams({ search: search || undefined })
        router.push(`/contacts?${params.toString()}`)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [search])

  const selectedIds = Array.from(selected)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in">
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => router.refresh()} />}
      {showBulkSMS && <BulkSMSModal contactIds={selectedIds} onClose={() => setShowBulkSMS(false)} />}
      {showBulkEmail && <BulkEmailModal contactIds={selectedIds} onClose={() => setShowBulkEmail(false)} />}
      {showPowerDialer && (
        <PowerDialerModal
          contactIds={Array.from(selected)}
          contacts={contacts.filter(c => selected.has(c.id))}
          contactCount={selected.size}
          onClose={() => { setShowPowerDialer(false); setSelected(new Set()); router.refresh() }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} total contacts</p>
        </div>
        <div className="flex gap-2 items-center">
          <HelpPanel section="contacts" />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Link href="/contacts/new">
              <Plus className="w-4 h-4" /> Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Pipeline filter tabs — dynamic from DB */}
      <div className="border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
        <div className="flex gap-0 items-end min-w-max">
          {/* All Leads tab */}
          <button onClick={() => goTab("all")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              activeTab === "all" ? "border-lofty-600 text-lofty-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            All Leads
            <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
              activeTab === "all" ? "bg-lofty-100 text-lofty-700" : "bg-gray-100 text-gray-500")}>
              {total.toLocaleString()}
            </span>
          </button>

          {/* Per-stage tabs */}
          {stages.map(stage => {
            const count = stageCounts[stage.id] ?? 0
            return (
              <button key={stage.id} onClick={() => goTab(stage.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  activeTab === stage.id ? "border-lofty-600 text-lofty-600" : "border-transparent text-gray-500 hover:text-gray-700"
                )}>
                {stage.name}
                {count > 0 && (
                  <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                    activeTab === stage.id ? "bg-lofty-100 text-lofty-700" : "bg-gray-100 text-gray-500")}>
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            )
          })}

          {/* Pipeline settings gear */}
          <button
            onClick={() => setShowPipelineSettings(true)}
            className="ml-2 mb-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Pipeline Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPipelineSettings && (
        <PipelineSettingsModal
          stages={stages}
          pipelineId={pipelineId}
          onClose={() => setShowPipelineSettings(false)}
          onSaved={updated => { setStages(updated); router.refresh() }}
        />
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="bg-gray-900 text-white rounded-xl px-5 py-3 flex flex-wrap items-center gap-3 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckSquare className="w-4 h-4" />
            <span className="font-semibold text-sm">
              {globalSelectAll ? `All ${total.toLocaleString()} contacts selected` : `${selected.size} selected`}
            </span>
            {allSelected && !globalSelectAll && total > contacts.length && (
              <button
                onClick={() => setGlobalSelectAll(true)}
                className="text-xs underline text-blue-300 hover:text-blue-100"
              >
                Select all {total.toLocaleString()} contacts
              </button>
            )}
            {globalSelectAll && (
              <button
                onClick={() => setGlobalSelectAll(false)}
                className="text-xs underline text-blue-300 hover:text-blue-100"
              >
                Clear global selection
              </button>
            )}
          </div>
          <div className="w-px h-5 bg-white/20 hidden sm:block" />
          <div className="flex flex-wrap gap-2 ml-auto">
            {/* Move to stage */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5" disabled={bulkMoving}>
                  {bulkMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoveRight className="w-3.5 h-3.5" />}
                  Move to Stage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {stages.map(s => (
                  <DropdownMenuItem key={s.id} onClick={() => bulkMoveToStage(s.id, s.name)} className="gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </DropdownMenuItem>
                ))}
                {stages.length === 0 && (
                  <DropdownMenuItem disabled className="text-gray-400 text-xs">No stages configured</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Tag contacts */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5" disabled={bulkTagging}>
                  {bulkTagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                  Tag
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
                {tags.length > 0 ? tags.map((t: any) => (
                  <DropdownMenuItem key={t.id} onClick={() => bulkApplyTag(t.id, t.name)} className="gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#6366F1" }} />
                    {t.name}
                  </DropdownMenuItem>
                )) : (
                  <DropdownMenuItem disabled className="text-gray-400 text-xs">No tags created yet</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Enroll in Smart Plan */}
            {smartPlans.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5" disabled={bulkEnrolling}>
                    {bulkEnrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Enroll in Plan
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
                  {smartPlans.map((plan) => (
                    <DropdownMenuItem key={plan.id} onClick={() => bulkEnrollPlan(plan.id, plan.name)} className="gap-2">
                      <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                      <span className="text-sm truncate">{plan.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              size="sm"
              onClick={() => setShowPowerDialer(true)}
              className="bg-green-500 hover:bg-green-600 text-white gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Power Dial
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBulkSMS(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Bulk Text
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBulkEmail(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" /> Bulk Email
            </Button>
            <Button
              size="sm"
              onClick={bulkDeleteContacts}
              disabled={bulkDeleting}
              className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
            >
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSelected(new Set()); setGlobalSelectAll(false) }}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-0 sm:min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </form>

        {/* Two-step filter: category → value */}
        <div className="flex gap-2 items-center">
          {/* Step 1: what to filter by */}
          <Select
            value={filterCategory || "none"}
            onValueChange={(v) => {
              if (v === "none") { clearAllFilters(); return }
              if (v !== filterCategory) {
                // Clear existing filter value when switching category
                const params = buildParams({ source: undefined, status: undefined, tags: undefined })
                router.push(`/contacts?${params.toString()}`)
              }
              setFilterCategory(v)
            }}
          >
            <SelectTrigger className={cn("w-36 h-9", hasActiveFilter && "border-lofty-500 text-lofty-700 bg-lofty-50")}>
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All leads</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="tag">Tag</SelectItem>
            </SelectContent>
          </Select>

          {/* Step 2: the specific value */}
          {filterCategory === "source" && (
            <Select value={filters.source || "ALL"} onValueChange={(v) => updateFilter("source", v)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterCategory === "status" && (
            <Select value={filters.status || "ALL"} onValueChange={(v) => updateFilter("status", v)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterCategory === "tag" && (
            <Select
              value={activeTagIds[0] || "ALL"}
              onValueChange={(v) => {
                if (v === "ALL") clearTagFilter()
                else router.push(`/contacts?${buildParams({ tags: v })}`)
              }}
            >
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Select tag..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL">All Tags</SelectItem>
                {tags.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#6366F1" }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear button */}
          {hasActiveFilter && (
            <button
              onClick={clearAllFilters}
              className="h-9 px-2 text-gray-400 hover:text-gray-700 transition-colors"
              title="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active filter pill */}
      {hasActiveFilter && (
        <div className="flex flex-wrap gap-2 -mt-1">
          {filters.source && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-lofty-100 text-lofty-700">
              Source: {filters.source.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
              <button onClick={clearAllFilters} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-lofty-100 text-lofty-700">
              Status: {STATUSES.find(s => s.value === filters.status)?.label || filters.status}
              <button onClick={clearAllFilters} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {activeTagIds.map(tagId => {
            const tag = tags.find((t: any) => t.id === tagId)
            if (!tag) return null
            return (
              <span key={tagId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: (tag.color || "#6366F1") + "20", color: tag.color || "#6366F1" }}>
                Tag: {tag.name}
                <button onClick={clearAllFilters} className="hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            )
          })}
        </div>
      )}

      {/* Contact list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

        {contacts.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No contacts found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new contact</p>
            <Button asChild className="mt-4 bg-lofty-600 hover:bg-lofty-700">
              <Link href="/contacts/new"><Plus className="w-4 h-4 mr-2" />Add Contact</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* ── Mobile card view ──────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-gray-100">
              {contacts.map((contact) => {
                const pipelineStage = contact.pipelineLeads?.[0]?.stage
                const lastTouch = contact.lastContacted || contact.updatedAt
                const isBuyer = contact.buyerBudgetMax != null || contact.buyerLocation != null
                const isSeller = contact.sellerAddress != null || contact.sellerEstimatedValue != null
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                      selected.has(contact.id) && "bg-lofty-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="w-4 h-4 rounded border-gray-300 text-lofty-600 focus:ring-lofty-500 cursor-pointer flex-shrink-0"
                    />
                    <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarFallback className="bg-lofty-100 text-lofty-700 text-sm font-semibold">
                          {getInitials(`${contact.firstName} ${contact.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate text-sm">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {pipelineStage && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pipelineStage.color }} />
                              {pipelineStage.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{relativeTime(lastTouch)}</span>
                          {isBuyer && <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 font-medium">Buyer</span>}
                          {isSeller && <span className="text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-700 font-medium">Seller</span>}
                          {contact.leadReferrals?.[0]?.partner && !["RETURNED"].includes(contact.leadReferrals[0].status) && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0 rounded-full font-medium",
                              ["CLOSED", "LOST"].includes(contact.leadReferrals[0].status)
                                ? "bg-gray-100 text-gray-500"
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              🤝 {contact.leadReferrals[0].partner.name}
                            </span>
                          )}
                        </div>
                        {contact.phone && (
                          <a
                            href={`/dialer?contactId=${contact.id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-green-600 mt-0.5 block"
                          >
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2">
                            <Eye className="w-4 h-4" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/${contact.id}/edit`} className="flex items-center gap-2">
                            <Edit className="w-4 h-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 flex items-center gap-2"
                          onClick={() => deleteContact(contact.id, `${contact.firstName} ${contact.lastName || ""}`.trim())}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table view ────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[40px_2.5fr_1.5fr_1fr_1fr_1.2fr_1fr_80px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[900px]">
                <div className="flex items-center justify-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-lofty-600 focus:ring-lofty-500 cursor-pointer" />
                </div>
                <div>Name</div>
                <div>Pipeline</div>
                <div>Last Touch</div>
                <div>Communications</div>
                <div>Smart Plan</div>
                <div>Tags</div>
                <div></div>
              </div>
              <div className="divide-y divide-gray-100">
                {contacts.map((contact) => {
                  const isBuyer = contact.buyerBudgetMax != null || contact.buyerLocation != null
                  const isSeller = contact.sellerAddress != null || contact.sellerEstimatedValue != null
                  const pipelineStage = contact.pipelineLeads?.[0]?.stage
                  const enrollment = contact.enrollments?.[0]
                  const lastTouch = contact.lastContacted || contact.updatedAt

                  return (
                    <div
                      key={contact.id}
                      className={cn(
                        "grid grid-cols-[40px_2.5fr_1.5fr_1fr_1fr_1.2fr_1fr_80px] gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors items-center min-w-[900px]",
                        selected.has(contact.id) && "bg-lofty-50 hover:bg-lofty-50"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selected.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                          className="w-4 h-4 rounded border-gray-300 text-lofty-600 focus:ring-lofty-500 cursor-pointer"
                        />
                      </div>

                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xs font-semibold">
                            {getInitials(`${contact.firstName} ${contact.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/contacts/${contact.id}`}
                            className="font-medium text-gray-900 hover:text-lofty-600 transition-colors truncate block text-sm"
                          >
                            {contact.firstName} {contact.lastName}
                          </Link>
                          <div className="flex gap-1 mt-0.5">
                            {isBuyer && <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 font-medium">Buyer</span>}
                            {isSeller && <span className="text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-700 font-medium">Seller</span>}
                            {!isBuyer && !isSeller && <span className="text-[10px] px-1.5 py-0 rounded-full bg-gray-100 text-gray-500 font-medium">{contact.status?.replace(/_/g, " ")}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Pipeline */}
                      <div className="min-w-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn(
                              "flex items-center gap-1.5 text-sm hover:bg-gray-100 rounded-lg px-1.5 py-1 transition-colors w-full text-left",
                              updatingStage === contact.id && "opacity-50"
                            )}>
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pipelineStage?.color || "#94a3b8" }} />
                              <span className="truncate">{pipelineStage?.name || "Set stage"}</span>
                              <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            {stages.map(s => (
                              <DropdownMenuItem key={s.id} onClick={() => assignStage(contact.id, s.id)} className={cn("flex items-center gap-2", pipelineStage?.id === s.id && "bg-lofty-50")}>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </DropdownMenuItem>
                            ))}
                            {stages.length === 0 && <DropdownMenuItem disabled className="text-gray-400 text-xs">No stages — open Pipeline Settings</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Last Touch */}
                      <div><span className="text-sm text-gray-600">{relativeTime(lastTouch)}</span></div>

                      {/* Communications */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{contact._count?.dialerCalls ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{contact._count?.emails ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                          <span>{contact._count?.notes ?? 0}</span>
                        </div>
                      </div>

                      {/* Smart Plan */}
                      <div className="min-w-0">
                        {enrollment ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700 truncate">{enrollment.plan?.name}</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-700 font-medium">Running</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">None</span>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {contact.tags.slice(0, 2).map((ct: any) => (
                          <span key={ct.tagId} className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full font-medium"
                            style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                            {ct.tag.name}
                          </span>
                        ))}
                        {contact.tags.length > 2 && <span className="text-[10px] text-gray-400">+{contact.tags.length - 2}</span>}
                        {contact.tags.length === 0 && <span className="text-xs text-gray-300">—</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2"><Eye className="w-4 h-4" /> View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/contacts/${contact.id}/edit`} className="flex items-center gap-2"><Edit className="w-4 h-4" /> Edit</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 flex items-center gap-2"
                              disabled={deletingContact === contact.id}
                              onClick={() => deleteContact(contact.id, `${contact.firstName} ${contact.lastName || ""}`.trim())}
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => gotoPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {(() => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                const end = Math.min(totalPages, start + 4)
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
              })().map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => gotoPage(p)}
                  className={p === page ? "bg-lofty-600 hover:bg-lofty-700" : ""}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => gotoPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
