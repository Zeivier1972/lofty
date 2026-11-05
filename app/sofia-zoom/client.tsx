"use client"

/**
 * Sofía en Zoom — joins Catherine's meeting as "Sofía – Asistente de
 * Catherine" with the Zoom Meeting SDK (client view), listens to the chat
 * and answers through /api/zoom-sofia/answer.
 *
 * The SDK (6.10.0, ~14 MB) is loaded from Zoom's CDN (source.zoom.us, with
 * jsDelivr's mirror of the npm package as fallback) only when this page is
 * used, so it never weighs on the site build. Its UMD bundle expects a global
 * React and exposes window["@zoom/meetingsdk"].ZoomMtg (older builds: window.ZoomMtg).
 *
 * Behaviour:
 *  - messages from Sofía herself and from the host/co-hosts are ignored;
 *  - a message sent to everyone is answered to everyone; a private message
 *    to Sofía is answered privately;
 *  - "escalate" → a short public reply + a private note to every host;
 *  - one send at a time, ≥1.2 s apart (the SDK rate-limits chat to 1/s);
 *  - when Catherine ends the session (button, or the meeting ends) the
 *    attendees and all Q&A are saved to the CRM.
 * Works in Zoom MEETINGS; the SDK cannot post chat in Zoom Webinars.
 */

import { useEffect, useRef, useState } from "react"

type Project = { href: string; name: string; place: string }
type Item = { at: string; name: string; question: string; answer: string; action: "answer" | "escalate" | "skip" | "error" | "info" }

const SDK_VERSION = "6.10.0"
/** Each entry: Zoom's official CDN first, a mirror of the same file as fallback. */
const SCRIPTS: string[][] = [
  [`https://source.zoom.us/${SDK_VERSION}/lib/vendor/react.min.js`, "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"],
  [`https://source.zoom.us/${SDK_VERSION}/lib/vendor/react-dom.min.js`, "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"],
  [`https://source.zoom.us/${SDK_VERSION}/zoom-meeting-${SDK_VERSION}.min.js`, `https://cdn.jsdelivr.net/npm/@zoom/meetingsdk@${SDK_VERSION}/dist/client-view.umd.min.js`],
]
const BOT_NAME = "Sofía – Asistente de Catherine"
const BASE = "https://www.catherinegomezrealtor.com"

/** Load the first URL of the list that works. */
async function loadFirst(urls: string[]): Promise<void> {
  let last: unknown
  for (const u of urls) {
    try { await loadScript(u); return } catch (e) { last = e }
  }
  throw last
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement("script")
    s.src = src
    s.async = false
    s.onload = () => resolve()
    s.onerror = () => { s.remove(); reject(new Error(`No se pudo cargar ${src}`)) }
    document.head.appendChild(s)
  })
}

/** "https://us02web.zoom.us/j/84012345678?pwd=…" → "84012345678". */
function meetingNumberFrom(input: string): string {
  const m = input.match(/\/(?:j|w|s|wc\/join)\/(\d{9,12})/) || input.match(/(\d[\d\s-]{8,14}\d)/)
  return m ? m[1].replace(/\D/g, "") : ""
}

const pick = (...v: unknown[]) => v.find(x => typeof x === "string" && x.trim()) as string | undefined
const pickNum = (...v: unknown[]) => v.find(x => typeof x === "number") as number | undefined
const nowLabel = () => new Date().toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" })

