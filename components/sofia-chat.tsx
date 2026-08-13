"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X, Send, Loader2, CalendarDays, Building2 } from "lucide-react"

// Routes where Sofía should NOT appear (agent dashboard, client portal, logins —
// those have their own tools). Everything else is public and gets the widget.
const HIDDEN_PREFIXES = ["/dashboard", "/portal", "/login", "/partner", "/lender", "/api"]

type Listing = { address: string; city: string; price: number | null; beds: number | null; baths: number | null; photo: string | null; url: string }
type Msg = { role: "user" | "assistant"; content: string; listings?: Listing[]; projectsUrl?: string | null }

function listingKeyFrom(path: string): string | null {
  const m = path.match(/^\/(?:homes|new-construction)\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function pageContextFrom(path: string): string {
  if (/^\/homes\/[^/]+/.test(path) || /^\/(site\/)?listing\//.test(path)) return "El visitante está viendo la ficha de una propiedad."
  if (path.startsWith("/new-construction")) return "El visitante está viendo proyectos de preconstrucción."
  if (path.startsWith("/comprar/")) return `El visitante busca propiedades en ${decodeURIComponent(path.split("/")[2] || "").replace(/-/g, " ")}.`
  if (path.startsWith("/homes") || path.startsWith("/search")) return "El visitante está buscando propiedades."
  if (path.startsWith("/guias")) return "El visitante está leyendo una guía de inversión."
  return "El visitante está explorando el sitio."
}

export default function SofiaChat() {
  const pathname = usePathname() || "/"
  const hidden = HIDDEN_PREFIXES.some(p => pathname.startsWith(p))

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [contactId, setContactId] = useState<string | null>(null)
  const [bookUrl, setBookUrl] = useState("https://www.catherinegomezrealtor.com/book")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Pick up a known lead id from the URL (?sofia= or ?lead=), e.g. from an email link.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const id = p.get("sofia") || p.get("lead")
      if (id) setContactId(id)
    } catch { /* noop */ }
  }, [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }) }, [messages, loading])

  function openChat() {
    setOpen(true)
    try { sessionStorage.setItem("sofia_seen", "1") } catch { /* noop */ }
    if (messages.length === 0) {
      setMessages([{ role: "assistant", content: "¡Hola! 👋 Soy Sofía, la asistente de Catherine Gómez. ¿Buscas invertir o vivir en Miami/Orlando? Cuéntame qué estás buscando y te ayudo — presupuesto, zonas, financiamiento para extranjeros, lo que sea. 🏙️" }])
    }
  }

  // Pop the chat open automatically the first time a visitor lands (once per
  // session, so it doesn't re-open on every page they browse).
  useEffect(() => {
    if (hidden) return
    let seen = false
    try { seen = !!sessionStorage.getItem("sofia_seen") } catch { /* noop */ }
    if (seen) return
    const t = setTimeout(() => openChat(), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: "user" as const, content: text }]
    setMessages(next)
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/site/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, contactId, pageContext: pageContextFrom(pathname), listingKey: listingKeyFrom(pathname) }),
      })
      const data = await res.json()
      if (data.contactId) setContactId(data.contactId)
      if (data.bookUrl) setBookUrl(data.bookUrl)
      setMessages(m => [...m, { role: "assistant", content: data.reply || "¿Puedes repetirlo?", listings: data.listings || [], projectsUrl: data.projectsUrl || null }])
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Disculpa, tuve un problema de conexión. ¿Puedes intentarlo otra vez?" }])
    } finally {
      setLoading(false)
    }
  }

  if (hidden) return null

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={openChat}
          aria-label="Chatear con Sofía"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[#12315c] px-5 py-3.5 text-white shadow-xl hover:bg-[#0b1f3a] transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Chatea con Sofía</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#12315c] to-[#1e40af] text-white px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">S</div>
              <div>
                <div className="font-bold text-sm leading-tight">Sofía</div>
                <div className="text-[11px] text-blue-100 leading-tight">Asistente de Catherine Gómez</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-[#12315c] text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                    {m.content}
                  </div>
                </div>
                {/* Resale listing cards */}
                {!!m.listings?.length && (
                  <div className="space-y-2">
                    {m.listings.map((l, j) => (
                      <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 rounded-xl bg-white border border-gray-200 p-2 hover:border-[#12315c] transition-colors">
                        {l.photo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={l.photo} alt={l.address} className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">🏠</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-[#12315c]">{l.price != null ? `$${Number(l.price).toLocaleString()}` : "Consultar"}</div>
                          <div className="text-xs text-gray-600 truncate">{l.address}{l.city ? `, ${l.city}` : ""}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{[l.beds != null ? `${l.beds} hab` : null, l.baths != null ? `${l.baths} baños` : null].filter(Boolean).join(" · ")}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {/* Pre-construction projects link */}
                {m.projectsUrl && (
                  <a href={m.projectsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#12315c] text-[#12315c] text-sm font-semibold py-2 hover:bg-blue-50">
                    <Building2 className="w-4 h-4" /> Ver proyectos de pre-construcción
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
              </div>
            )}
          </div>

          <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold py-2.5 hover:bg-emerald-700">
            <CalendarDays className="w-4 h-4" /> Agenda una llamada con Catherine
          </a>

          <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t border-gray-200 p-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu mensaje…"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#12315c]"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar" className="flex-shrink-0 w-10 h-10 rounded-full bg-[#12315c] text-white flex items-center justify-center hover:bg-[#0b1f3a] disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
