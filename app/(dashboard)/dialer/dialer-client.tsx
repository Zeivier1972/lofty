"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Phone, PhoneOff, PhoneMissed, PhoneCall, PhoneIncoming,
  Play, Pause, SkipForward, Plus, Trash2, Clock,
  CheckCircle2, XCircle, MessageSquare, Voicemail,
  BarChart3, Users, Target, TrendingUp,
  ChevronDown, ChevronUp, Search, User, Zap, ExternalLink, Mail, Loader2, RotateCcw,
} from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"
import HelpPanel from "@/components/help-panel"

interface Contact {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  phone2: string | null
  email?: string | null
  status: string
  leadScore: number
  buyerPropertyType?: string | null
  buyerLocation?: string | null
  buyerBedroomsMin?: number | null
  buyerBathroomsMin?: number | null
  buyerBudgetMin?: number | null
  buyerBudgetMax?: number | null
  buyerTimelineMonths?: number | null
  buyerPurpose?: string | null
  leadReferrals?: { status: string; partner: { name: string } | null }[]
}

interface DialerCall {
  id: string
  contactId: string | null
  phoneNumber: string
  status: string
  disposition: string | null
  duration: number | null
  notes: string | null
  createdAt: string
  contact?: { id: string; firstName: string; lastName: string } | null
}

interface DialerSession {
  id: string
  name: string
  totalCalls: number
  answered: number
  voicemails: number
  noAnswers: number
  createdAt: string
  calls: DialerCall[]
}

interface PipelineStage {
  id: string
  name: string
  contacts: Contact[]
}

interface Props {
  contacts: Contact[]
  sessions: DialerSession[]
  pipelineStages: PipelineStage[]
  initialContact?: Contact | null
  initialQueue?: Contact[]
}

// Property types: display label ↔ CRM enum. buyerPropertyType stores one or
// MORE comma-separated enums (e.g. "SINGLE_FAMILY,TOWNHOUSE").
const TYPE_ENUM_TO_LABEL: Record<string, string> = {
  SINGLE_FAMILY: "Casa", CONDO: "Condo", TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi-Family", LAND: "Terreno",
}
const TYPE_LABEL_TO_ENUM: Record<string, string> = {
  "Casa": "SINGLE_FAMILY", "Condo": "CONDO", "Townhouse": "TOWNHOUSE",
  "Multi-Family": "MULTI_FAMILY", "Terreno": "LAND",
}
const TYPE_LABELS = Object.keys(TYPE_LABEL_TO_ENUM)

function mapPropertyTypes(type?: string | null): string[] {
  return (type || "")
    .split(",")
    .map(t => TYPE_ENUM_TO_LABEL[t.trim()])
    .filter(Boolean)
}

function mapTimeline(months?: number | null): string {
  if (!months) return ""
  if (months <= 1) return "Lo antes posible"
  if (months <= 3) return "1-3 meses"
  if (months <= 6) return "3-6 meses"
  if (months <= 12) return "6-12 meses"
  return "1+ año"
}

const TIMELINE_TO_MONTHS: Record<string, number> = {
  "Lo antes posible": 1, "1-3 meses": 3, "3-6 meses": 6, "6-12 meses": 12, "1+ año": 24,
}

// Active referral → the lead is being serviced by a partner realtor
const REFERRAL_ACTIVE = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"]
function assignedPartner(c: Contact): string | null {
  const r = c.leadReferrals?.[0]
  if (r && REFERRAL_ACTIVE.includes(r.status) && r.partner?.name) return r.partner.name
  return null
}

const DISPOSITIONS = [
  { value: "REACHED", label: "Reached", icon: CheckCircle2, color: "text-green-600" },
  { value: "VOICEMAIL", label: "Voicemail", icon: Voicemail, color: "text-amber-600" },
  { value: "NO_ANSWER", label: "No Answer", icon: PhoneMissed, color: "text-red-500" },
  { value: "BUSY", label: "Busy", icon: PhoneOff, color: "text-orange-500" },
  { value: "NOT_INTERESTED", label: "Not Interested", icon: XCircle, color: "text-gray-500" },
  { value: "CALLBACK", label: "Callback Requested", icon: PhoneIncoming, color: "text-blue-500" },
  { value: "APPOINTMENT", label: "Appointment Set", icon: CheckCircle2, color: "text-emerald-600" },
]

