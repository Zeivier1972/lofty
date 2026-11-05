// Sofía Zoom bot — control server.
//
// Runs next to the native Zoom Meeting SDK bot (build/sofia-bot) in the same
// container. The CRM (/sofia-zoom) calls this server over Railway's private
// network to send Sofía into a meeting or pull her out. Chat messages from the
// meeting arrive here from the native bot (JSON lines on its stdout); this
// server asks the CRM what to answer and hands the reply back to the bot (JSON
// lines on its stdin). Node 20+, no dependencies.

import http from "node:http"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

const PORT = Number(process.env.PORT || 8080)
const SECRET = process.env.SOFIA_BOT_SECRET || ""
const CRM_URL = (process.env.CRM_URL || "https://www.catherinegomezrealtor.com").replace(/\/$/, "")
const BOT_BIN = process.env.SOFIA_BOT_BIN || "/app/build/sofia-bot"
const NAME = process.env.SOFIA_DISPLAY_NAME || "Sofía (asistente de Catherine)"

/** One meeting at a time: Catherine presents one project at a time. */
let session = null

const log = (...a) => console.log(new Date().toISOString(), ...a)

function newSession(opts) {
  return {
    ...opts,
    status: "starting",
    detail: "",
    startedAt: new Date().toISOString(),
    child: null,
    attendees: new Map(), // userId -> name
    qa: [],
    recent: [],
    events: [],
    reported: false,
    paused: false,
  }
}

function event(s, text) {
  s.events.push(`${new Date().toISOString().slice(11, 19)} ${text}`)
  if (s.events.length > 200) s.events.shift()
  log(`[${s.meetingNumber}]`, text)
}

function toBot(s, msg) {
  if (!s.child || !s.child.stdin.writable) return
  if (msg.type === "leave") return s.child.stdin.write("LEAVE\n")
  const text = String(msg.text || "").trim()
  if (!text) return
  s.child.stdin.write(`SEND\t${msg.to}\t${Buffer.from(text, "utf8").toString("base64")}\n`)
}

