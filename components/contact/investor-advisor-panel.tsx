"use client"

import { useState, useRef, useEffect } from "react"
import { TrendingUp, Send, Loader2, ChevronDown, ChevronUp, Calculator, MapPin, Building2, AlertTriangle, Check, NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
  saved?: boolean
}

const QUICK_PROMPTS = [
  { icon: Calculator, label: "ROI Airbnb", prompt: "Con base en el presupuesto y la zona de interés de este lead, calcula el ROI estimado de un condo como Airbnb. Incluye condo fees, property tax, management y ocupación esperada, paso a paso." },
  { icon: MapPin, label: "Comparar zonas", prompt: "Compara 3 vecindarios de Miami adecuados para este lead según su presupuesto y objetivo. Incluye precio por sqft, potencial Airbnb y apreciación esperada, en una tabla." },
  { icon: Building2, label: "Proyecto ideal", prompt: "¿Qué proyecto(s) del portafolio de Catherine encaja(n) mejor con este lead? Explica por qué, con precio, entrega, down payment y ROI estimado." },
  { icon: AlertTriangle, label: "Riesgos", prompt: "¿Qué riesgos debo explicarle a este lead antes de invertir en preconstrucción en Miami? Sé concreto." },
]

interface Props {
  contactId: string
  contactName: string
  onNoteSaved?: (note: any) => void
}

export default function InvestorAdvisorPanel({ contactId, contactName, onNoteSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, open])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    const newMessages = [...messages, { role: "user" as const, content: content.trim() }]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/investment-advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, contactId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (String(err.error || "").includes("OPENAI_API_KEY")) setHasApiKey(false)
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.error || "no se pudo conectar"}` }])
        return
      }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let acc = ""
      setMessages(prev => [...prev, { role: "assistant", content: "" }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content || ""
            if (delta) {
              acc += delta
              setMessages(prev => { const next = [...prev]; next[next.length - 1] = { role: "assistant", content: acc }; return next })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intenta de nuevo." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function saveToNotes(index: number) {
    const msg = messages[index]
    if (!msg || msg.role !== "assistant" || !msg.content.trim()) return
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `🔎 Asesor de Inversión:\n\n${msg.content}` }),
      })
      if (!res.ok) return
      const note = await res.json()
      setMessages(prev => { const next = [...prev]; next[index] = { ...next[index], saved: true }; return next })
      onNoteSaved?.(note)
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50/50 transition-colors"
      >
        <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Asesor de Inversión</p>
          <p className="text-xs text-gray-500 truncate">Análisis en vivo para {contactName || "este lead"} · ROI, zonas, proyectos</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-emerald-100">
          {!hasApiKey && (
            <div className="p-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-800">Falta <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> en Railway para activar el asesor.</p>
            </div>
          )}

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 p-3 border-b border-gray-100">
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-left rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-xs text-gray-600 transition-colors disabled:opacity-40"
              >
                <qp.icon className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                {qp.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">
                Pregunta sobre ROI, zonas, financiamiento o proyectos. El asesor ya conoce el presupuesto y la zona de interés de {contactName || "este lead"}.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", msg.role === "assistant" ? "bg-emerald-100" : "bg-gray-200")}>
                  {msg.role === "assistant" ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <span className="text-[10px] font-bold text-gray-600">Tú</span>}
                </div>
                <div className="max-w-[85%]">
                  <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", msg.role === "assistant" ? "bg-gray-50 border border-gray-200 text-gray-800" : "bg-emerald-600 text-white")}>
                    {msg.content === "" && msg.role === "assistant" ? (
                      <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="text-xs">Analizando…</span></div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.content && !(msg.content === "") && (
                    <button
                      onClick={() => saveToNotes(i)}
                      disabled={msg.saved}
                      className={cn("mt-1 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors", msg.saved ? "text-emerald-600" : "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200")}
                    >
                      {msg.saved ? <><Check className="w-3 h-3" /> Guardado en notas</> : <><NotebookPen className="w-3 h-3" /> Guardar en notas</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta al asesor…"
              rows={1}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
              style={{ maxHeight: "100px" }}
              onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 100) + "px" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center disabled:opacity-40 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
