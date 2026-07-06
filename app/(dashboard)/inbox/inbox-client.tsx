"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, Phone, Search, Send, RefreshCw, Wifi, Smartphone, Paperclip, ExternalLink } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { AiAssistBar } from "@/components/ui/ai-assist-bar"
import { useSearchParams } from "next/navigation"

interface Thread {
  contactId: string
  contact: { id: string; firstName: string; lastName: string; phone: string | null; leadScore: number; facebookPsid?: string | null }
  lastMessage: string
  lastMessageAt: string
  lastDirection: string
  channel: "sms" | "whatsapp" | "facebook" | "portal"
  unread: boolean
}

interface Message {
  id: string
  body: string
  direction: "INBOUND" | "OUTBOUND"
  channel: "sms" | "whatsapp" | "facebook"
  createdAt: string
  status: string
}

interface ConversationData {
  contact: { id: string; firstName: string; lastName: string; phone: string | null; leadScore: number; status: string; facebookPsid?: string | null }
  messages: Message[]
}

const CHANNEL_TABS = [
  { id: "all", label: "Todos" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Messenger" },
  { id: "portal", label: "Portal" },
]

// Facebook Messenger badge icon (letter F in purple)
function MessengerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.914 1.467 5.52 3.761 7.22V22l3.44-1.888c.919.254 1.893.391 2.9.391 5.522 0 10-4.145 10-9.26C22 6.145 17.523 2 12 2zm1.008 12.458l-2.552-2.718-4.98 2.718 5.474-5.808 2.613 2.718 4.919-2.718-5.474 5.808z"/>
    </svg>
  )
}