async function crm(path, body) {
  const res = await fetch(`${CRM_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sofia-bot-secret": SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return res.json()
}

async function onChat(s, m) {
  const name = m.senderName || "Asistente"
  s.attendees.set(String(m.senderId), name)
  s.recent.push(`${name}: ${m.text}`)
  if (s.recent.length > 12) s.recent.shift()
  event(s, `chat de ${name}${m.toAll ? "" : " (privado)"}${m.fromHost ? " (anfitriona)" : ""}: ${m.text}`)
  if (s.paused) return
  // Catherine's own messages are for her clients, not for Sofía — unless she
  // calls her by name ("Sofía, ¿cuánto es el depósito?").
  if (m.fromHost && !/\bsof[ií]a\b/i.test(m.text)) return

  let d
  try {
    d = await crm("/api/zoom-sofia/answer", {
      project: s.project,
      message: m.text,
      senderName: name,
      recent: s.recent.slice(0, -1),
    })
  } catch (e) {
    event(s, `error pidiendo respuesta: ${e.message}`)
    d = { action: "escalate", reply: "", note: m.text }
  }

  // Reply where they asked: publicly if they wrote to everyone, privately if
  // they wrote only to Sofía.
  const to = m.toAll ? 0 : Number(m.senderId)
  if (d.action === "answer" && d.reply) {
    toBot(s, { type: "send", to, text: d.reply })
    s.recent.push(`Sofía: ${d.reply}`)
  } else if (d.action === "escalate") {
    if (d.reply) toBot(s, { type: "send", to, text: d.reply })
    toBot(s, { type: "send", to: "host", text: `📌 Pregunta para ti de ${name}: ${d.note || m.text}` })
  }
  if (d.action !== "skip") {
    s.qa.push({ name, question: m.text, answer: d.reply || "", action: d.action })
    event(s, `Sofía → ${d.action}${d.reply ? `: ${d.reply}` : ""}`)
  }
}

async function report(s) {
  if (s.reported) return
  s.reported = true
  try {
    const r = await crm("/api/zoom-sofia/report", {
      projectName: s.projectName || s.project,
      attendees: Array.from(s.attendees.values()),
      qa: s.qa,
    })
    event(s, `resumen guardado en el CRM (${r.questions ?? 0} preguntas)`)
  } catch (e) {
    event(s, `no se pudo guardar el resumen: ${e.message}`)
  }
}

function start(opts) {
  const s = newSession(opts)
  session = s
  const child = spawn(BOT_BIN, [], {
    env: {
      ...process.env,
      MEETING_NUMBER: opts.meetingNumber,
      MEETING_PASSWORD: opts.password || "",
      DISPLAY_NAME: opts.displayName || NAME,
      QT_LOGGING_RULES: "*.debug=false;*.warning=false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  })
  s.child = child
  event(s, `iniciando bot para la reunión ${opts.meetingNumber}`)

  createInterface({ input: child.stdout }).on("line", line => {
    if (!line.startsWith("{")) return log("[bot]", line)
    let m
    try { m = JSON.parse(line) } catch { return log("[bot]", line) }
    if (m.type === "status") {
      s.status = m.status
      s.detail = m.detail || ""
      event(s, `estado: ${m.status}${m.detail ? ` (${m.detail})` : ""}`)
      if (m.status === "in_meeting" && opts.welcome) toBot(s, { type: "send", to: 0, text: opts.welcome })
      if (m.status === "ended") report(s)
    } else if (m.type === "user") {
      if (m.joined) s.attendees.set(String(m.userId), m.name)
    } else if (m.type === "chat") {
      onChat(s, m).catch(e => event(s, `error: ${e.message}`))
    } else if (m.type === "log") {
      event(s, m.text)
    }
  })
  createInterface({ input: child.stderr }).on("line", line => log("[bot:err]", line))
  child.on("exit", code => {
    event(s, `bot terminó (código ${code})`)
    if (s.status !== "ended" && s.status !== "failed") s.status = code === 0 ? "ended" : "failed"
    report(s)
    s.child = null
  })
  return s
}

function stop(s) {
  if (!s?.child) return
  toBot(s, { type: "leave" })
  const c = s.child
  setTimeout(() => { if (c.exitCode === null) c.kill("SIGTERM") }, 8000)
}

function view(s) {
  if (!s) return { status: "idle" }
  return {
    status: s.status,
    detail: s.detail,
    meetingNumber: s.meetingNumber,
    project: s.project,
    startedAt: s.startedAt,
    attendees: Array.from(s.attendees.values()),
    questions: s.qa.length,
    paused: s.paused,
    qa: s.qa.slice(-30),
    events: s.events.slice(-60),
  }
}

function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

http.createServer(async (req, res) => {
  if (req.url === "/health") return send(res, 200, { ok: true })
  if (!SECRET || req.headers["x-sofia-bot-secret"] !== SECRET) return send(res, 401, { error: "unauthorized" })

  let body = {}
  if (req.method === "POST") {
    const chunks = []
    for await (const c of req) chunks.push(c)
    try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}") } catch { body = {} }
  }

  if (req.method === "GET" && req.url === "/status") return send(res, 200, view(session))

  if (req.method === "POST" && req.url === "/join") {
    const meetingNumber = String(body.meetingNumber || "").replace(/\D/g, "")
    if (meetingNumber.length < 9) return send(res, 400, { error: "Número de reunión inválido" })
    if (session?.child) return send(res, 409, { error: "Sofía ya está en una reunión. Sácala primero." })
    const s = start({
      meetingNumber,
      password: String(body.password || ""),
      project: String(body.project || ""),
      projectName: String(body.projectName || ""),
      displayName: body.displayName ? String(body.displayName).slice(0, 60) : NAME,
      welcome: body.welcome ? String(body.welcome).slice(0, 500) : "",
    })
    return send(res, 200, view(s))
  }

  if (req.method === "POST" && req.url === "/leave") {
    stop(session)
    return send(res, 200, view(session))
  }

  if (req.method === "POST" && req.url === "/pause") {
    if (session) session.paused = Boolean(body.paused)
    return send(res, 200, view(session))
  }

  if (req.method === "POST" && req.url === "/say") {
    if (!session?.child) return send(res, 409, { error: "Sofía no está en una reunión" })
    toBot(session, { type: "send", to: 0, text: String(body.text || "").slice(0, 1000) })
    return send(res, 200, { ok: true })
  }

  send(res, 404, { error: "not found" })
}).listen(PORT, "::", () => log(`sofia control server on :${PORT}`))

process.on("SIGTERM", () => { stop(session); setTimeout(() => process.exit(0), 3000) })
