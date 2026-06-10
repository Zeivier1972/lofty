"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Sparkles, Loader2, ChevronDown, RotateCcw, Plus } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

const QUICK_PROMPTS = [
  "Who should I call today?",
  "Show me cold leads",
  "What's overdue?",
  "Upcoming appointments",
  "Pipeline summary",
  "Hot leads this week",
  "Any transactions closing soon?",
  "Draft a follow-up for my hottest lead",
]

function renderMarkdown(text: string) {
  // Bold **text**
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  // Bullet lists
  html = html.replace(/^[•·]\s(.+)$/gm, "<li>$1</li>")
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
  // Line breaks
  html = html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")
  return `<p>${html}</p>`
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[#c9a84c]" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[#1a3a5c] text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <div
            className="prose prose-sm max-w-none prose-strong:text-[#1a3a5c] prose-ul:my-1 prose-li:my-0"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
      </div>
    </div>
  )
}

function TypingIndicator({ thinking }: { thinking: boolean }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center mr-2 flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-[#c9a84c]" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        {thinking && <span className="text-xs text-gray-400 ml-1">Looking up CRM data...</span>}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [showAllPrompts, setShowAllPrompts] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: "user", content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      const reply: Message = {
        role: "assistant",
        content: data.content || "Sorry, I couldn't get a response. Please try again.",
      }
      setMessages(prev => [...prev, reply])
      if (!open) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Connection error — please check your network and try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const visiblePrompts = showAllPrompts ? QUICK_PROMPTS : QUICK_PROMPTS.slice(0, 5)

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ width: 400, maxWidth: "calc(100vw - 2rem)", height: 560 }}
        >
          {/* Header */}
          <div className="bg-[#1a3a5c] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#c9a84c]/20 border-2 border-[#c9a84c]/50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#c9a84c]" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Aria</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <p className="text-[#c9a84c] text-xs">AI CRM Assistant · Live data</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setShowAllPrompts(false) }}
                  title="New conversation"
                  className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-2">
                <div className="w-14 h-14 rounded-full bg-[#1a3a5c]/8 flex items-center justify-center mb-3">
                  <Sparkles className="w-7 h-7 text-[#c9a84c]" />
                </div>
                <p className="font-bold text-gray-900 mb-1">Hi Catherine, I'm Aria</p>
                <p className="text-gray-500 text-xs mb-5 leading-relaxed max-w-[260px]">
                  Your AI CRM assistant. I have full access to your leads, messages, tasks, transactions, and market data — in real time.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {visiblePrompts.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-xs px-3 py-1.5 bg-[#1a3a5c]/8 hover:bg-[#1a3a5c]/15 text-[#1a3a5c] rounded-full border border-[#1a3a5c]/20 transition-colors font-medium"
                    >
                      {p}
                    </button>
                  ))}
                  {!showAllPrompts && (
                    <button
                      onClick={() => setShowAllPrompts(true)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full border border-gray-200 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> more
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                {loading && <TypingIndicator thinking={messages.length > 0} />}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Quick chips (when in conversation) */}
          {messages.length > 0 && !loading && (
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto flex-shrink-0 border-t border-gray-50" style={{ scrollbarWidth: "none" }}>
              {QUICK_PROMPTS.slice(0, 4).map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full whitespace-nowrap transition-colors flex-shrink-0"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-[#1a3a5c]/40 px-3 py-2 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your CRM..."
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 max-h-28 disabled:opacity-50"
                style={{ minHeight: "20px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-7 h-7 bg-[#1a3a5c] text-white rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#c9a84c] transition-colors"
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
            <p className="text-center text-gray-400 text-[10px] mt-1.5">Shift+Enter for new line · Enter to send</p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Aria — AI CRM Assistant"
        className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          width: 52, height: 52,
          background: open ? "#c9a84c" : "#1a3a5c",
        }}
      >
        {open
          ? <X className="w-5 h-5 text-white" />
          : <Sparkles className="w-5 h-5 text-[#c9a84c]" />
        }
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>
    </>
  )
}
