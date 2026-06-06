"use client"

import { useState, useCallback } from "react"
import {
  Phone, PhoneOff, PhoneMissed, PhoneCall, PhoneIncoming,
  Play, Pause, SkipForward, Plus, Trash2, Clock,
  CheckCircle2, XCircle, MessageSquare, Voicemail,
  BarChart3, Users, Target, TrendingUp,
  ChevronDown, ChevronUp, Search, User,
} from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"

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

interface Props {
  contacts: Contact[]
  sessions: DialerSession[]
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

export default function DialerClient({ contacts, sessions: initialSessions }: Props) {
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
    const session = await res.json()
    setSessions(prev => [session, ...prev])
    setActiveSession(session)
    return session
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Power Dialer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-contact calling session management</p>
        </div>
        <div className="flex items-center gap-3">
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
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-lofty-500"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredContacts.slice(0, 20).map(c => (
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
                  ))}
                  {filteredContacts.length === 0 && (
                    <p className="text-xs text-gray-500 p-3 text-center">No contacts found</p>
                  )}
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
    </div>
  )
}