export default function InboxClient() {
  const searchParams = useSearchParams()
  const [channel, setChannel] = useState(searchParams.get("channel") || "all")
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replyChannel, setReplyChannel] = useState<"sms" | "whatsapp" | "facebook">("sms")
  const [selectedTemplateSid, setSelectedTemplateSid] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [unreadSms, setUnreadSms] = useState(0)
  const [unreadWa, setUnreadWa] = useState(0)
  const [unreadFb, setUnreadFb] = useState(0)
  const [unreadPortal, setUnreadPortal] = useState(0)
  const [inboxMediaUrl, setInboxMediaUrl] = useState("")
  const [inboxUploading, setInboxUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox?channel=${channel}`)
      const data = await res.json()
      setThreads(data.threads || [])
      setUnreadSms(data.unreadSms || 0)
      setUnreadWa(data.unreadWa || 0)
      setUnreadFb(data.unreadFb || 0)
      setUnreadPortal(data.unreadPortal || 0)
    } catch {
      toast({ title: "Error cargando mensajes", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [channel, toast])

  const fetchConversation = useCallback(async (contactId: string) => {
    try {
      const res = await fetch(`/api/inbox/${contactId}`)
      const data = await res.json()
      setConversation(data)
      // Opening the conversation marked it read server-side — update the list/badges
      setThreads(prev => prev.map(t => t.contactId === contactId ? { ...t, unread: false } : t))
      fetchThreads()
    } catch {
      toast({ title: "Error cargando conversación", variant: "destructive" })
    }
  }, [toast, fetchThreads])

  const markAllRead = useCallback(async () => {
    await fetch("/api/inbox", { method: "PATCH" }).catch(() => {})
    setThreads(prev => prev.map(t => ({ ...t, unread: false })))
    setUnreadSms(0); setUnreadWa(0); setUnreadFb(0); setUnreadPortal(0)
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => { fetchThreads() }, [fetchThreads])
  useEffect(() => {
    if (selectedContact) fetchConversation(selectedContact)
  }, [selectedContact, fetchConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation?.messages])

  const handleInboxFileUpload = async (file: File) => {
    setInboxUploading(true)
    try {
      const form = new FormData(); form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInboxMediaUrl(data.url)
      toast({ title: "✅ Archivo subido", description: "Listo para enviar" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo subir", variant: "destructive" })
    } finally {
      setInboxUploading(false)
    }
  }

  const handleSend = async () => {
    if (!replyText.trim() || !selectedContact || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/inbox/${selectedContact}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText,
          channel: replyChannel,
          templateSid: replyChannel === "whatsapp" ? selectedTemplateSid : undefined,
          mediaUrl: inboxMediaUrl || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Error enviando mensaje", description: data.error || "Intenta de nuevo", variant: "destructive" })
        return
      }
      setReplyText("")
      setSelectedTemplateSid(null)
      setInboxMediaUrl("")
      await fetchConversation(selectedContact)
      await fetchThreads()
    } catch {
      toast({ title: "Error enviando mensaje", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const filteredThreads = threads.filter(t => {
    const name = `${t.contact.firstName} ${t.contact.lastName}`.toLowerCase()
    return name.includes(search.toLowerCase()) || t.contact.phone?.includes(search)
  })

  const formatTime = (d: string) => {
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: es }) } catch { return "" }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Left: Thread List */}
      <div className="w-80 flex flex-col border-r border-gray-200 flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 text-lg">Bandeja Unificada</h1>
            <button onClick={fetchThreads} className="p-1 hover:bg-gray-100 rounded" title="Actualizar">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            {(unreadSms + unreadWa + unreadFb + unreadPortal) > 0 && (
              <button
                onClick={markAllRead}
                className="ml-auto text-xs text-lofty-600 hover:text-lofty-800 hover:underline whitespace-nowrap"
                title="Marcar todos los mensajes como leídos"
              >
                ✓ Marcar todo leído
              </button>
            )}
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar contacto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex gap-1">
            {CHANNEL_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setChannel(tab.id)}
                className={cn(
                  "flex-1 text-xs py-1 rounded font-medium transition-colors",
                  channel === tab.id ? "bg-lofty-600 text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
                {tab.id === "sms" && unreadSms > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadSms}</span>
                )}
                {tab.id === "whatsapp" && unreadWa > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadWa}</span>
                )}
                {tab.id === "facebook" && unreadFb > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadFb}</span>
                )}
                {tab.id === "portal" && unreadPortal > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadPortal}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin conversaciones</p>
            </div>
          ) : (
            filteredThreads.map(thread => (
              thread.channel === "portal" ? (
                <a
                  key={thread.contactId}
                  href={`/contacts/${thread.contactId}?tab=portal`}
                  className="block w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-bold">
                          {getInitials(`${thread.contact.firstName} ${thread.contact.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-2 h-2 text-white" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium truncate", thread.unread ? "text-gray-900 font-bold" : "text-gray-700")}>
                          {thread.contact.firstName} {thread.contact.lastName}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{formatTime(thread.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs truncate mt-0.5 text-gray-700">{thread.lastMessage}</p>
                      <p className="text-[10px] text-purple-500 mt-0.5 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" /> Ver en perfil del contacto
                      </p>
                    </div>
                    {thread.unread && (
                      <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </a>
              ) : (
              <button
                key={thread.contactId}
                onClick={() => {
                  setSelectedContact(thread.contactId)
                  setReplyChannel(thread.channel as "sms" | "whatsapp" | "facebook")
                }}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  selectedContact === thread.contactId && "bg-lofty-50 border-r-2 border-r-lofty-600"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xs font-bold">
                        {getInitials(`${thread.contact.firstName} ${thread.contact.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    {thread.channel === "whatsapp" ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                        <Wifi className="w-2 h-2 text-white" />
                      </span>
                    ) : thread.channel === "facebook" ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-600 rounded-full flex items-center justify-center">
                        <MessengerIcon className="w-2.5 h-2.5 text-white" />
                      </span>
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Smartphone className="w-2 h-2 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-medium truncate", thread.unread && thread.lastDirection === "INBOUND" ? "text-gray-900 font-bold" : "text-gray-700")}>
                        {thread.contact.firstName} {thread.contact.lastName}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{formatTime(thread.lastMessageAt)}</span>
                    </div>
                    <p className={cn("text-xs truncate mt-0.5", thread.lastDirection === "INBOUND" ? "text-gray-700" : "text-gray-400")}>
                      {thread.lastDirection === "OUTBOUND" && <span className="text-gray-400">Tú: </span>}
                      {thread.lastMessage}
                    </p>
                  </div>
                  {thread.unread && thread.lastDirection === "INBOUND" && (
                    <span className="w-2 h-2 bg-lofty-600 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
              )
            ))
          )}
        </div>
      </div>

      {/* Right: Conversation */}
      <div className="flex-1 flex flex-col">
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-300">
            <MessageSquare className="w-16 h-16" />
            <p className="text-lg font-medium">Selecciona una conversación</p>
            <p className="text-sm">SMS, WhatsApp, Messenger y Portal en un solo lugar</p>
          </div>
        ) : (
          <>
            {conversation?.contact && (
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-lofty-100 text-lofty-700 text-sm font-bold">
                      {getInitials(`${conversation.contact.firstName} ${conversation.contact.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {conversation.contact.firstName} {conversation.contact.lastName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {conversation.contact.facebookPsid ? "📘 Facebook Messenger" : conversation.contact.phone}
                      {" · "}Score: {conversation.contact.leadScore}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/contacts/${conversation.contact.id}`} className="text-xs text-lofty-600 hover:underline">Ver perfil</a>
                  <button className="p-2 hover:bg-gray-100 rounded-full">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
              {conversation?.messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                  <div className="max-w-[70%]">
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.direction === "OUTBOUND"
                        ? "bg-lofty-600 text-white rounded-br-sm"
                        : "bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100"
                    )}>
                      {msg.body}
                    </div>
                    <div className={cn("flex items-center gap-1 mt-0.5 text-[10px] text-gray-400",
                      msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                    )}>
                      <span>{new Date(msg.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                      {msg.channel === "whatsapp" ? (
                        <span className="text-green-500">WhatsApp</span>
                      ) : msg.channel === "facebook" ? (
                        <span className="text-purple-500">Messenger</span>
                      ) : (
                        <span className="text-blue-400">SMS</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              {/* Channel selector */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Enviar via:</span>
                {(["sms", "whatsapp", "facebook"] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => { setReplyChannel(ch); setSelectedTemplateSid(null); setReplyText("") }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
                      replyChannel === ch
                        ? ch === "whatsapp" ? "bg-green-500 text-white"
                          : ch === "facebook" ? "bg-purple-600 text-white"
                          : "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                    disabled={ch === "facebook" && !conversation?.contact.facebookPsid}
                  >
                    {ch === "whatsapp" ? "WhatsApp" : ch === "facebook" ? "Messenger" : "SMS"}
                  </button>
                ))}
              </div>

              {/* WhatsApp template selector */}
              {replyChannel === "whatsapp" && (() => {
                const phone = conversation?.contact.phone || ""
                const isUS = phone.startsWith("+1") || (phone.replace(/\D/g, "").length === 10 && !phone.startsWith("+"))
                if (isUS) {
                  return (
                    <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Número de EE.UU. — Plantillas bloqueadas</p>
                      <p className="text-[11px] text-amber-700 leading-snug">
                        Desde abril 2025, Meta bloquea plantillas de Marketing a números +1 (EE.UU.).
                        Usa <strong>SMS</strong> para contactar a este lead.
                      </p>
                      <button
                        onClick={() => { setReplyChannel("sms"); setSelectedTemplateSid(null); setReplyText("") }}
                        className="mt-2 text-xs px-3 py-1 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 transition-colors"
                      >
                        Cambiar a SMS
                      </button>
                    </div>
                  )
                }
                return (
                  <div className="mb-2 p-2.5 bg-green-50 border border-green-100 rounded-xl">
                    <p className="text-[10px] text-green-700 font-semibold mb-1.5">PLANTILLAS APROBADAS</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedTemplateSid("HXc53bdda85fa30d72254fbf79b8278ae7")
                          setReplyText(`Hola ${conversation?.contact.firstName}, Catherine Gomez tiene nuevas propiedades disponibles en Miami que podrían interesarte. ¿Te gustaría recibir más información? Responde SÍ y te contactamos.`)
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border font-medium transition-all",
                          selectedTemplateSid === "HXc53bdda85fa30d72254fbf79b8278ae7"
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-green-700 border-green-300 hover:bg-green-100"
                        )}
                      >
                        ✅ Re-enganche
                      </button>
                      <button
                        onClick={() => { setSelectedTemplateSid(null); setReplyText("") }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border font-medium transition-all",
                          !selectedTemplateSid
                            ? "bg-gray-500 text-white border-gray-500"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        Libre (solo si contestó antes)
                      </button>
                    </div>
                  </div>
                )
              })()}

              {replyChannel === "facebook" && !conversation?.contact.facebookPsid && (
                <div className="mb-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-xs text-purple-800">Este contacto aún no ha enviado un DM desde Facebook. Cuando te escriban, aparecerán aquí automáticamente.</p>
                </div>
              )}

              {inboxMediaUrl && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700 mb-2">
                  📎 <span className="truncate flex-1">{inboxMediaUrl}</span>
                  <button onClick={() => setInboxMediaUrl("")} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                {replyChannel !== "facebook" && (
                  <label className={cn("flex-shrink-0 p-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors", inboxUploading && "opacity-50 pointer-events-none")}>
                    <input type="file" accept="image/*,video/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handleInboxFileUpload(e.target.files[0])} />
                    <Paperclip className="w-4 h-4 text-gray-400" />
                  </label>
                )}
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={replyChannel === "facebook" ? "Mensaje de Messenger... (Enter para enviar)" : "Escribe un mensaje... (Enter para enviar)"}
                  rows={2}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className={cn(
                    "self-end px-4",
                    replyChannel === "facebook" ? "bg-purple-600 hover:bg-purple-700" : "bg-lofty-600 hover:bg-lofty-700"
                  )}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {selectedContact && (
                <AiAssistBar contactId={selectedContact} draft={replyText} onApply={setReplyText} className="mt-1" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
