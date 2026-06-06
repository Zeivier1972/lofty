"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, Bot, User, Phone, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  fromClient: boolean
  content: string
  createdAt: string
  isRead: boolean
}

interface Props {
  contactId: string
  contactName: string
  messages: Message[]
}

export default function PortalMessagesClient({ contactId, contactName, messages: initial }: Props) {
  const [messages, setMessages] = useState<Message[]>(initial)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)

    // Optimistic
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      fromClient: true,
      content: text,
      createdAt: new Date().toISOString(),
      isRead: false,
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      // Replace optimistic with real + append AI reply
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimistic.id),
        data.message,
        ...(data.reply ? [data.reply] : []),
      ])
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  const grouped = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    const last = acc[acc.length - 1]
    if (last && last.date === date) { last.msgs.push(msg) }
    else acc.push({ date, msgs: [msg] })
    return acc
  }, [])

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* Chat header */}
      <div className="bg-white border-b px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-lofty-700 text-sm">C</span>
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900">Catherine — Your Agent</div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            Active · Typically replies within 1 hour
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
            <Bot className="w-3 h-3" />
            Alex AI active
          </div>
          <a href="tel:+15555555555" className="p-2 text-gray-400 hover:text-lofty-700 rounded-lg hover:bg-gray-50">
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-20 md:pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-lofty-100 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-lofty-600" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">Start a conversation</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Send a message to your agent or ask Alex (AI) any real estate question — in English or Spanish.
            </p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">{date}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              {msgs.map(msg => (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", msg.fromClient ? "justify-end" : "justify-start")}
                >
                  {!msg.fromClient && (
                    <div className="w-8 h-8 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-lofty-700" />
                    </div>
                  )}
                  <div className={cn("max-w-[75%]", msg.fromClient ? "items-end" : "items-start", "flex flex-col gap-1")}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.fromClient
                        ? "bg-lofty-600 text-white rounded-br-sm"
                        : "bg-white border text-gray-800 rounded-bl-sm"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {msg.fromClient && (
                    <div className="w-8 h-8 bg-lofty-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start gap-2.5">
            <div className="w-8 h-8 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-lofty-700" />
            </div>
            <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 pb-safe">
        <form onSubmit={sendMessage} className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
            placeholder="Message your agent... / Escribe un mensaje..."
            rows={1}
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lofty-500 transition-colors resize-none min-h-[44px] max-h-32"
            style={{ height: "auto" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-11 h-11 bg-lofty-600 text-white rounded-xl flex items-center justify-center hover:bg-lofty-700 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          AI assistant responds 24/7 · Agent follows up personally
        </p>
      </div>
    </div>
  )
}
