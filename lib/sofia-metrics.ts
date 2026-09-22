// Medir qué hace Sofía de verdad.
//
// El problema que esto resuelve: cuando un visitante conversa y se va sin dejar
// correo ni teléfono, el CRM no guarda NADA — ni el lead ni rastro de que la
// conversación existió. Así que "no veo citas" podía significar tres cosas muy
// distintas: que nadie le escribe, que le escriben y no dejan datos, o que
// dejan datos y no agendan. Sin números no se sabe cuál, y cada una se arregla
// distinto.
//
// Los contadores viven en la tabla Setting (clave/valor) a propósito: no hay
// cambio de esquema, y no ensucian el feed de actividad de Catherine, que
// muestra las últimas 30 actividades SIN filtrar por tipo. Registrar cada
// conversación anónima como Activity le habría tapado el historial con ruido.

import { prisma } from "@/lib/prisma"

const KEY = "sofia_metrics"

export type SofiaEvent =
  | "conversation"   // primer mensaje del visitante — una conversación nueva
  | "message"        // cada mensaje que ella responde
  | "captured"       // dejó correo o teléfono y se creó el contacto
  | "wantedBooking"  // pidió hablar con Catherine o agendar
  | "sawListings"    // se le mostraron propiedades

type DayBucket = Partial<Record<SofiaEvent, number>>
type Store = Record<string, DayBucket>   // "2026-09-22" -> { conversation: 3, ... }

export const today = (d = new Date()) => d.toISOString().slice(0, 10)

export async function readSofiaMetrics(): Promise<Store> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null)
  if (!row) return {}
  try {
    const parsed = JSON.parse(row.value)
    return parsed && typeof parsed === "object" ? parsed as Store : {}
  } catch { return {} }
}

/**
 * Suma uno al contador del día. Es lectura-modificación-escritura sobre una
 * sola fila, así que dos visitantes simultáneos pueden pisarse y perder un
 * incremento. Con el tráfico actual eso no cambia ninguna conclusión, y la
 * alternativa (una tabla nueva) obligaba a migrar la base. Si el chat llega a
 * tener volumen real, esto hay que mover a su propia tabla.
 *
 * Nunca lanza: medir no puede tumbar la conversación que está midiendo.
 */
export async function recordSofiaEvent(kind: SofiaEvent, n = 1): Promise<void> {
  try {
    const store = await readSofiaMetrics()
    const day = today()
    store[day] = { ...(store[day] || {}), [kind]: ((store[day]?.[kind]) || 0) + n }
    // 120 días es de sobra para ver tendencia y mantiene la fila pequeña.
    const keep = Object.keys(store).sort().slice(-120)
    const trimmed: Store = {}
    for (const k of keep) trimmed[k] = store[k]
    const value = JSON.stringify(trimmed)
    await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } })
  } catch { /* medir jamás rompe el chat */ }
}

export type SofiaFunnel = {
  since: string
  days: number
  /** Contadores desde que se instrumentó — solo existen hacia adelante. */
  counters: Required<Record<SofiaEvent, number>>
  /** Histórico reconstruido de lo que sí quedó guardado en la base. */
  history: {
    leadsCapturados: number
    intercambiosRegistrados: number
    citasEnElCRM: number
    ultimoLead: Date | null
    ultimaConversacion: Date | null
  }
  /** Lo que los contadores no pueden saber de antes de existir. */
  instrumentadoDesde: string | null
}

export async function buildSofiaFunnel(days = 30): Promise<SofiaFunnel> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const store = await readSofiaMetrics()
  const dias = Object.keys(store).sort()
  const desde = dias.length ? dias[0] : null

  const counters = { conversation: 0, message: 0, captured: 0, wantedBooking: 0, sawListings: 0 }
  for (const [day, bucket] of Object.entries(store)) {
    if (day < since.toISOString().slice(0, 10)) continue
    for (const k of Object.keys(counters) as SofiaEvent[]) counters[k] += bucket[k] || 0
  }

  const [leadsCapturados, intercambios, citas, ultimoLeadRow, ultimaConvRow] = await Promise.all([
    prisma.activity.count({ where: { type: "CHAT", title: "Lead capturado en chat web (Sofía)", createdAt: { gte: since } } }).catch(() => 0),
    prisma.activity.count({ where: { type: "CHAT", title: "Chat web con Sofía", createdAt: { gte: since } } }).catch(() => 0),
    prisma.appointment.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.activity.findFirst({ where: { type: "CHAT", title: "Lead capturado en chat web (Sofía)" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null),
    prisma.activity.findFirst({ where: { type: "CHAT", title: "Chat web con Sofía" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null),
  ])

  return {
    since: since.toISOString().slice(0, 10),
    days,
    counters,
    history: {
      leadsCapturados,
      intercambiosRegistrados: intercambios,
      citasEnElCRM: citas,
      ultimoLead: ultimoLeadRow?.createdAt ?? null,
      ultimaConversacion: ultimaConvRow?.createdAt ?? null,
    },
    instrumentadoDesde: desde,
  }
}

/**
 * La lectura en una frase, para no dejarle el diagnóstico al ojo de nadie.
 * Distingue los tres problemas que "no veo citas" puede esconder.
 */
export function readFunnel(f: SofiaFunnel): string {
  const { conversation, captured, wantedBooking } = f.counters
  if (!f.instrumentadoDesde) {
    return "Todavía no hay contadores: la medición empieza a contar desde que se desplegó. Los números de abajo son lo que quedó guardado de antes."
  }
  if (conversation === 0) {
    return `Nadie ha escrito a Sofía en los últimos ${f.days} días. El problema NO es Sofía — es que no le llega gente al chat. Arreglar sus respuestas o darle herramientas no cambiaría nada mientras esto siga en cero.`
  }
  if (captured === 0) {
    return `${conversation} conversaciones y CERO dejaron correo o teléfono. La gente sí habla con ella, pero se va sin dejar rastro: hoy esas conversaciones se pierden enteras. Ahí está la fuga.`
  }
  const tasa = (captured / conversation) * 100
  if (wantedBooking === 0) {
    return `${conversation} conversaciones, ${captured} dejaron datos (${tasa.toFixed(0)}%), pero ninguna pidió agendar. Captura bien y no cierra: el problema está en cómo empuja hacia la cita.`
  }
  return `${conversation} conversaciones → ${captured} dejaron datos (${tasa.toFixed(0)}%) → ${wantedBooking} pidieron agendar. Compara ese último número con las ${f.history.citasEnElCRM} citas del CRM: si pidieron agendar y no hay cita, se están perdiendo entre el enlace y el calendario.`
}
