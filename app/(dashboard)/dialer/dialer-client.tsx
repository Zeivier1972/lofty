"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  Phone, PhoneOff, PhoneMissed, PhoneCall, PhoneIncoming,
  Play, Pause, SkipForward, Plus, Trash2, Clock,
  CheckCircle2, XCircle, MessageSquare, Voicemail,
  BarChart3, Users, Target, TrendingUp,
  ChevronDown, ChevronUp, Search, User,
  Zap, Sparkles, Bot, PhoneForwarded, Loader2, Mail, MapPin,
} from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface ParallelSlot {
  contactId: string
  callId: string
  name: string
  phone: string
  status: "ringing" | "connected" | "no-answer" | "cancelled" | "voicemail"
}

interface AIAnalysis {
  summary: string
  mlsSearch: Record<string, any> | null
  tasks: any[]
  message: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  phone2: string | null
  status: string
  leadScore: number
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

export default function DialerClient({ contacts, sessions: initialSessions, pipelineStages }: Props) {
  const { toast } = useToast()
  const [dialMode, setDialMode] = useState<"standard" | "parallel">("standard")

  // ── Standard mode state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<DialerSession[]>(initialSessions)
  const [activeSession, setActiveSession] = useState<DialerSession | null>(initialSessions[0] || null)
  const [queue, setQueue] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentCallIndex, setCurrentCallIndex] = useState(0)
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle")
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [activeTwilioSid, setActiveTwilioSid] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null)
  const [disposition, setDisposition] = useState("")
  const [callNotes, setCallNotes] = useState("")
  const [sessionRunning, setSessionRunning] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [addingToQueue, setAddingToQueue] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string>("all")

  // ── Parallel mode state ───────────────────────────────────────────────────────
  const [parallelSlots, setParallelSlots] = useState<ParallelSlot[]>([])
  const [activeContact, setActiveContact] = useState<any>(null)
  const [activeParallelCallId, setActiveParallelCallId] = useState<string | null>(null)
  const [parallelNotes, setParallelNotes] = useState("")
  const [parallelDisposition, setParallelDisposition] = useState("")
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [analyzingNotes, setAnalyzingNotes] = useState(false)
  const [deviceReady, setDeviceReady] = useState(false)
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [parallelDialing, setParallelDialing] = useState(false)
  const [parallelCallActive, setParallelCallActive] = useState(false)
  const twilioDeviceRef = useRef<any>(null)
  const sseRef = useRef<EventSource | null>(null)

  // SSE connection for real-time parallel dial events
  useEffect(() => {
    const es = new EventSource("/api/dialer/events")
    sseRef.current = es

    es.addEventListener("call-answered", (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setActiveContact(data.contact)
      setActiveParallelCallId(data.callId)
      setParallelCallActive(true)
      setParallelSlots(prev => prev.map(s =>
        s.contactId === data.contactId
          ? { ...s, status: "connected" }
          : s.status === "ringing" ? { ...s, status: "cancelled" } : s
      ))
      toast({ title: `📞 Connected: ${data.contact?.firstName || "Contact"} answered!` })
    })

    es.addEventListener("call-ended", () => {
      setParallelCallActive(false)
      toast({ title: "Call ended" })
    })

    es.addEventListener("all-missed", () => {
      setParallelSlots(prev => prev.map(s => ({ ...s, status: s.status === "ringing" ? "no-answer" : s.status })))
      setParallelDialing(false)
      toast({ title: "No one answered — ready for next batch" })
    })

    return () => { es.close(); sseRef.current = null }
  }, [])

  async function initTwilioDevice() {
    setDeviceLoading(true)
    try {
      const res = await fetch("/api/dialer/token")
      const { token, identity, mock } = await res.json()
      if (mock) {
        setDeviceReady(true)
        toast({ title: "Phone initialized (mock mode — add Twilio API keys to Railway for live calls)" })
        return
      }
      const { Device } = await import("@twilio/voice-sdk")
      const device = new Device(token, { logLevel: "warn" })
      device.on("incoming", (call: any) => {
        call.accept()
        toast({ title: "Incoming call connected" })
      })
      await device.register()
      twilioDeviceRef.current = device
      setDeviceReady(true)
      toast({ title: "✅ Browser phone ready" })
    } catch (e: any) {
      toast({ title: e.message || "Failed to initialize phone", variant: "destructive" })
    } finally {
      setDeviceLoading(false)
    }
  }

  async function dialParallelBatch(batch: Contact[]) {
    if (!batch.length) return
    setParallelDialing(true)
    setAiAnalysis(null)
    setParallelNotes("")
    setActiveContact(null)
    setParallelSlots(batch.map(c => ({
      contactId: c.id,
      callId: "",
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone || "",
      status: "ringing",
    })))

    try {
      const res = await fetch("/api/dialer/parallel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: batch.map(c => c.id), sessionId: activeSession?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Update slot callIds from response
      setParallelSlots(prev => prev.map(s => {
        const call = data.calls?.find((c: any) => c.contactId === s.contactId)
        return call ? { ...s, callId: call.id } : s
      }))
    } catch (e: any) {
      toast({ title: e.message || "Failed to start parallel dial", variant: "destructive" })
      setParallelDialing(false)
      setParallelSlots([])
    }
  }

  async function analyzeNotes() {
    if (!parallelNotes.trim()) return
    setAnalyzingNotes(true)
    try {
      const res = await fetch("/api/dialer/analyze-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: activeParallelCallId,
          notes: parallelNotes,
          contactId: activeContact?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiAnalysis(data)
    } catch (e: any) {
      toast({ title: e.message || "AI analysis failed", variant: "destructive" })
    } finally {
      setAnalyzingNotes(false)
    }
  }

  function endParallelCall() {
    setParallelCallActive(false)
    setParallelDialing(false)
    if (twilioDeviceRef.current?.activeCall) {
      twilioDeviceRef.current.activeCall.disconnect()
    }
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
    const t = setInterval(() => setCallDuration(d => d + 1), 1000)
    setCallTimer(t)
  }

  function stopTimer() {
    if (callTimer) { clearInterval(callTimer); setCallTimer(null) }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0")
    const s = (secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  async function dialContact(contact: Contact) {
    if (!contact.phone) return
    setCallStatus("calling")
    setDisposition("")
    setCallNotes("")

    let session = activeSession
    if (!session) { session = await createSession() }
    const sessionId = session!.id

    try {
      const res = await fetch("/api/dialer/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          phoneNumber: contact.phone,
          sessionId,
        }),
      })
      const data = await res.json()
      setActiveCallId(data.callId)
      setActiveTwilioSid(data.twilioSid)
      setCallStatus("connected")
      startTimer()
    } catch {
      setCallStatus("idle")
    }
  }

  async function endCall(status = "COMPLETED") {
    stopTimer()
    if (!activeCallId) { setCallStatus("idle"); return }

    await fetch("/api/dialer/call", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callId: activeCallId,
        status,
        disposition: disposition || undefined,
        notes: callNotes || undefined,
        duration: callDuration,
      }),
    })

    // refresh active session stats
    const res = await fetch("/api/dialer/sessions")
    const updated: DialerSession[] = await res.json()
    setSessions(updated)
    const refreshed = updated.find(s => s.id === activeSession?.id) || null
    setActiveSession(refreshed)

    setCallStatus("ended")
    setActiveCallId(null)
    setActiveTwilioSid(null)
  }

  async function nextCall() {
    const next = currentCallIndex + 1
    if (next >= queue.length) {
      setSessionRunning(false)
      setCallStatus("idle")
      return
    }
    setCurrentCallIndex(next)
    setCallStatus("idle")
    if (sessionRunning) {
      await dialContact(queue[next])
    }
  }

  async function startDialing() {
    if (queue.length === 0) return
    setSessionRunning(true)
    setCurrentCallIndex(0)
    await dialContact(queue[0])
  }

  function pauseDialing() {
    setSessionRunning(false)
    if (callStatus === "connected") endCall("COMPLETED")
    else setCallStatus("idle")
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
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Power Dialer</h1>
            <p className="text-sm text-gray-500 mt-0.5">Multi-contact calling session management</p>
          </div>
          {/* Mode tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 ml-4">
            <button
              onClick={() => setDialMode("standard")}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", dialMode === "standard" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
            >
              Standard
            </button>
            <button
              onClick={() => setDialMode("parallel")}
              className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", dialMode === "parallel" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
            >
              <Zap className="w-3.5 h-3.5" /> Parallel x3
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dialMode === "standard" && (
            <>
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
            </>
          )}
          {dialMode === "parallel" && (
            <button
              onClick={deviceReady ? undefined : initTwilioDevice}
              disabled={deviceLoading || deviceReady}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                deviceReady ? "bg-green-100 text-green-700 cursor-default" :
                "bg-lofty-600 text-white hover:bg-lofty-700 disabled:opacity-60"
              )}
            >
              {deviceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {deviceReady ? "Phone Ready ✓" : deviceLoading ? "Initializing..." : "Initialize Phone"}
            </button>
          )}
        </div>
      </div>

      {/* ── PARALLEL MODE ─────────────────────────────────────────────────────── */}
      {dialMode === "parallel" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Contact queue (reused) */}
          <div className="w-72 flex flex-col bg-white border-r overflow-hidden">
            <div className="px-4 py-3 border-b bg-lofty-50">
              <p className="text-xs font-semibold text-lofty-700 uppercase tracking-wide">Call Queue</p>
              <p className="text-xs text-gray-500 mt-0.5">Add contacts — dial 3 at once</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {queue.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 border-b hover:bg-gray-50">
                  <div className="w-7 h-7 bg-lofty-100 rounded-full flex items-center justify-center text-xs font-bold text-lofty-700 flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-gray-500">{formatPhone(c.phone || "")}</div>
                  </div>
                  <button onClick={() => removeFromQueue(c.id)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {queue.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                  <Users className="w-7 h-7 text-gray-300 mb-2" />
                  <p className="text-xs text-gray-500">Add contacts below</p>
                </div>
              )}
            </div>
            {/* Add contacts */}
            <div className="border-t">
              <button onClick={() => setAddingToQueue(!addingToQueue)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-lofty-700 hover:bg-lofty-50">
                <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add Contacts</span>
                {addingToQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {addingToQueue && (
                <div className="border-t">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-lofty-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {contacts.filter(c => !queue.some(q => q.id === c.id) && (`${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone || "").includes(searchQuery))).slice(0, 30).map(c => (
                      <button key={c.id} onClick={() => addToQueue(c)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                        <div className="w-6 h-6 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-lofty-600" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{c.firstName} {c.lastName}</div>
                          <div className="text-xs text-gray-500">{formatPhone(c.phone || "")}</div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-lofty-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                  {queue.length < 3 && queue.length > 0 && (
                    <div className="p-2">
                      <button
                        onClick={() => dialParallelBatch(queue.slice(0, 3))}
                        disabled={parallelDialing || !deviceReady}
                        className="w-full py-2 bg-lofty-600 text-white text-xs font-semibold rounded-lg hover:bg-lofty-700 disabled:opacity-40"
                      >
                        <Zap className="w-3.5 h-3.5 inline mr-1" /> Dial {Math.min(queue.length, 3)} Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center: Parallel dialer UI */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-5">

            {/* 3 call slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-lofty-600" /> Parallel Calls
                </h3>
                {queue.length > 0 && !parallelCallActive && (
                  <button
                    onClick={() => dialParallelBatch(queue.slice(currentCallIndex, currentCallIndex + 3))}
                    disabled={parallelDialing || !deviceReady}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-40"
                  >
                    {parallelDialing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneForwarded className="w-4 h-4" />}
                    {parallelDialing ? "Dialing..." : `Dial Next 3`}
                  </button>
                )}
                {parallelCallActive && (
                  <button
                    onClick={endParallelCall}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                  >
                    <PhoneOff className="w-4 h-4" /> Hang Up
                  </button>
                )}
              </div>

              {parallelSlots.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                  <PhoneCall className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Add contacts and click "Dial Next 3"</p>
                  <p className="text-sm text-gray-400 mt-1">All 3 numbers ring simultaneously — first to answer connects to you</p>
                  {!deviceReady && (
                    <button onClick={initTwilioDevice} disabled={deviceLoading} className="mt-4 px-4 py-2 bg-lofty-600 text-white text-sm rounded-lg hover:bg-lofty-700 disabled:opacity-60">
                      {deviceLoading ? "Initializing..." : "Initialize Phone First"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {parallelSlots.map((slot, i) => (
                    <div key={slot.contactId} className={cn(
                      "p-4 rounded-2xl border-2 transition-all",
                      slot.status === "connected" ? "border-green-400 bg-green-50" :
                      slot.status === "ringing" ? "border-amber-300 bg-amber-50" :
                      slot.status === "no-answer" ? "border-red-200 bg-red-50" :
                      slot.status === "voicemail" ? "border-purple-200 bg-purple-50" :
                      "border-gray-200 bg-gray-50"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2",
                        slot.status === "connected" ? "bg-green-200 text-green-800" :
                        slot.status === "ringing" ? "bg-amber-200 text-amber-800 animate-pulse" :
                        "bg-gray-200 text-gray-600"
                      )}>
                        {slot.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-center text-gray-900 truncate">{slot.name}</p>
                      <p className="text-xs text-gray-500 text-center">{formatPhone(slot.phone)}</p>
                      <div className="mt-2 flex items-center justify-center gap-1">
                        {slot.status === "ringing" && <><div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} /><span className="text-xs text-amber-700 font-medium">Ringing...</span></>}
                        {slot.status === "connected" && <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /><span className="text-xs text-green-700 font-semibold">Connected</span></>}
                        {slot.status === "no-answer" && <><PhoneMissed className="w-3.5 h-3.5 text-red-500" /><span className="text-xs text-red-600">No Answer</span></>}
                        {slot.status === "voicemail" && <><Voicemail className="w-3.5 h-3.5 text-purple-500" /><span className="text-xs text-purple-600">Voicemail</span></>}
                        {slot.status === "cancelled" && <><XCircle className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-500">Cancelled</span></>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact card — appears when answer detected */}
            {activeContact && (
              <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-lofty-700">
                      {activeContact.firstName?.[0]}{activeContact.lastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900">{activeContact.firstName} {activeContact.lastName}</h2>
                      {activeContact.status && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          activeContact.status === "HOT_LEAD" ? "bg-red-100 text-red-700" :
                          activeContact.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {activeContact.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                      {activeContact.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{formatPhone(activeContact.phone)}</span>}
                      {activeContact.phone2 && <span className="flex items-center gap-1.5 text-gray-400"><Phone className="w-3.5 h-3.5" />{formatPhone(activeContact.phone2)} (alt)</span>}
                      {activeContact.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{activeContact.email}</span>}
                      {activeContact.source && <span className="flex items-center gap-1.5 text-gray-400"><MapPin className="w-3.5 h-3.5" />Source: {activeContact.source}</span>}
                    </div>
                    {activeContact.lastContacted && (
                      <p className="text-xs text-gray-400 mt-1.5">Last contacted: {new Date(activeContact.lastContacted).toLocaleDateString()}</p>
                    )}
                  </div>
                  <a
                    href={`/contacts/${activeContact.id}`}
                    target="_blank"
                    className="text-xs text-lofty-600 hover:underline flex-shrink-0"
                  >
                    Full Profile →
                  </a>
                </div>
              </div>
            )}

            {/* Notes + AI Analysis — shown when call is active or just ended */}
            {(parallelCallActive || (activeContact && parallelSlots.some(s => s.status === "connected"))) && (
              <div className="bg-white rounded-2xl border p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-lofty-600" /> Call Notes
                </h3>

                {/* Disposition */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {DISPOSITIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setParallelDisposition(d.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                        parallelDisposition === d.value ? "bg-lofty-600 text-white border-lofty-600" : "border-gray-200 text-gray-600 hover:border-lofty-300"
                      )}
                    >
                      <d.icon className="w-3 h-3" />{d.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={parallelNotes}
                  onChange={e => setParallelNotes(e.target.value)}
                  placeholder="Take notes during the call... (e.g. 'Looking for 3BR condo in Brickell, budget $400k-$500k, pre-construction ok, call back Thursday')"
                  rows={4}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400 resize-none"
                />

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={analyzeNotes}
                    disabled={analyzingNotes || !parallelNotes.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-semibold disabled:opacity-40"
                  >
                    {analyzingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {analyzingNotes ? "Analyzing..." : "Analyze Notes (AI)"}
                  </button>
                  <span className="text-xs text-gray-400">AI extracts property criteria and creates follow-up tasks automatically</span>
                </div>
              </div>
            )}

            {/* AI Analysis results */}
            {aiAnalysis && (
              <div className="bg-lofty-50 rounded-2xl border border-lofty-200 p-5">
                <h3 className="font-semibold text-lofty-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-lofty-600" /> AI Analysis
                </h3>
                <p className="text-sm text-gray-700 mb-4">{aiAnalysis.summary}</p>

                {aiAnalysis.tasks?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tasks Created Automatically</p>
                    <div className="space-y-2">
                      {aiAnalysis.tasks.map((task: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{task.title}</p>
                            {task.dueDate && <p className="text-xs text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                          </div>
                          <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                            task.priority === "HIGH" ? "bg-red-100 text-red-700" :
                            task.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                          )}>{task.priority}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.mlsSearch && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">MLS Search Criteria Saved</p>
                    <div className="bg-white rounded-lg p-3 border flex flex-wrap gap-2">
                      {Object.entries(aiAnalysis.mlsSearch).filter(([, v]) => v != null).map(([k, v]) => (
                        <span key={k} className="text-xs bg-lofty-100 text-lofty-700 px-2 py-1 rounded-full font-medium">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-amber-600 mt-2">⏳ Auto-search enabled once IDX API connection is approved by Miami MLS</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STANDARD MODE ─────────────────────────────────────────────────────── */}
      {dialMode === "standard" && (

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
                    <div className="text-xs text-gray-500">{formatPhone(c.phone || "")}</div>
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
                  <h2 className="text-xl font-bold text-gray-900">
                    {currentContact.firstName} {currentContact.lastName}
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
                </div>

                {/* Call controls */}
                <div className="flex items-center gap-3">
                  {callStatus === "idle" || callStatus === "ended" ? (
                    <button
                      onClick={() => dialContact(currentContact)}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-lg shadow-sm transition-colors"
                    >
                      <Phone className="w-5 h-5" /> Call
                    </button>
                  ) : callStatus === "calling" ? (
                    <button
                      onClick={() => { stopTimer(); setCallStatus("idle") }}
                      className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-semibold text-lg shadow-sm animate-pulse"
                    >
                      <PhoneOff className="w-5 h-5" /> Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => endCall("COMPLETED")}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-lg shadow-sm"
                    >
                      <PhoneOff className="w-5 h-5" /> Hang Up
                    </button>
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
              <span className="text-sm text-lofty-700">
                {sessionRunning ? "Auto-dialing enabled — next call starts automatically" : "Manual mode — click Call to dial each contact"}
              </span>
            </div>
          )}

          {/* Disposition + Notes (shown when call is active or ended) */}
          {(callStatus === "connected" || callStatus === "ended") && (
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
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Call Notes</label>
                <textarea
                  value={callNotes}
                  onChange={e => setCallNotes(e.target.value)}
                  placeholder="Add notes about this call..."
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500 resize-none"
                />
              </div>
              {callStatus === "ended" && (
                <div className="flex items-center justify-between mt-3">
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
      )} {/* end standard mode */}
    </div>
  )
}