export default function DialerClient({ contacts, sessions: initialSessions, pipelineStages, initialContact, initialQueue }: Props) {
  const [sessions, setSessions] = useState<DialerSession[]>(initialSessions)
  const [activeSession, setActiveSession] = useState<DialerSession | null>(initialSessions[0] || null)
  // Seed from a passed-in list (e.g. hot buyers via ?queue=), else a single deep-linked contact.
  const [queue, setQueue] = useState<Contact[]>(
    initialQueue?.length ? initialQueue : (initialContact?.phone ? [initialContact] : [])
  )
  const [emailingLead, setEmailingLead] = useState(false)
  const [emailedNote, setEmailedNote] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentCallIndex, setCurrentCallIndex] = useState(0)
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle")
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [activeTwilioSid, setActiveTwilioSid] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Browser softphone (Twilio Voice SDK) — audio runs through the browser mic/speakers
  const deviceRef = useRef<any>(null)
  const activeBrowserCallRef = useRef<any>(null)
  // Fail-safe: if a call never connects (no answer / TwiML error), un-stick the UI.
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [disposition, setDisposition] = useState("")
  const [noteFields, setNoteFields] = useState({
    propertyTypes: [] as string[],
    area: "",
    beds: "",
    baths: "",
    budgetMin: "",
    budgetMax: "",
    timeline: "",
    purpose: "",
    actions: [] as string[],
    extraNotes: "",
  })
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  // Refs so late-typed notes survive: what was typed, for which call/contact —
  // flushed to the DB before the queue advances or when Save is tapped.
  const noteFieldsRef = useRef(noteFields)
  const lastCallIdRef = useRef<string | null>(null)
  const lastContactIdRef = useRef<string | null>(null)
  const savedNoteRef = useRef("")
  const [sessionRunning, setSessionRunning] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [skipNotice, setSkipNotice] = useState<string | null>(null)
  // Full transparency + control over skips (so the dialer never silently drops
  // a lead it shouldn't): a running log of what was skipped and why, plus a
  // master toggle for the partner-skip rule.
  const [skippedLeads, setSkippedLeads] = useState<{ id: string; name: string; reason: string }[]>([])
  const [skipPartners, setSkipPartners] = useState(true)
  const [addingToQueue, setAddingToQueue] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string>("all")
  // Auto-dial countdown
  const [countdown, setCountdown] = useState<number | null>(null)
  const [autoDialContact, setAutoDialContact] = useState<Contact | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const AUTO_DIAL_DELAY = 20
  // Guards the call lifecycle: exactly ONE "finish & advance" per placed call,
  // no matter what ends it (agent hangs up, callee hangs up, error, or the
  // no-answer timeout). Prevents both freezing (never advancing) AND
  // double-advancing (which would skip the next lead).
  const callFinishedRef = useRef(false)
  // Live mirror of sessionRunning so event handlers/timeouts read the real value.
  const sessionRunningRef = useRef(false)
  useEffect(() => { sessionRunningRef.current = sessionRunning }, [sessionRunning])
  // Did the current call actually connect (answered / voicemail)? If so we DON'T
  // auto-advance out from under the agent — they may be leaving a message or
  // taking notes. Only never-answered calls auto-dial the next lead.
  const wasConnectedRef = useRef(false)

  // Pre-recorded voicemail messages (text or audio), shared with the Contacts page
  type VmTemplate = { id: string; name: string; text?: string; audioUrl?: string }
  const [vmTemplates, setVmTemplates] = useState<VmTemplate[]>([])
  const [droppingVm, setDroppingVm] = useState(false)
  const [showVmMenu, setShowVmMenu] = useState(false)
  useEffect(() => {
    fetch("/api/settings/voicemail-templates")
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) && setVmTemplates(d))
      .catch(() => {})
  }, [])

  // Drop a pre-recorded message (audio plays after the beep, or a text is sent),
  // then hang up and move to the next call.
  async function dropVoicemailAndNext(tpl: VmTemplate) {
    const c = queue[currentCallIndex]
    setShowVmMenu(false)
    clearCountdown() // don't let the auto-dial timer yank the lead away mid-drop
    if (!c?.phone) { setSkipNotice("Este lead no tiene teléfono para dejar mensaje."); return }
    setDroppingVm(true)
    try {
      const res = await fetch("/api/dialer/voicemail-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: c.phone, contactId: c.id, audioUrl: tpl.audioUrl, text: tpl.text }),
      })
      const d = await res.json().catch(() => ({}))
      setSkipNotice(d.ok ? `📨 Mensaje "${tpl.name}" enviado a ${c.firstName} — pasando a la siguiente` : (d.error || "No se pudo enviar el mensaje"))
    } catch {
      setSkipNotice("Error al enviar el mensaje")
    } finally {
      setDroppingVm(false)
    }
    // Hang up the live call and always advance to the next call (logged as Voicemail).
    endCall("COMPLETED", "VOICEMAIL", true)
  }

  // Lead notes + activity history for the current call (so the agent sees the
  // prior conversation and who the lead belongs to before dialing).
  const [leadHistory, setLeadHistory] = useState<{ notes: any[]; activities: any[]; referrals: any[] } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const currentContactId = queue[currentCallIndex]?.id
  async function refreshLeadHistory(id: string) {
    try {
      const d = await fetch(`/api/contacts/${id}/history`).then(r => r.ok ? r.json() : null)
      if (d) setLeadHistory(d)
    } catch { /* noop */ }
  }
  useEffect(() => {
    savedNoteRef.current = "" // reset per-lead so a new note always saves
    if (!currentContactId) { setLeadHistory(null); return }
    let cancelled = false
    setLoadingHistory(true)
    fetch(`/api/contacts/${currentContactId}/history`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setLeadHistory(d) })
      .catch(() => { if (!cancelled) setLeadHistory(null) })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [currentContactId])

  // Trigger dial when autoDialContact is set (runs with fresh state)
  useEffect(() => {
    if (!autoDialContact) return
    const contact = autoDialContact
    setAutoDialContact(null)
    dialContact(contact)
  }, [autoDialContact])

  // Register the browser softphone once on mount
  useEffect(() => {
    let device: any = null
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/twilio/token")
        const { token, error } = await res.json()
        if (error || !token) {
          if (!cancelled) setDeviceError(error || "Browser calling not configured")
          return
        }
        const { Device } = await import("@twilio/voice-sdk")
        device = new Device(token, { codecPreferences: ["opus", "pcmu"] as any })
        device.on("error", (e: any) => {
          console.error("[dialer] device error:", e)
        })
        device.on("tokenWillExpire", async () => {
          try {
            const r = await fetch("/api/twilio/token")
            const d = await r.json()
            if (d.token) device.updateToken(d.token)
          } catch {}
        })
        if (!cancelled) {
          deviceRef.current = device
          setDeviceReady(true)
          setDeviceError(null)
        }
      } catch (e) {
        if (!cancelled) setDeviceError("Browser calling not available in this browser")
      }
    })()
    return () => {
      cancelled = true
      activeBrowserCallRef.current?.disconnect()
      device?.destroy()
      deviceRef.current = null
      setDeviceReady(false)
    }
  }, [])

  // Pre-fill notes from stored buyer preferences when the active contact changes
  useEffect(() => {
    const contact = queue[currentCallIndex]
    if (!contact) return
    lastContactIdRef.current = contact.id
    setNoteFields({
      propertyTypes: mapPropertyTypes(contact.buyerPropertyType),
      area: contact.buyerLocation || "",
      beds: contact.buyerBedroomsMin ? `${contact.buyerBedroomsMin}+` : "",
      baths: contact.buyerBathroomsMin ? `${contact.buyerBathroomsMin}+` : "",
      budgetMin: contact.buyerBudgetMin != null ? String(contact.buyerBudgetMin) : "",
      budgetMax: contact.buyerBudgetMax != null ? String(contact.buyerBudgetMax) : "",
      timeline: mapTimeline(contact.buyerTimelineMonths),
      purpose: contact.buyerPurpose || "",
      actions: [],
      extraNotes: "",
    })
  }, [currentCallIndex, queue])

  // Keep a live mirror for the flush-on-advance logic
  useEffect(() => { noteFieldsRef.current = noteFields }, [noteFields])

  // Persist what's on screen: notes → the call record, buyer criteria → the
  // CONTACT (two-way sync with the contact page). Safe to call repeatedly.
  async function saveLeadData(showFeedback = false) {
    const fields = noteFieldsRef.current
    const contactId = lastContactIdRef.current
    const callId = activeCallId || lastCallIdRef.current

    // 1. Notes onto the dialer call (even after hang-up)
    if (callId) {
      fetch("/api/dialer/call", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, notes: buildNotesString(fields) || undefined }),
      }).catch(() => {})
    }

    // 2. Buyer criteria onto the contact — same fields the contact page uses
    if (contactId) {
      const hasPrefs = fields.propertyTypes.length > 0 || fields.area || fields.beds || fields.budgetMax || fields.budgetMin
      const body: Record<string, any> = {
        buyerPropertyType: fields.propertyTypes.map(l => TYPE_LABEL_TO_ENUM[l]).filter(Boolean).join(",") || null,
        buyerLocation: fields.area.trim() || null,
        buyerBedroomsMin: parseInt(fields.beds) || null,
        buyerBathroomsMin: parseInt(fields.baths) || null,
        buyerBudgetMin: fields.budgetMin ? Number(fields.budgetMin) : null,
        buyerBudgetMax: fields.budgetMax ? Number(fields.budgetMax) : null,
        buyerTimelineMonths: TIMELINE_TO_MONTHS[fields.timeline] || null,
        buyerPurpose: fields.purpose || null,
        ...(hasPrefs ? { matchPrefsCompletedAt: new Date().toISOString() } : {}),
      }
      try {
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error()
        // Mirror into the local queue so re-prefill shows what was saved
        setQueue(prev => prev.map(c => c.id === contactId ? {
          ...c,
          buyerPropertyType: body.buyerPropertyType,
          buyerLocation: body.buyerLocation,
          buyerBedroomsMin: body.buyerBedroomsMin,
          buyerBathroomsMin: body.buyerBathroomsMin,
          buyerBudgetMin: body.buyerBudgetMin,
          buyerBudgetMax: body.buyerBudgetMax,
          buyerTimelineMonths: body.buyerTimelineMonths,
          buyerPurpose: body.buyerPurpose,
        } : c))
        if (showFeedback) {
          setSavedMsg("✅ Notas y preferencias guardadas en el contacto")
          setTimeout(() => setSavedMsg(null), 3000)
        }
      } catch {
        if (showFeedback) {
          setSavedMsg("⚠️ No se pudo guardar — intenta de nuevo")
          setTimeout(() => setSavedMsg(null), 4000)
        }
      }
    }

    // 3. Free-text note → a REAL note on the contact, so you SEE it appear in
    //    the history panel below (visible confirmation) and on the contact page.
    const noteText = fields.extraNotes.trim()
    if (contactId && noteText && noteText !== savedNoteRef.current) {
      try {
        const r = await fetch(`/api/contacts/${contactId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `📞 Nota de llamada: ${noteText}` }),
        })
        if (r.ok) {
          savedNoteRef.current = noteText
          setNoteFields(f => ({ ...f, extraNotes: "" })) // clear so it's clearly captured
          refreshLeadHistory(contactId)                  // show it in the panel now
          if (showFeedback) {
            setSavedMsg("✅ Nota guardada — mírala abajo en “Notas e historial”")
            setTimeout(() => setSavedMsg(null), 5000)
          }
        } else if (showFeedback) {
          setSavedMsg("⚠️ No se pudo guardar la nota — intenta de nuevo")
          setTimeout(() => setSavedMsg(null), 4000)
        }
      } catch {
        if (showFeedback) {
          setSavedMsg("⚠️ No se pudo guardar la nota — intenta de nuevo")
          setTimeout(() => setSavedMsg(null), 4000)
        }
      }
    }
  }

  function clearCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setCountdown(null)
  }

  function buildNotesString(fields: typeof noteFields): string {
    const lines: string[] = []
    if (fields.propertyTypes.length > 0) lines.push(`Tipo: ${fields.propertyTypes.join(", ")}`)
    if (fields.area) lines.push(`Área: ${fields.area}`)
    const roomParts = []
    if (fields.beds) roomParts.push(`${fields.beds} cuartos`)
    if (fields.baths) roomParts.push(`${fields.baths} baños`)
    if (roomParts.length) lines.push(roomParts.join(", "))
    if (fields.budgetMin || fields.budgetMax) {
      const min = fields.budgetMin ? `$${Number(fields.budgetMin).toLocaleString()}` : ""
      const max = fields.budgetMax ? `$${Number(fields.budgetMax).toLocaleString()}` : ""
      lines.push(`Presupuesto: ${[min, max].filter(Boolean).join(" – ")}`)
    }
    if (fields.timeline) lines.push(`Plazo: ${fields.timeline}`)
    if (fields.purpose) lines.push(`Propósito: ${fields.purpose}`)
    if (fields.actions.length > 0) {
      lines.push("")
      lines.push("INSTRUCCIONES PARA SOFÍA:")
      if (fields.actions.includes("send_email")) lines.push("- Envía un email con propiedades que coincidan con los criterios al inicio de la llamada")
      if (fields.actions.includes("create_task")) lines.push("- Crea una tarea de seguimiento para Catherine después de la llamada")
      if (fields.actions.includes("send_document")) lines.push("- Envía un brochure o documento informativo al lead")
    }
    if (fields.extraNotes) {
      lines.push("")
      lines.push(fields.extraNotes)
    }
    return lines.join("\n").trim()
  }

  function startAutoDialCountdown(nextIdx: number, contact: Contact) {
    clearCountdown()
    let remaining = AUTO_DIAL_DELAY
    setCountdown(remaining)
    countdownRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(countdownRef.current!)
        countdownRef.current = null
        setCountdown(null)
        // Flush notes typed during the countdown before prefill overwrites them
        saveLeadData(false)
        setCurrentCallIndex(nextIdx)
        setCallStatus("idle")
        setAutoDialContact(contact)
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  }

  function skipCountdown() {
    clearCountdown()
    nextCall()
  }

  const filteredContacts = contacts.filter(c => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase()
    const phone = (c.phone || "").toLowerCase()
    const q = searchQuery.toLowerCase()
    return name.includes(q) || phone.includes(q)
  }).filter(c => !queue.some(q => q.id === c.id))

  const currentContact = queue[currentCallIndex] || null

  async function createSession() {
    const res = await fetch("/api/dialer/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Session ${new Date().toLocaleDateString()}` }),
    })
    const data = await res.json()
    const newSession = { calls: [], totalCalls: 0, answered: 0, voicemails: 0, noAnswers: 0, ...data }
    setSessions(prev => [newSession, ...prev])
    setActiveSession(newSession)
    return newSession
  }

  // For a queued lead with no phone: send a follow-up email instead of calling.
  async function emailCurrentLead() {
    const c = queue[currentCallIndex]
    if (!c?.email) { setEmailedNote("Este lead no tiene email tampoco."); return }
    setEmailingLead(true); setEmailedNote(null)
    try {
      const res = await fetch("/api/dialer/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: c.id }),
      })
      const d = await res.json()
      setEmailedNote(d.ok ? "✓ Email de seguimiento enviado" : (d.error || "No se pudo enviar"))
    } catch { setEmailedNote("Error al enviar") } finally { setEmailingLead(false) }
  }

  function addToQueue(contact: Contact) {
    setQueue(prev => [...prev, contact])
  }

  function removeFromQueue(contactId: string) {
    const idx = queue.findIndex(c => c.id === contactId)
    setQueue(prev => prev.filter(c => c.id !== contactId))
    if (idx <= currentCallIndex && currentCallIndex > 0) {
      setCurrentCallIndex(prev => prev - 1)
    }
  }

  function startTimer() {
    setCallDuration(0)
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function stopTimer() {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0")
    const s = (secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // The lead's callable number (primary phone, or the alt phone if there's no
  // primary). Prevents false "no phone" skips when only phone2 is set.
  function leadPhone(contact: Contact): string | null {
    return contact.phone || (contact as any).phone2 || null
  }

  // Why a queued lead can't be dialed right now (shown to the agent, and used
  // to auto-skip in a running session). Returns null when it's safe to call.
  function skipReason(contact: Contact): string | null {
    if (!leadPhone(contact)) return "Sin número de teléfono — usa el botón de Email"
    if ((contact as any).doNotCall) return "Marcado como “No Llamar” (No Contactar)"
    if (skipPartners) {
      const p = assignedPartner(contact)
      if (p) return `Asignado al socio ${p}`
    }
    return null
  }

  function skipAndAdvance(contact: Contact, reason: string) {
    const name = `${contact.firstName} ${contact.lastName || ""}`.trim()
    setSkipNotice(`⏭️ ${name} — ${reason}`)
    // Log the skip so the agent can see exactly what was skipped and why, and
    // call it anyway from the "Omitidos" panel if it was skipped wrongly.
    setSkippedLeads(prev => prev.some(s => s.id === contact.id) ? prev : [{ id: contact.id, name, reason }, ...prev].slice(0, 40))
    const idx = queue.findIndex(q => q.id === contact.id)
    const next = idx + 1
    if (next < queue.length) {
      setCurrentCallIndex(next)
      setCallStatus("idle")
      if (sessionRunningRef.current) dialContact(queue[next])
    } else {
      setSessionRunning(false); sessionRunningRef.current = false
      setCallStatus("idle")
    }
  }

  // Force-call a lead the system skipped (override) — bypasses every skip check.
  function forceCallSkipped(id: string) {
    const idx = queue.findIndex(q => q.id === id)
    if (idx < 0) return
    setSkippedLeads(prev => prev.filter(s => s.id !== id))
    setCurrentCallIndex(idx)
    setCallStatus("idle")
    dialContact(queue[idx], { force: true })
  }

  async function dialContact(contact: Contact, opts?: { force?: boolean }) {
    if (!opts?.force) {
      // Can't / shouldn't dial this lead → tell the agent why, then move on.
      const reason = skipReason(contact)
      if (reason) { skipAndAdvance(contact, reason); return }

      // Fresh, authoritative partner check — catches leads assigned to a partner
      // AFTER the dialer was opened (the in-memory queue would be stale). Only
      // when the partner-skip rule is on.
      if (skipPartners) {
        try {
          const pc = await fetch(`/api/contacts/${contact.id}/partner-check`).then(r => r.ok ? r.json() : null)
          if (pc?.partner) { skipAndAdvance(contact, `Asignado al socio ${pc.partner}`); return }
        } catch { /* if the check fails, fall through and dial */ }
      }
    }

    if (!deviceRef.current) {
      setCallError(deviceError || "Browser calling is not ready yet — wait a moment and try again")
      setCallStatus("idle")
      return
    }
    setCallStatus("calling")
    setCallError(null)
    setDisposition("")
    setNoteFields({ propertyTypes: [], area: "", beds: "", baths: "", budgetMin: "", budgetMax: "", timeline: "", purpose: "", actions: [], extraNotes: "" })

    let session = activeSession
    if (!session) { session = await createSession() }
    const sessionId = session!.id

    try {
      // Log the call in the CRM (no server-side dial — audio runs through this browser)
      const res = await fetch("/api/dialer/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          phoneNumber: contact.phone,
          sessionId,
          browser: true,
        }),
      })
      const data = await res.json()
      setActiveCallId(data.callId || null)

      // Place the call through the browser softphone.
      // First, make absolutely sure no PRIOR call is still holding the Device —
      // after a voicemail drop or a fast "next" the previous leg can linger, and
      // Twilio rejects a second active connection ("can't make the next call").
      try { activeBrowserCallRef.current?.disconnect() } catch { /* noop */ }
      try { deviceRef.current.disconnectAll?.() } catch { /* noop */ }
      activeBrowserCallRef.current = null
      await new Promise(r => setTimeout(r, 400)) // let the SDK release the old leg
      callFinishedRef.current = false // arm the finish-guard for this new call
      wasConnectedRef.current = false // reset per call — set true once it connects

      const digits = (leadPhone(contact) || "").replace(/\D/g, "")
      const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
      const call = await deviceRef.current.connect({ params: { To: e164 } })
      activeBrowserCallRef.current = call

      // Fail-safe: if nothing happens within 45s (never answered / TwiML wrong),
      // tear it down and reset so the UI never freezes on "Dialing…".
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = setTimeout(() => {
        // Never connected within 45s → treat as no-answer and move on, so the
        // queue never freezes on "Dialing…".
        setCallError("La llamada no se conectó (sin respuesta). Pasando a la siguiente…")
        endCall("NO_ANSWER")
      }, 45000)
      const clearConnectTimeout = () => { if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null } }

      call.on("accept", () => { clearConnectTimeout(); wasConnectedRef.current = true; setCallStatus("connected"); startTimer() })
      // Any natural end (callee hung up, voicemail finished) → log + advance.
      call.on("disconnect", () => { clearConnectTimeout(); endCall("COMPLETED") })
      call.on("cancel", () => { clearConnectTimeout(); setCallError("No contestó."); endCall("NO_ANSWER") })
      call.on("error", (e: any) => { clearConnectTimeout(); setCallError(e?.message || "Error de llamada"); endCall("FAILED") })
    } catch (e: any) {
      setCallError(e.message || "Network error — call could not be placed")
      setCallStatus("idle")
    }
  }

  async function endCall(status = "COMPLETED", dispositionOverride?: string, alwaysAdvance = false) {
    if (callFinishedRef.current) return // already finishing this call — never double-advance
    callFinishedRef.current = true
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
    stopTimer()

    // Hang up the browser softphone leg (frees both sides of the call)
    try { activeBrowserCallRef.current?.disconnect() } catch { /* noop */ }
    activeBrowserCallRef.current = null

    if (!activeCallId) {
      setCallStatus("idle")
      // Voicemail-drop / hang-up with no live leg → still move to next, and keep
      // the auto-dial flowing in a running session.
      if (alwaysAdvance && currentCallIndex + 1 < queue.length) {
        const ni = currentCallIndex + 1
        setCurrentCallIndex(ni)
        if (sessionRunningRef.current) setAutoDialContact(queue[ni])
      }
      return
    }

    // Legacy server-dialed calls: also terminate on Twilio's side
    if (activeTwilioSid) {
      fetch("/api/dialer/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twilioSid: activeTwilioSid }),
      }).catch(() => {})
    }

    await fetch("/api/dialer/call", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callId: activeCallId,
        status,
        disposition: dispositionOverride || disposition || undefined,
        notes: buildNotesString(noteFields) || undefined,
        duration: callDuration,
      }),
    })

    // Remember this call so notes typed AFTER hang-up can still be saved,
    // and sync the buyer criteria to the contact right away.
    lastCallIdRef.current = activeCallId
    saveLeadData(false)

    // refresh active session stats
    const res = await fetch("/api/dialer/sessions")
    const updated: DialerSession[] = await res.json()
    setSessions(updated)
    const refreshed = updated.find(s => s.id === activeSession?.id) || null
    setActiveSession(refreshed)

    setCallStatus("ended")
    setActiveCallId(null)
    setActiveTwilioSid(null)

    const nextIdx = currentCallIndex + 1
    const running = sessionRunningRef.current
    if (nextIdx >= queue.length) {
      if (running) { setSessionRunning(false); sessionRunningRef.current = false }
      return
    }
    if (alwaysAdvance) {
      // Explicit "Colgar y siguiente" / voicemail drop → go to the next lead now.
      setCurrentCallIndex(nextIdx)
      setCallStatus("idle")
      if (running) setAutoDialContact(queue[nextIdx])
    } else if (running && !wasConnectedRef.current) {
      // Auto-dial ONLY advances calls that never connected (no answer). A call
      // that connected (answered / voicemail) stays on the "ended" screen so the
      // agent can leave a message, take notes, then move on when ready.
      startAutoDialCountdown(nextIdx, queue[nextIdx])
    }
    // else: connected call ended, or manual mode → stay on "ended".
  }

  async function nextCall() {
    // Manual skip: drop any live leg and block its disconnect from also
    // advancing (nextCall itself advances — this prevents a double-skip).
    callFinishedRef.current = true
    try { activeBrowserCallRef.current?.disconnect() } catch { /* noop */ }
    activeBrowserCallRef.current = null
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
    stopTimer()
    // Flush any notes typed after hang-up before the prefill overwrites them
    saveLeadData(false)
    const next = currentCallIndex + 1
    if (next >= queue.length) {
      setSessionRunning(false); sessionRunningRef.current = false
      setCallStatus("idle")
      return
    }
    setCurrentCallIndex(next)
    setCallStatus("idle")
    if (sessionRunningRef.current) {
      await dialContact(queue[next])
    }
  }

  async function startDialing() {
    if (queue.length === 0) return
    setSessionRunning(true); sessionRunningRef.current = true
    setCurrentCallIndex(0)
    await dialContact(queue[0])
  }

  function pauseDialing() {
    clearCountdown()
    setSessionRunning(false); sessionRunningRef.current = false
    if (callStatus === "connected") endCall("COMPLETED")
    else setCallStatus("idle")
  }

  // Rebuild the Twilio browser device from scratch (used by the Reset button).
  async function reinitDevice() {
    try { deviceRef.current?.destroy() } catch { /* noop */ }
    deviceRef.current = null
    setDeviceReady(false)
    try {
      const res = await fetch("/api/twilio/token")
      const { token, error } = await res.json()
      if (error || !token) { setDeviceError(error || "Browser calling not configured"); return }
      const { Device } = await import("@twilio/voice-sdk")
      const device = new Device(token, { codecPreferences: ["opus", "pcmu"] as any })
      device.on("error", (e: any) => console.error("[dialer] device error:", e))
      device.on("tokenWillExpire", async () => {
        try { const r = await fetch("/api/twilio/token"); const d = await r.json(); if (d.token) device.updateToken(d.token) } catch {}
      })
      deviceRef.current = device
      setDeviceReady(true); setDeviceError(null)
    } catch { setDeviceError("Browser calling not available in this browser") }
  }

  // Full reset — for when the dialer gets stuck. Tears down any live call,
  // clears all call state, and rebuilds the phone connection so you can keep
  // going without reloading the page.
  async function resetDialer() {
    clearCountdown()
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
    stopTimer()
    try { activeBrowserCallRef.current?.disconnect() } catch { /* noop */ }
    try { deviceRef.current?.disconnectAll?.() } catch { /* noop */ }
    activeBrowserCallRef.current = null
    callFinishedRef.current = false
    setSessionRunning(false); sessionRunningRef.current = false
    setCallStatus("idle")
    setActiveCallId(null); setActiveTwilioSid(null)
    setCallError(null); setSkipNotice(null); setCountdown(null)
    setAutoDialContact(null)
    await reinitDevice()
    setSkipNotice("🔄 Marcador reiniciado — listo para continuar")
  }

  const statusColor = {
    idle: "bg-gray-100 text-gray-600",
    calling: "bg-amber-100 text-amber-700 animate-pulse",
    connected: "bg-green-100 text-green-700",
    ended: "bg-blue-100 text-blue-700",
  }[callStatus]

  const callStatusLabel = {
    idle: "Ready",
    calling: "Dialing...",
    connected: "Connected",
    ended: "Call Ended",
  }[callStatus]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Browser calling not configured warning */}
      {deviceError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800">
          <strong>⚠️ Browser calling unavailable:</strong> {deviceError}
          {deviceError.toLowerCase().includes("not configured") && (
            <span> — In Railway, set <code className="bg-amber-100 px-1 rounded">TWILIO_API_KEY_SID</code>, <code className="bg-amber-100 px-1 rounded">TWILIO_API_KEY_SECRET</code> and <code className="bg-amber-100 px-1 rounded">TWILIO_TWIML_APP_SID</code>, and point the TwiML App&apos;s Voice URL to <code className="bg-amber-100 px-1 rounded">/api/twilio/voice</code>.</span>
          )}
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Power Dialer</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Multi-contact calling session management
            {deviceReady && <span className="ml-2 text-green-600 font-medium">· 🎧 Browser phone ready</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HelpPanel section="dialer" />
          {callError && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{callError}</span>
              <button onClick={() => setCallError(null)} className="ml-1 hover:text-red-900">✕</button>
            </div>
          )}
          {skipNotice && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span>{skipNotice}</span>
              <button onClick={() => setSkipNotice(null)} className="ml-1 hover:text-amber-950">✕</button>
            </div>
          )}
          {skippedLeads.length > 0 && (
            <div className="px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs w-full max-w-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-amber-800">Omitidos en esta sesión ({skippedLeads.length})</span>
                <button onClick={() => setSkippedLeads([])} className="text-amber-600 hover:text-amber-900">Limpiar</button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {skippedLeads.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <span className="text-amber-800 truncate"><strong>{s.name}</strong> — {s.reason}</span>
                    <button
                      onClick={() => forceCallSkipped(s.id)}
                      className="flex-shrink-0 text-[11px] font-semibold bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700"
                    >
                      📞 Llamar de todos modos
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={cn("px-3 py-1.5 rounded-full text-sm font-medium", statusColor)}>
            {callStatusLabel}
            {callStatus === "connected" && (
              <span className="ml-2 font-mono">{formatDuration(callDuration)}</span>
            )}
          </div>
          <button
            onClick={createSession}
            className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Queue + Contact selector */}
        <div className="w-80 flex flex-col bg-white border-r overflow-hidden">
          {/* Session stats */}
          {activeSession && (
            <div className="p-4 border-b bg-lofty-50">
              <div className="text-xs font-semibold text-lofty-700 mb-2 uppercase tracking-wide">
                {activeSession.name}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total", value: activeSession.totalCalls },
                  { label: "Reached", value: activeSession.answered, color: "text-green-600" },
                  { label: "Voicemail", value: activeSession.voicemails, color: "text-amber-600" },
                  { label: "No Answer", value: activeSession.noAnswers, color: "text-red-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-lg p-2 text-center">
                    <div className={cn("text-lg font-bold", color || "text-gray-900")}>{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Queue list */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold text-gray-700">
              Call Queue ({queue.length})
            </span>
            {queue.length > 0 && (
              <span className="text-xs text-gray-500">
                {currentCallIndex + 1}/{queue.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <Users className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Add contacts to your call queue</p>
              </div>
            ) : (
              queue.map((c, idx) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors",
                    idx === currentCallIndex && "bg-lofty-50 border-l-2 border-l-lofty-600"
                  )}
                  onClick={() => { setCurrentCallIndex(idx); setCallStatus("idle") }}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    idx === currentCallIndex ? "bg-lofty-600 text-white" : "bg-gray-200 text-gray-600"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                      {formatPhone(c.phone || "")}
                      {skipReason(c) && (
                        <span className="text-[10px] px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 font-medium">
                          ⏭️ Se omitirá — {skipReason(c)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeFromQueue(c.id) }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add contacts section */}
          <div className="border-t">
            <button
              onClick={() => setAddingToQueue(!addingToQueue)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-lofty-700 hover:bg-lofty-50"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Contacts
              </span>
              {addingToQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {addingToQueue && (
              <div className="border-t">
                {/* Pipeline stage filter */}
                <div className="p-2 border-b space-y-2">
                  <select
                    value={selectedStage}
                    onChange={e => { setSelectedStage(e.target.value); setSearchQuery("") }}
                    className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500 bg-white"
                  >
                    <option value="all">Todos los contactos con teléfono</option>
                    {pipelineStages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.contacts.length})
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar contacto..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-lofty-500"
                    />
                  </div>
                  {/* Add all from stage */}
                  {selectedStage !== "all" && (() => {
                    const stage = pipelineStages.find(s => s.id === selectedStage)
                    const toAdd = (stage?.contacts || []).filter((c: Contact) => !queue.some(q => q.id === c.id))
                    return toAdd.length > 0 ? (
                      <button
                        onClick={() => toAdd.forEach((c: Contact) => addToQueue(c))}
                        className="w-full text-xs bg-lofty-600 text-white rounded-md py-1.5 font-medium hover:bg-lofty-700"
                      >
                        + Agregar todos ({toAdd.length})
                      </button>
                    ) : null
                  })()}
                </div>
                {/* Contact list */}
                <div className="max-h-48 overflow-y-auto">
                  {(() => {
                    const pool = selectedStage === "all"
                      ? contacts
                      : (pipelineStages.find(s => s.id === selectedStage)?.contacts || [])
                    const filtered = pool
                      .filter((c: Contact) => !queue.some(q => q.id === c.id))
                      .filter((c: Contact) => {
                        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
                        return name.includes(searchQuery.toLowerCase()) || (c.phone || "").includes(searchQuery)
                      })
                    if (filtered.length === 0) return (
                      <p className="text-xs text-gray-500 p-3 text-center">No hay contactos</p>
                    )
                    return filtered.slice(0, 30).map((c: Contact) => (
                      <button
                        key={c.id}
                        onClick={() => addToQueue(c)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                      >
                        <div className="w-7 h-7 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-lofty-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{formatPhone(c.phone || "")}</div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-lofty-500 flex-shrink-0" />
                      </button>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Active call panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Current contact */}
          <div className="bg-white border-b p-6">
            {currentContact ? (
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-lofty-700">
                    {currentContact.firstName[0]}{currentContact.lastName[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {/* Opens in a NEW TAB so the dialer session (queue, position,
                        call state) is never lost — browser Back was resetting it */}
                    <a
                      href={`/contacts/${currentContact.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-lofty-600 transition-colors"
                      title="Abrir la ficha del lead en otra pestaña (el dialer sigue aquí)"
                    >
                      {currentContact.firstName} {currentContact.lastName}
                    </a>
                    <a
                      href={`/contacts/${currentContact.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-lofty-600 hover:bg-lofty-50 transition-colors"
                      title="Ver ficha completa (nueva pestaña)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      {formatPhone(currentContact.phone || "")}
                    </span>
                    {currentContact.phone2 && (
                      <span className="text-gray-500 text-sm flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {formatPhone(currentContact.phone2)} (alt)
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      currentContact.status === "HOT_LEAD" ? "bg-red-100 text-red-700" :
                      currentContact.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {currentContact.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: <strong>{currentContact.leadScore}</strong>
                    </span>
                  </div>
                  {assignedPartner(currentContact) && (
                    <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-1.5 text-sm font-semibold">
                      🤝 Este lead pertenece a {assignedPartner(currentContact)} — respeta la asignación del socio (no llamar).
                    </div>
                  )}
                </div>

                {/* Call controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {!currentContact?.phone ? (
                    // No phone → email this lead instead of calling.
                    <div className="flex items-center gap-3">
                      <button
                        onClick={emailCurrentLead}
                        disabled={emailingLead || !currentContact?.email}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-lg shadow-sm transition-colors disabled:opacity-50"
                        title={currentContact?.email ? "Este lead no tiene teléfono — envíale un email de seguimiento" : "Sin teléfono ni email"}
                      >
                        {emailingLead ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                        {currentContact?.email ? "Enviar email (sin teléfono)" : "Sin teléfono ni email"}
                      </button>
                      <button onClick={nextCall} className="flex items-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium">
                        Siguiente →
                      </button>
                      {emailedNote && <span className="text-sm text-emerald-600 font-medium">{emailedNote}</span>}
                    </div>
                  ) : callStatus === "idle" || callStatus === "ended" ? (
                    <button
                      onClick={() => dialContact(currentContact)}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-lg shadow-sm transition-colors"
                    >
                      <Phone className="w-5 h-5" /> Call
                    </button>
                  ) : callStatus === "calling" ? (
                    <button
                      onClick={() => {
                        activeBrowserCallRef.current?.disconnect()
                        activeBrowserCallRef.current = null
                        stopTimer()
                        setCallStatus("idle")
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-semibold text-lg shadow-sm animate-pulse"
                    >
                      <PhoneOff className="w-5 h-5" /> Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => endCall("COMPLETED", undefined, true)}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-lg shadow-sm"
                      title="Cuelga la llamada, guarda las notas y pasa a la siguiente"
                    >
                      <PhoneOff className="w-5 h-5" /> Colgar y siguiente
                    </button>
                  )}

                  {(callStatus === "connected" || callStatus === "calling" || callStatus === "ended") && vmTemplates.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => { clearCountdown(); setShowVmMenu(v => !v) }}
                        disabled={droppingVm}
                        title="Deja un mensaje pregrabado y pasa a la siguiente llamada"
                        className="flex items-center gap-2 px-4 py-3 border-2 border-amber-300 text-amber-700 rounded-xl hover:bg-amber-50 font-medium disabled:opacity-50"
                      >
                        {droppingVm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Voicemail className="w-4 h-4" />}
                        Buzón de voz <ChevronDown className="w-3 h-3" />
                      </button>
                      {showVmMenu && (
                        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-1 max-h-64 overflow-y-auto">
                          {vmTemplates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => dropVoicemailAndNext(t)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 text-sm flex items-center justify-between gap-2"
                            >
                              <span className="font-medium text-gray-800 truncate">{t.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{t.audioUrl ? "🎙️ audio" : "✍️ texto"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {currentCallIndex < queue.length - 1 && (
                    <button
                      onClick={nextCall}
                      disabled={callStatus === "connected"}
                      className="flex items-center gap-2 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:border-lofty-400 hover:text-lofty-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <SkipForward className="w-4 h-4" /> Skip
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <PhoneCall className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">No contacts in queue</h3>
                <p className="text-sm text-gray-500 mt-1">Add contacts from the left panel to start dialing</p>
              </div>
            )}
          </div>

          {/* Session controls */}
          {queue.length > 0 && (
            <div className="bg-lofty-50 border-b px-6 py-3 flex items-center gap-4">
              {!sessionRunning ? (
                <button
                  onClick={startDialing}
                  disabled={callStatus === "connected"}
                  className="flex items-center gap-2 px-5 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 font-medium text-sm disabled:opacity-40"
                >
                  <Play className="w-4 h-4" /> Start Auto-Dial
                </button>
              ) : (
                <button
                  onClick={pauseDialing}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              <button
                onClick={resetDialer}
                title="Reinicia el marcador si se traba — cuelga la llamada actual y reconecta el teléfono"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar
              </button>
              <label
                className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none"
                title="Si está activo, el marcador salta los leads asignados a un socio (Bryan, etc.). Desactívalo para llamar a todos."
              >
                <input type="checkbox" checked={skipPartners} onChange={e => setSkipPartners(e.target.checked)} className="rounded" />
                Saltar leads de socios
              </label>
              <span className="text-sm text-lofty-700">
                {sessionRunning ? "Auto-dialing enabled — next call starts automatically" : "Manual mode — click Call to dial each contact"}
              </span>
            </div>
          )}

          {/* Lead notes + history (so you see the prior conversation while calling) */}
          {queue[currentCallIndex] && (
            <div className="bg-white border-b px-6 py-4">
              <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                📋 Notas e historial del lead
                {loadingHistory && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              </label>
              {leadHistory?.referrals?.some((r: any) => ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"].includes(r.status)) && (
                <div className="mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5">
                  🤝 Asignado a un socio: {leadHistory.referrals.filter((r: any) => r.partner?.name).map((r: any) => `${r.partner.name} (${r.status})`).join(", ")}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Notes */}
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 max-h-44 overflow-y-auto">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas ({leadHistory?.notes?.length || 0})</p>
                  {leadHistory?.notes?.length ? leadHistory.notes.map((n: any) => (
                    <div key={n.id} className="mb-2 text-xs text-gray-700 border-l-2 border-lofty-200 pl-2">
                      {n.isPinned && <span className="text-[10px] text-amber-600 mr-1">📌</span>}
                      <span className="whitespace-pre-wrap">{n.content}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">
                        {n.author?.name ? `${n.author.name} · ` : ""}{new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )) : <p className="text-xs text-gray-400">Sin notas.</p>}
                </div>
                {/* Activity timeline */}
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 max-h-44 overflow-y-auto">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Historial ({leadHistory?.activities?.length || 0})</p>
                  {leadHistory?.activities?.length ? leadHistory.activities.map((a: any) => (
                    <div key={a.id} className="mb-1.5 text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-gray-300 mt-0.5">•</span>
                      <span>
                        <span className="font-medium text-gray-700">{a.title || a.type}</span>
                        {a.description ? <span className="text-gray-500"> — {a.description.slice(0, 80)}</span> : null}
                        <span className="block text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  )) : <p className="text-xs text-gray-400">Sin actividad registrada.</p>}
                </div>
              </div>
            </div>
          )}

          {/* Disposition + Notes (shown when call is active or ended) */}
          {queue[currentCallIndex] && (
            <div className="bg-white border-b px-6 py-4">
              <div className="mb-3">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Call Disposition</label>
                <div className="flex flex-wrap gap-2">
                  {DISPOSITIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDisposition(d.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                        disposition === d.value
                          ? "bg-lofty-600 text-white border-lofty-600"
                          : "border-gray-200 text-gray-600 hover:border-lofty-300 hover:text-lofty-700"
                      )}
                    >
                      <d.icon className={cn("w-3.5 h-3.5", disposition === d.value ? "text-white" : d.color)} />
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Lead Notes</label>
                <div className="space-y-2">
                  {/* Property types — pick one or MORE (synced to the contact) */}
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {TYPE_LABELS.map(label => {
                        const active = noteFields.propertyTypes.includes(label)
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setNoteFields(f => ({
                              ...f,
                              propertyTypes: active
                                ? f.propertyTypes.filter(t => t !== label)
                                : [...f.propertyTypes, label],
                            }))}
                            className={cn(
                              "text-xs px-2 py-1 rounded-full border transition-colors",
                              active
                                ? "bg-lofty-600 text-white border-lofty-600 font-semibold"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Área / Zona (ej: Miami, Homestead, 33032)..."
                    value={noteFields.area}
                    onChange={e => setNoteFields(f => ({ ...f, area: e.target.value }))}
                    className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
                  />
                  {/* Beds + baths + timeline */}
                  <div className="flex gap-2">
                    <select
                      value={noteFields.beds}
                      onChange={e => setNoteFields(f => ({ ...f, beds: e.target.value }))}
                      className="flex-1 text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500 bg-white"
                    >
                      <option value="">Cuartos</option>
                      {["1+","2+","3+","4+","5+"].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select
                      value={noteFields.baths}
                      onChange={e => setNoteFields(f => ({ ...f, baths: e.target.value }))}
                      className="flex-1 text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500 bg-white"
                    >
                      <option value="">Baños</option>
                      {["1+","2+","3+","4+"].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select
                      value={noteFields.timeline}
                      onChange={e => setNoteFields(f => ({ ...f, timeline: e.target.value }))}
                      className="flex-1 text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500 bg-white"
                    >
                      <option value="">Plazo...</option>
                      <option>Lo antes posible</option>
                      <option>1-3 meses</option>
                      <option>3-6 meses</option>
                      <option>6-12 meses</option>
                      <option>1+ año</option>
                    </select>
                  </div>
                  {/* Budget */}
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 flex-shrink-0">$</span>
                    <input
                      type="number"
                      placeholder="Presupuesto mín"
                      value={noteFields.budgetMin}
                      onChange={e => setNoteFields(f => ({ ...f, budgetMin: e.target.value }))}
                      className="flex-1 text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
                    />
                    <span className="text-xs text-gray-400">–</span>
                    <input
                      type="number"
                      placeholder="Presupuesto máx"
                      value={noteFields.budgetMax}
                      onChange={e => setNoteFields(f => ({ ...f, budgetMax: e.target.value }))}
                      className="flex-1 text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
                    />
                  </div>
                  {/* Purpose */}
                  <select
                    value={noteFields.purpose}
                    onChange={e => setNoteFields(f => ({ ...f, purpose: e.target.value }))}
                    className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500 bg-white"
                  >
                    <option value="">Propósito de compra...</option>
                    <option>Vivienda personal</option>
                    <option>Inversión Airbnb</option>
                    <option>Alquiler largo plazo</option>
                    <option>Inversión para revender</option>
                    <option>Para la familia</option>
                  </select>
                  {/* Sofia actions */}
                  <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-2">
                    <p className="text-xs font-semibold text-indigo-700 mb-1.5">Acciones para Sofía:</p>
                    <div className="space-y-1">
                      {[
                        { key: "send_email", label: "Enviar propiedades por email" },
                        { key: "create_task", label: "Crear tarea de seguimiento" },
                        { key: "send_document", label: "Enviar brochure/documento" },
                      ].map(action => (
                        <label key={action.key} className="flex items-center gap-2 text-xs cursor-pointer text-indigo-800">
                          <input
                            type="checkbox"
                            checked={noteFields.actions.includes(action.key)}
                            onChange={e => setNoteFields(f => ({
                              ...f,
                              actions: e.target.checked
                                ? [...f.actions, action.key]
                                : f.actions.filter(a => a !== action.key),
                            }))}
                            className="w-3 h-3"
                          />
                          {action.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Extra notes */}
                  <textarea
                    value={noteFields.extraNotes}
                    onChange={e => setNoteFields(f => ({ ...f, extraNotes: e.target.value }))}
                    onFocus={clearCountdown} // taking notes pauses the auto-dial timer so nothing is lost
                    placeholder="Notas adicionales..."
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500 resize-none"
                  />
                  {/* Save now — also auto-saves on hang-up and when advancing */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveLeadData(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-lofty-600 text-white text-xs font-semibold rounded-lg hover:bg-lofty-700 transition-colors"
                    >
                      💾 Guardar notas y preferencias
                    </button>
                    {savedMsg && <span className="text-xs text-gray-600">{savedMsg}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Las preferencias se guardan en la ficha del lead (mismos campos que en Contacts) y activan sus alertas de propiedades.
                  </p>
                </div>
              </div>
              {callStatus === "ended" && (
                <div className="mt-3 space-y-3">
                  {countdown !== null ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Auto-dialing next in…</p>
                        <div className="text-3xl font-bold text-indigo-800 tabular-nums">{countdown}s</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={skipCountdown}
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                        >
                          <Zap className="w-3.5 h-3.5" /> Dial Now
                        </button>
                        <button
                          onClick={() => { clearCountdown(); setSessionRunning(false) }}
                          className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 text-gray-600"
                        >
                          Pause
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={nextCall}
                        className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
                      >
                        <SkipForward className="w-4 h-4" />
                        {currentCallIndex < queue.length - 1 ? "Next Contact" : "Finish Session"}
                      </button>
                      <span className="text-sm text-gray-500">
                        Duration: <strong>{formatDuration(callDuration)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Call history */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Call History</h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-lofty-600 hover:text-lofty-800"
              >
                {showHistory ? "Hide" : "Show all"}
              </button>
            </div>
            {activeSession && activeSession.calls.length > 0 ? (
              <div className="space-y-2">
                {(showHistory ? activeSession.calls : activeSession.calls.slice(0, 8)).map(call => (
                  <div key={call.id} className="bg-white rounded-lg border p-3 flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      call.status === "COMPLETED" ? "bg-green-100" :
                      call.status === "NO_ANSWER" ? "bg-red-100" :
                      call.status === "FAILED" ? "bg-red-100" :
                      "bg-amber-100"
                    )}>
                      {call.status === "COMPLETED" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                       call.status === "NO_ANSWER" ? <PhoneMissed className="w-4 h-4 text-red-500" /> :
                       call.disposition === "VOICEMAIL" ? <Voicemail className="w-4 h-4 text-amber-600" /> :
                       <Phone className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {call.contact ? `${call.contact.firstName} ${call.contact.lastName}` : call.phoneNumber}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(call.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-xs font-medium",
                          call.status === "COMPLETED" ? "text-green-600" :
                          call.status === "NO_ANSWER" ? "text-red-500" :
                          "text-amber-600"
                        )}>
                          {call.disposition || call.status.replace("_", " ")}
                        </span>
                        {call.duration && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                      {call.notes && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{call.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No calls in this session yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Session history */}
        <div className="w-64 bg-white border-l flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">Past Sessions</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors",
                  activeSession?.id === s.id && "bg-lofty-50 border-l-2 border-l-lofty-600"
                )}
              >
                <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {s.totalCalls} calls
                  </span>
                  {s.answered > 0 && (
                    <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                      {s.answered} reached
                    </span>
                  )}
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BarChart3 className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">No sessions yet</p>
              </div>
            )}
          </div>
          <div className="p-3 border-t">
            <div className="bg-lofty-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-lofty-700 mb-2">All-Time Stats</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Calls</span>
                  <strong>{sessions.reduce((a, s) => a + s.totalCalls, 0)}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Reached</span>
                  <strong className="text-green-600">{sessions.reduce((a, s) => a + s.answered, 0)}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Connect Rate</span>
                  <strong>
                    {sessions.reduce((a, s) => a + s.totalCalls, 0) > 0
                      ? Math.round(sessions.reduce((a, s) => a + s.answered, 0) / sessions.reduce((a, s) => a + s.totalCalls, 0) * 100)
                      : 0}%
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
