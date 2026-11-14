/**
 * The 16:9 YouTube pilot: one video, planned scene by scene before anything
 * renders (Catherine's production brief, Nov 2026).
 *
 * Why a fixed plan instead of the autopilot: the autopilot's B-roll came from
 * a free stock library searched by keyword and never matched what she says.
 * Here every shot is either Parkside's own developer material (renders and the
 * 3D tour, always labelled as renders), a graphic with the developer's real
 * numbers, or the avatar. No stock footage, no AI-generated architecture.
 *
 * Facts come from app/parkside/colombia/data.ts (developer sheet of
 * 27 Oct 2026). If the developer sends new prices, update both.
 */

import { UNITS, DEPOSITS, PRICES_AS_OF, usd } from "@/app/parkside/colombia/data"

const BASE = "https://www.catherinegomezrealtor.com"
export const BOOK_URL = `${BASE}/parkside/colombia/agendar`
export const PAGE_URL = `${BASE}/parkside/colombia`

export type Shot =
  /** A developer render with a slow camera move. */
  | { kind: "still"; image: string; move: "in" | "out" | "left" | "right"; title?: string; sub?: string; cue?: string }
  /** The vertical 3D tour, centred over a blurred copy of itself. */
  | { kind: "tour"; startAt: number; cue?: string }
  /**
   * A motion graphic in the Brickell Editorial colours. `cues`: words whose
   * moment makes each element appear (the schedule's four payments).
   */
  | { kind: "card"; card: "prices" | "schedule" | "cta"; cue?: string; cues?: string[] }

// `cue` on a shot after the first: the shot starts when that word is spoken
// (accents and case ignored, prefix match). Without one the scene splits evenly.

export type PilotScene = {
  id: string
  /** Avatar on camera, or narration over visuals. */
  mode: "avatar" | "broll"
  narration: string
  shots: Shot[]
  /** The plan's columns, shown to Catherine for approval. */
  visual: string
  source: string
  camera: string
  transition: string
  onScreen: string
  purpose: string
  /** Chapter title on YouTube (scenes without one join the previous chapter). */
  chapter?: string
}

const studio = UNITS[0]
const dep = DEPOSITS.map(d => ({ ...d, amount: studio.from * d.pct / 100 }))

export const PILOT_SCENES: PilotScene[] = [
  {
    id: "hook",
    mode: "avatar",
    narration: "¿Cuánto necesitas realmente para invertir en Brickell desde Colombia? Hoy te lo explico con los números reales de un proyecto real.",
    shots: [],
    visual: "Catherine (avatar) a cámara, plano medio",
    source: "Avatar aprobado de HeyGen (Yellow dress professional in office) y su voz",
    camera: "Fija",
    transition: "Entra directo, sin intro de logo",
    onScreen: "Rótulo: Catherine Gomez · Realtor en Miami",
    purpose: "Gancho: la pregunta que se hace el inversionista",
    chapter: "La pregunta",
  },
  {
    id: "project",
    mode: "broll",
    narration: "Este es Parkside Residences, un edificio nuevo en Brickell, frente a Simpson Park. Tiene estudios y apartamentos de una y dos habitaciones, con entrega estimada en el primer trimestre de dos mil veintiocho.",
    shots: [
      { kind: "still", image: "fachada-atardecer.jpg", move: "in", title: "Parkside Residences at Brickell", sub: "Frente a Simpson Park · Miami" },
      { kind: "still", image: "fachada-calle.jpg", move: "left", title: "Entrega estimada: 1er trimestre 2028", cue: "tiene" },
    ],
    visual: "Fachada al atardecer → fachada desde la calle",
    source: "Renders oficiales del desarrollador (rotulados como render)",
    camera: "Acercamiento lento → paneo lateral",
    transition: "Corte",
    onScreen: "Parkside Residences at Brickell · Frente a Simpson Park · Entrega estimada 1er trimestre 2028",
    purpose: "Ubicar el proyecto real del que hablamos",
    chapter: "El proyecto",
  },
  {
    id: "prices",
    mode: "broll",
    narration: "Los estudios empiezan en cuatrocientos noventa mil dólares. Pero la buena noticia es que no necesitas pagarlo todo hoy.",
    shots: [{ kind: "card", card: "prices" }],
    visual: "Gráfico de precios por tipo de unidad",
    source: `Hoja de precios del desarrollador (${PRICES_AS_OF})`,
    camera: "Fondo con zoom lento; filas que aparecen una a una",
    transition: "Corte",
    onScreen: UNITS.map(u => `${u.type} desde ${usd(u.from)}`).join(" · "),
    purpose: "Dar el dato concreto que el espectador vino a buscar",
    chapter: "Precios",
  },
  {
    id: "schedule",
    mode: "broll",
    narration: "Separas con el veinte por ciento al firmar: en un estudio son unos noventa y ocho mil dólares. Luego pagas diez por ciento en enero y diez por ciento en abril de dos mil veintisiete. El sesenta por ciento restante se paga al cierre, y puede financiarse con un préstamo, según tu perfil y el banco.",
    shots: [
      { kind: "card", card: "schedule", cues: ["veinte", "enero", "abril", "sesenta"] },
      { kind: "still", image: "estudio-sala.jpg", move: "in", title: "El 60% se paga al cierre", sub: "Puede financiarse según tu perfil y el banco", cue: "puede" },
    ],
    visual: "Línea de tiempo de pagos de un estudio → render de un estudio",
    source: "Plan de depósitos del desarrollador",
    camera: "Cada pago aparece cuando se menciona; luego acercamiento lento al estudio",
    transition: "Corte",
    onScreen: dep.map(d => `${d.pct}% ${usd(d.amount)}`).join(" → "),
    purpose: "Explicar el flujo de pagos con números exactos",
    chapter: "Cómo se paga",
  },
  {
    id: "amenities",
    mode: "broll",
    narration: "Y esto es lo que estarías comprando. En la azotea, una piscina para los residentes. Al entrar, un lobby con áreas sociales. Y apartamentos con vista abierta, como esta habitación.",
    shots: [
      { kind: "still", image: "piscina-azotea.jpg", move: "right", title: "Piscina en la azotea" },
      { kind: "still", image: "lobby-lounge.jpg", move: "in", title: "Lobby y áreas sociales", cue: "entrar" },
      { kind: "still", image: "recamara-vista.jpg", move: "out", title: "Apartamentos con vista abierta", cue: "apartamentos" },
    ],
    visual: "Piscina en la azotea → lobby → habitación con vista",
    source: "Renders oficiales del desarrollador (rotulados como render)",
    camera: "Paneo → acercamiento → alejamiento",
    transition: "Cada corte cae en la palabra que lo nombra",
    onScreen: "Nombre de cada área",
    purpose: "Mostrar el producto, sincronizado con cada cosa que se nombra",
    chapter: "Amenidades",
  },
  {
    id: "tour",
    mode: "broll",
    narration: "Así se verá el edificio terminado, en este recorrido en tres dimensiones del desarrollador.",
    shots: [{ kind: "tour", startAt: 3 }],
    visual: "Recorrido 3D vertical centrado sobre fondo desenfocado",
    source: "Video 3D oficial del desarrollador",
    camera: "Movimiento propio del recorrido",
    transition: "Corte",
    onScreen: "Recorrido 3D · Render del desarrollador",
    purpose: "Ver el edificio completo, dejando claro que es un render",
  },
  {
    id: "advice",
    mode: "avatar",
    narration: "Antes de decidir, revisa tres cosas: tu capital disponible, cómo vas a pagar el cierre y los costos de cerrar. Yo te ayudo a hacer esos números, sin compromiso.",
    shots: [],
    visual: "Catherine (avatar) a cámara",
    source: "Avatar aprobado de HeyGen",
    camera: "Fija",
    transition: "Corte",
    onScreen: "—",
    purpose: "Consejo honesto, sin prometer rentabilidad; genera confianza",
    chapter: "Antes de decidir",
  },
  {
    id: "cta",
    mode: "broll",
    narration: "Agenda una conversación de quince minutos conmigo. El enlace está en la descripción.",
    shots: [{ kind: "card", card: "cta" }],
    visual: "Tarjeta final con el enlace de agenda",
    source: "Gráfico de marca",
    camera: "Aparición suave",
    transition: "Corte; termina en la tarjeta",
    onScreen: "Agenda 15 minutos · catherinegomezrealtor.com/parkside/colombia/agendar",
    purpose: "Llamado a la acción con el enlace real de agenda",
  },
]

