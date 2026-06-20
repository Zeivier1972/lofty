"use client"

import { useState, useRef, useEffect } from "react"
import {
  TrendingUp, Send, Plus, User, Bot, Loader2,
  ChevronDown, X, Sparkles, Calculator, MapPin, Building2, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Contact {
  id: string
  firstName: string
  lastName: string
  status: string
  buyerBudgetMin?: number | null
  buyerBudgetMax?: number | null
  buyerLocation?: string | null
  buyerPurpose?: string | null
}

interface Message {
  role: "user" | "assistant"
  content: string
}

const QUICK_PROMPTS = [
  { icon: Calculator, label: "Calcular ROI Airbnb", prompt: "Calcula el ROI estimado para un condo de $500,000 en Brickell usado como Airbnb. Incluye condo fees, property tax, management fee y ocupación esperada." },
  { icon: MapPin, label: "Comparar vecindarios", prompt: "Compara Brickell, Edgewater y Doral para un inversionista colombiano que quiere máximo retorno. Incluye precio por sqft, potencial Airbnb y apreciación esperada." },
  { icon: Building2, label: "Due diligence proyecto", prompt: "¿Cuáles son los puntos clave de due diligence al comprar un condo en preconstrucción en Miami? Incluye lo que debo revisar del desarrollador, el contrato y el escrow." },
  { icon: AlertTriangle, label: "Riesgos inversión", prompt: "¿Cuáles son los principales riesgos de invertir en preconstrucción en Miami en 2025? ¿Qué debe saber un colombiano antes de comprar?" },
]

interface Props {
  contacts: Contact[]
}

export default function AdvisorClient({ contacts }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactSearch, setContactSearch] = useState("")
  const [hasApiKey, setHasApiKey] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const filteredContacts = contacts.filter(c => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase()
    return name.includes(contactSearch.toLowerCase())
  })

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    const userMsg: Message = { role: "user", content: content.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/investment-advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          contactId: selectedContact?.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        if (err.error?.includes("OPENAI_API_KEY")) setHasApiKey(false)
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.error}` }])
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""
      setMessages(prev => [...prev, { role: "assistant", content: "" }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ""
            if (delta) {
              assistantContent += delta
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: assistantContent }
                return next
              })
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intenta de nuevo." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function startNewChat() {
    setMessages([])
    setSelectedContact(null)
    setInput("")
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left sidebar */}
      <div className="w-72 flex-shrink-0 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Investment Advisor</h2>
              <p className="text-xs text-gray-500">Miami AI Analysis</p>
            </div>
          </div>
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Conversation
          </button>
        </div>

        {/* Contact context */}
        <div className="p-4 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lead Context</p>
          {selectedContact ? (
            <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {selectedContact.firstName[0]}{selectedContact.lastName?.[0] || ""}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-900 truncate">
                  {selectedContact.firstName} {selectedContact.lastName}
                </p>
                {selectedContact.buyerLocation && (
                  <p className="text-xs text-emerald-700 truncate">{selectedContact.buyerLocation}</p>
                )}
              </div>
              <button onClick={() => setSelectedContact(null)} className="p-1 text-emerald-500 hover:text-emerald-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowContactPicker(!showContactPicker)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Load lead profile…</span>
                <ChevronDown className="w-3.5 h-3.5 ml-auto" />
              </button>
              {showContactPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      placeholder="Search leads…"
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredContacts.slice(0, 20).map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedContact(c); setShowContactPicker(false); setContactSearch("") }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs"
                      >
                        <p className="font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                        {c.buyerLocation && <p className="text-gray-500">{c.buyerLocation}</p>}
                      </button>
                    ))}
                    {filteredContacts.length === 0 && (
                      <p className="text-xs text-gray-400 p-3 text-center">No leads with investment profile</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedContact && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Lead profile loaded as context
            </p>
          )}
        </div>

        {/* Quick prompts */}
        <div className="p-4 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Analysis</p>
          <div className="space-y-1.5">
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={loading}
                className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-xs text-gray-600 transition-colors disabled:opacity-40"
              >
                <qp.icon className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {!hasApiKey && (
          <div className="p-4 border-t bg-amber-50">
            <p className="text-xs font-semibold text-amber-800 mb-1">Setup required</p>
            <p className="text-xs text-amber-700">Add <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> to Railway environment variables to enable the Investment Advisor.</p>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-lg font-bold text-gray-900">Investment Projects Advisor — Miami</h1>
          <p className="text-sm text-gray-500">Pre-construction · ROI analysis · Colombian investor strategy</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Investment Projects Advisor</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Ask me about pre-construction projects, ROI calculations, financing for foreign buyers, or select a lead from the left to analyze their investment profile.
              </p>
              <p className="text-xs text-gray-400 mt-3">Responds in Spanish or English based on your question</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-4", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === "assistant" ? "bg-emerald-100" : "bg-gray-200"
              )}>
                {msg.role === "assistant"
                  ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                  : <User className="w-4 h-4 text-gray-600" />
                }
              </div>
              <div className={cn(
                "max-w-2xl rounded-2xl px-5 py-3.5 text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-white border border-gray-200 text-gray-800 shadow-sm"
                  : "bg-emerald-600 text-white"
              )}>
                {msg.content === "" && msg.role === "assistant" ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Analyzing…</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t p-4">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all bg-white">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a project, ROI calculation, financing, or market analysis…"
                rows={1}
                className="w-full px-4 py-3 text-sm resize-none focus:outline-none rounded-xl bg-transparent"
                style={{ maxHeight: "120px" }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = "auto"
                  el.style.height = Math.min(el.scrollHeight, 120) + "px"
                }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