export default function SofiaZoomClient({ projects, hostName }: { projects: Project[]; hostName: string }) {
  const [project, setProject] = useState(projects.find(p => p.href === "/parkside")?.href || projects[0]?.href || "")
  const [link, setLink] = useState("")
  const [passcode, setPasscode] = useState("")
  const [phase, setPhase] = useState<"setup" | "joining" | "live" | "ended">("setup")
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [answering, setAnswering] = useState(true)
  const [open, setOpen] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  const zoom = useRef<any>(null)
  const myId = useRef<number | null>(null)
  const people = useRef(new Map<number, { name: string; host: boolean }>())
  const everyone = useRef(new Set<string>())
  const recent = useRef<string[]>([])
  const qa = useRef<{ name: string; question: string; answer: string; action: string }[]>([])
  const queue = useRef<Promise<void>>(Promise.resolve())
  const lastSend = useRef(0)
  const answeringRef = useRef(true)
  const reported = useRef(false)
  const joined = useRef(false)
  const initStarted = useRef(false)

  const proj = projects.find(p => p.href === project)
  const bookUrl = project === "/parkside" ? `${BASE}/parkside/colombia` : `${BASE}${project}`

  useEffect(() => { answeringRef.current = answering }, [answering])

  const log = (it: Omit<Item, "at">) => setItems(prev => [{ ...it, at: nowLabel() }, ...prev].slice(0, 200))

  /** Send to everyone (no userId) or privately to one participant. Serialized + rate-limited. */
  const send = (message: string, userId?: number) => {
    queue.current = queue.current.then(async () => {
      const wait = 1200 - (Date.now() - lastSend.current)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      await new Promise<void>(resolve => {
        zoom.current?.sendChat({
          message: message.slice(0, 1000),
          ...(userId !== undefined ? { userId } : {}),
          success: () => resolve(),
          error: (e: unknown) => { console.error("[sofia-zoom] sendChat", e); resolve() },
        })
      })
      lastSend.current = Date.now()
    })
    return queue.current
  }

  const refreshPeople = () => {
    zoom.current?.getAttendeeslist({
      success: (res: any) => {
        const list: any[] = res?.result?.attendeesList || []
        for (const a of list) {
          const id = pickNum(a.userId)
          const name = pick(a.userName, a.displayName) || ""
          if (id === undefined) continue
          people.current.set(id, { name, host: !!(a.isHost || a.isCoHost) })
          if (id !== myId.current && name && !a.isHost) everyone.current.add(name)
        }
      },
    })
  }

  const hostIds = () => Array.from(people.current.entries()).filter(([id, p]) => p.host && id !== myId.current).map(([id]) => id)

  const saveReport = (beacon = false) => {
    if (reported.current) return
    reported.current = true
    const payload = JSON.stringify({ projectName: proj?.name, attendees: Array.from(everyone.current), qa: qa.current })
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/zoom-sofia/report", new Blob([payload], { type: "application/json" }))
      return
    }
    fetch("/api/zoom-sofia/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
      .then(r => r.json())
      .then(d => setSaved(`Guardado en CASAi: ${d.questions ?? 0} preguntas, ${d.attendees ?? 0} asistentes${d.matchedContacts ? `, ${d.matchedContacts} contactos actualizados` : ""}.`))
      .catch(() => setSaved("No se pudo guardar el resumen."))
  }

  const onChat = async (raw: any) => {
    // The SDK delivers { data: { sender: "<name>", senderId, receiverId,
    // content: { text } } } (6.x); older builds pass the object directly.
    const data = raw?.data ?? raw
    const content = pick(data?.content?.text, data?.content, data?.message, data?.text, data?.msg) || ""
    const toNum = (v: unknown) => {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN
      return Number.isFinite(n) ? n : undefined
    }
    const senderId = toNum(data?.senderId ?? data?.sender?.userId ?? data?.sender?.id ?? data?.userId)
    const receiverId = toNum(data?.receiverId ?? data?.receiver?.userId ?? data?.receiver?.id)
    let senderName = (typeof data?.sender === "string" ? data.sender : "") ||
      pick(data?.sender?.name, data?.senderName, data?.sender?.userName, data?.sender?.displayName) || ""
    if (!senderName && senderId !== undefined) senderName = people.current.get(senderId)?.name || ""
    if (!content.trim()) {
      log({ name: senderName, question: "(mensaje sin texto)", answer: JSON.stringify(data).slice(0, 200), action: "info" })
      return
    }

    if ((senderId !== undefined && senderId === myId.current) || senderName.startsWith("Sofía")) return
    if (senderId === undefined || !people.current.has(senderId)) refreshPeople()
    const sender = senderId !== undefined ? people.current.get(senderId) : undefined
    recent.current = [...recent.current, `${senderName || "Alguien"}: ${content}`].slice(-10)
    if (sender?.host) {
      // Catherine (or a co-host) talking — not a question for Sofía
      log({ name: senderName, question: content, answer: "Mensaje de la anfitriona — Sofía no responde.", action: "info" })
      return
    }
    if (senderName) everyone.current.add(senderName)
    if (!answeringRef.current) {
      log({ name: senderName, question: content, answer: "(Sofía en pausa)", action: "info" })
      return
    }

    const isPrivate = receiverId !== undefined && receiverId === myId.current
    try {
      const res = await fetch("/api/zoom-sofia/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, message: content, senderName, recent: recent.current.slice(0, -1) }),
      })
      const d = await res.json()
      if (d.action === "skip") {
        log({ name: senderName, question: content, answer: "Saludo o comentario — no requiere respuesta.", action: "skip" })
        return
      }
      const replyTo = isPrivate && senderId !== undefined ? senderId : undefined
      if (d.reply) {
        await send(d.reply, replyTo)
        recent.current = [...recent.current, `Sofía: ${d.reply}`].slice(-10)
      }
      if (d.action === "escalate") {
        for (const id of hostIds()) await send(`📩 Pregunta para ti de ${senderName || "un asistente"}: ${d.note || content}`, id)
      }
      qa.current.push({ name: senderName, question: content, answer: d.reply || "", action: d.action })
      log({ name: senderName, question: content, answer: d.action === "escalate" ? `Para Catherine: ${d.note || content}` : d.reply, action: d.action })
    } catch (e) {
      qa.current.push({ name: senderName, question: content, answer: "", action: "escalate" })
      log({ name: senderName, question: content, answer: "Error de Sofía — respóndela tú.", action: "error" })
    }
  }

  const join = async () => {
    setError(null)
    const meetingNumber = meetingNumberFrom(link)
    if (!meetingNumber) return setError("Pega el link de Zoom o escribe el número de la reunión.")
    setPhase("joining")
    try {
      const sig = await fetch("/api/zoom-sofia/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingNumber }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Sin firma"); return d })

      for (const urls of SCRIPTS) await loadFirst(urls)
      const ZoomMtg = (window as any)["@zoom/meetingsdk"]?.ZoomMtg || (window as any).ZoomMtg
      if (!ZoomMtg) throw new Error("No cargó el SDK de Zoom")
      zoom.current = ZoomMtg

      ZoomMtg.setZoomJSLib(`https://source.zoom.us/${SDK_VERSION}/lib`, "/av")
      ZoomMtg.preLoadWasm()
      ZoomMtg.prepareWebSDK()
      ZoomMtg.i18n.load("es-ES")
      ZoomMtg.i18n.onLoad(() => {
        if (initStarted.current) return // onLoad can fire more than once
        initStarted.current = true
        ZoomMtg.init({
          leaveUrl: "/sofia-zoom",
          patchJsMedia: true,
          disableCORP: !window.crossOriginIsolated,
          isSupportAV: false,
          disableJoinAudio: true,
          isSupportChat: true,
          success: () => {
            ZoomMtg.join({
              signature: sig.signature,
              meetingNumber: sig.meetingNumber,
              userName: BOT_NAME,
              ...(passcode.trim() ? { passWord: passcode.trim() } : {}),
              success: () => {
                if (joined.current) return // the SDK can call success twice
                joined.current = true
                setPhase("live")
                ZoomMtg.getCurrentUser({
                  success: (res: any) => {
                    myId.current = pickNum(res?.result?.currentUser?.userId) ?? null
                    refreshPeople()
                  },
                })
                ZoomMtg.inMeetingServiceListener("onReceiveChatMsg", (d: any) => { void onChat(d) })
                ZoomMtg.inMeetingServiceListener("onUserJoin", () => refreshPeople())
                ZoomMtg.inMeetingServiceListener("onUserUpdate", () => refreshPeople())
                ZoomMtg.inMeetingServiceListener("onMeetingStatus", (d: any) => {
                  // 3 = disconnected / meeting ended
                  if (d?.meetingStatus === 3) { saveReport(true); setPhase("ended") }
                })
                setTimeout(() => {
                  void send(`¡Hola a todos! 👋 Soy Sofía, la asistente de ${hostName.split(" ")[0] || "Catherine"}. Mientras ella presenta ${proj?.name || "el proyecto"}, escriban aquí sus preguntas (precios, pagos, financiamiento) y les respondo al instante.`)
                  log({ name: "Sofía", question: "", answer: "Mensaje de bienvenida enviado.", action: "info" })
                }, 4000)
              },
              error: (e: any) => {
                setPhase("setup")
                setError(`Zoom no dejó entrar a Sofía: ${e?.errorMessage || e?.reason || JSON.stringify(e)}. Revisa el código de acceso y admítela si está en la sala de espera.`)
              },
            })
          },
          error: (e: any) => { setPhase("setup"); setError(`No se pudo iniciar Zoom: ${e?.errorMessage || JSON.stringify(e)}`) },
        })
      })
    } catch (e: any) {
      setPhase("setup")
      setError(e.message || "No se pudo conectar a Sofía.")
    }
  }

  const finish = () => {
    saveReport()
    try { zoom.current?.leaveMeeting({}) } catch {}
    setPhase("ended")
  }

  useEffect(() => {
    const onUnload = () => { if (phase === "live") saveReport(true) }
    window.addEventListener("pagehide", onUnload)
    return () => window.removeEventListener("pagehide", onUnload)
  })

  // ------------------------------------------------------------- setup
  if (phase === "setup" || phase === "joining") {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Sofía en Zoom</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sofía entra a tu reunión como <strong>{BOT_NAME}</strong>, responde las preguntas del chat con los datos del
            proyecto y te pasa en privado las que debes responder tú. Abre esta página en otra ventana o en una tablet y deja
            la presentación en tu Zoom normal.
          </p>

          <label className="mt-6 block text-sm font-medium text-slate-700">Proyecto que presentas
            <select value={project} onChange={e => setProject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
              {projects.map(p => <option key={p.href} value={p.href}>{p.name} — {p.place}</option>)}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">Link de Zoom o número de reunión
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://zoom.us/j/84012345678?pwd=…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">Código de acceso (passcode), si tiene
            <input value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Ej. 123456" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={join}
            disabled={phase === "joining"}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {phase === "joining" ? "Conectando a Sofía…" : "Unir a Sofía a la reunión"}
          </button>
          <ul className="mt-5 space-y-1 text-xs text-slate-500">
            <li>• Si tienes sala de espera, admite a “{BOT_NAME}”.</li>
            <li>• Funciona en reuniones de Zoom (no en Zoom Webinars).</li>
            <li>• Tus mensajes como anfitriona no los responde; las preguntas privadas a Sofía las contesta en privado.</li>
          </ul>
        </div>
      </main>
    )
  }

  // --------------------------------------------- live panel (over Zoom)
  return (
    <div className="fixed right-3 top-3 z-[2147483000] w-[min(92vw,380px)] rounded-2xl bg-white/95 shadow-2xl ring-1 ring-black/10 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Sofía en Zoom · {phase === "ended" ? "terminada" : "en vivo"}</p>
          <p className="text-xs text-slate-500">{proj?.name}</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">{open ? "Ocultar" : "Ver"}</button>
      </div>
      {open && (
        <div className="space-y-3 p-4">
          {phase === "live" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAnswering(a => !a)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${answering ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                {answering ? "Respondiendo ✓" : "En pausa"}
              </button>
              <button
                onClick={() => void send(`📅 ¿Quieren su plan personalizado y una presentación privada de 30 minutos con Catherine? Agenden aquí: ${bookUrl}`)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Enviar link para agendar
              </button>
              <button onClick={finish} className="col-span-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                Terminar y guardar en CASAi
              </button>
            </div>
          )}
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{saved}</p>}
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {items.length === 0 && <li className="text-xs text-slate-500">Esperando preguntas en el chat…</li>}
            {items.map((it, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2 text-xs">
                <p className="text-slate-400">{it.at} · {it.name || "—"} · {
                  { answer: "respondida", escalate: "para ti", skip: "ignorada", error: "error", info: "info" }[it.action]
                }</p>
                {it.question && <p className="mt-1 font-medium text-slate-800">{it.question}</p>}
                {it.answer && <p className={`mt-1 ${it.action === "escalate" || it.action === "error" ? "text-amber-700" : "text-slate-600"}`}>{it.answer}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