/** Numbers drawn on the graphics (all from data.ts). */
export const CARD_DATA = {
  asOf: PRICES_AS_OF,
  units: UNITS.map(u => ({ type: u.type, size: u.size, from: usd(u.from) })),
  studioPrice: usd(studio.from),
  deposits: dep.map((d, i) => ({
    pct: `${d.pct}%`,
    amount: usd(d.amount),
    when: i === 0 ? "Al firmar" : i === dep.length - 1 ? "Al cierre · 2028" : d.when.replace(" de ", " "),
  })),
  bookLabel: "catherinegomezrealtor.com/parkside/colombia/agendar",
}

export const PILOT_META = {
  topic: "¿Cuánto necesitas para invertir en Brickell desde Colombia?",
  title: "¿Cuánto necesitas para invertir en Brickell desde Colombia? Números reales de Parkside",
  tags: [
    "invertir en Miami desde Colombia", "Brickell", "Parkside Residences", "preconstrucción Miami",
    "apartamentos en Miami", "comprar en Miami siendo extranjero", "Catherine Gomez Realtor", "bienes raíces Miami",
  ],
  thumbnail: "Render de la fachada al atardecer, texto grande «¿CUÁNTO NECESITAS?» y en dorado «Separa desde US$98,000».",
  pinnedComment: `¿Quieres que hagamos tus números? Agenda 15 minutos conmigo aquí: ${BOOK_URL}\n¿Qué te gustaría saber de comprar en Miami desde Colombia? Déjamelo en los comentarios.`,
  followUp: "Cómo se financia el 60% al cierre siendo extranjero (requisitos y documentos)",
}

/** Description with chapters (pass the real chapter list once the video exists). */
export function pilotDescription(chapters: { at: number; title: string }[]): string {
  const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
  const lines = [
    "¿Cuánto dinero necesitas de verdad para invertir en un apartamento en Brickell, Miami, desde Colombia? Te explico con los números reales de Parkside Residences at Brickell: precios desde, cómo se paga la separación del 20% y qué pasa al cierre.",
    "",
    `📅 Agenda 15 minutos conmigo (Zoom o teléfono, en español): ${BOOK_URL}`,
    `📄 Calcula tu plan para Parkside: ${PAGE_URL}`,
    "",
  ]
  if (chapters.length >= 3) lines.push("Capítulos:", ...chapters.map(c => `${ts(c.at)} ${c.title}`), "")
  lines.push(
    `Precios y plan de pagos según la hoja del desarrollador del ${PRICES_AS_OF}; pueden cambiar. Las imágenes del edificio son renders del desarrollador. Este video es informativo: no promete rentabilidad, valorización ni ingresos por renta.`,
    "",
    "Catherine Gomez, Realtor en Miami · Licencia de bienes raíces de Florida #3320405",
    "",
    "#Miami #Brickell #InvertirEnMiami #Colombia #BienesRaices",
  )
  return lines.join("\n")
}
