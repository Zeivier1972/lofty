"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, Phone, Search, Send, RefreshCw, Wifi, Smartphone } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { AiAssistBar } from "@/components/ui/ai-assist-bar"

interface Thread {
  contactId: string
  contact: { id: string; firstName: string; lastName: string; phone: string | null; leadScore: number }
  lastMessage: string
  lastMessageAt: string
  lastDirection: string
  channel: "sms" | "whatsapp"
  unread: boolean
}

interface Message {
  id: string
  body: string
  direction: "INBOUND" | "OUTBOUND"
  channel: "sms" | "whatsapp"
  createdAt: string
  status: string
}

interface ConversationData {
  contact: { id: string; firstName: string; lastName: string; phone: string | null; leadScore: number; status: string }
  messages: Message[]
}

const CHANNEL_TABS = [
  { id: "all", label: "Todos" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
]

export default function InboxClient() {
  const [channel, setChannel] = useState("all")
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replyChannel, setReplyChannel] = useState<"sms" | "whatsapp">("sms")
  const [selectedTemplateSid, setSelectedTemplateSid] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [unreadSms, setUnreadSms] = useState(0)
  const [unreadWa, setUnreadWa] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox?channel=${channel}`)
      const data = await res.json()
      setThreads(data.threads || [])
      setUnreadSms(data.unreadSms || 0)
      setUnreadWa(data.unreadWa || 0)
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
    } catch {
      toast({ title: "Error cargando conversación", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => { fetchThreads() }, [fetchThreads])
  useEffect(() => {
    if (selectedContact) fetchConversation(selectedContact)
  }, [selectedContact, fetchConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation?.messages])

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
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Error enviando mensaje", description: data.error || "Intenta de nuevo", variant: "destructive" })
        return
      }
      setReplyText("")
      setSelectedTemplateSid(null)
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
    try {
      return formatDistanceToNow(new Date(d), { addSuffix: true, locale: es })
    } catch { return "" }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Left: Thread List */}
      <div className="w-80 flex flex-col border-r border-gray-200 flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 text-lg">Bandeja Unificada</h1>
            <button onClick={fetchThreads} className="p-1 hover:bg-gray-100 rounded">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {/* Channel tabs */}
          <div className="flex gap-1">
            {CHANNEL_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setChannel(tab.id)}
                className={cn(
                  "flex-1 text-xs py-1 rounded font-medium transition-colors",
                  channel === tab.id
                    ? "bg-lofty-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
                {tab.id === "sms" && unreadSms > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadSms}</span>
                )}
                {tab.id === "whatsapp" && unreadWa > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{unreadWa}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
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
              <button
                key={thread.contactId}
                onClick={() => {
                  setSelectedContact(thread.contactId)
                  setReplyChannel(thread.channel === "whatsapp" ? "whatsapp" : "sms")
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
            <p className="text-sm">Todos tus SMS y WhatsApp en un solo lugar</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
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
                    <p className="text-xs text-gray-400">{conversation.contact.phone} · Score: {conversation.contact.leadScore}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/contacts/${conversation.contact.id}`} className="text-xs text-lofty-600 hover:underline">
                    Ver perfil
                  </a>
                  <button className="p-2 hover:bg-gray-100 rounded-full">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
              {conversation?.messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.direction === "OUTBOUND" ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-[70%]">
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                        msg.direction === "OUTBOUND"
                          ? "bg-lofty-600 text-white rounded-br-sm"
                          : "bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100"
                      )}
                    >
                      {msg.body}
                    </div>
                    <div className={cn("flex items-center gap-1 mt-0.5 text-[10px] text-gray-400",
                      msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                    )}>
                      <span>{new Date(msg.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                      {msg.channel === "whatsapp" ? (
                        <span className="text-green-500">WhatsApp</span>
                      ) : (
                        <span className="text-blue-400">SMS</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              {/* Channel selector */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Enviar via:</span>
                {(["sms", "whatsapp"] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => { setReplyChannel(ch); setSelectedTemplateSid(null); setReplyText("") }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
                      replyChannel === ch
                        ? ch === "whatsapp" ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {ch === "whatsapp" ? "WhatsApp" : "SMS"}
                  </button>
                ))}
              </div>

              {/* WhatsApp template selector */}
              {replyChannel === "whatsapp" && (
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
              )}
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="Escribe un mensaje... (Enter para enviar)"
                  rows={2}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className="bg-lofty-600 hover:bg-lofty-700 self-end px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {selectedContact && (
                <AiAssistBar
                  contactId={selectedContact}
                  draft={replyText}
                  onApply={setReplyText}
                  className="mt-1"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
