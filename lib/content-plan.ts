import { PROJECTS, projectUrl, type Project } from "@/lib/projects"

/**
 * What the social Auto-Pilot posts each day: which audience, which format,
 * which topic, and which comment keyword turns engagement into a lead.
 *
 * Catherine sells to two audiences, and a post that tries to talk to both
 * talks to neither:
 *   INTERNACIONAL — Colombian / Latin American investors buying pre-construction
 *     condos (Brickell, Orlando) from abroad. "Usted", trust first, dollars,
 *     buying without travelling.
 *   LOCAL — South Florida families buying new-construction homes and
 *     townhomes to live in. "Tú", the monthly payment, how much to move in,
 *     builder incentives, assistance programs.
 *
 * The weekly rotation also varies the FORMAT (list, question, myth vs reality,
 * project spotlight, personal, quick tip) because the algorithm reads one
 * format every day as one piece, not a system. Every post asks for a comment
 * keyword ("Comenta DOMUS", "Comenta CASA"); those keywords are answered
 * automatically in DM with the right link (lib/projects commentKeywordReply).
 */

export type Audience = "INTERNACIONAL" | "LOCAL"
export type PostFormat = "LISTA" | "PREGUNTA" | "MITO_REALIDAD" | "PROYECTO" | "PERSONAL" | "TIP"

export type ContentPlan = {
  audience: Audience
  format: PostFormat
  theme: string
  /** The project the post features, when it features one. */
  project: Project | null
  /** Word the post asks people to comment (answered in DM automatically). */
  commentKeyword: string
  /** Prompt block: audience, tone, format, hook and anti-generic rules. */
  instructions: string
  /** 4–6 hashtags that fit this post's audience. */
  hashtags: string[]
}

const INTL_THEMES = [
  "cuánto capital necesitas para empezar a invertir en preconstrucción en Brickell (con números de un proyecto real)",
  "cómo comprar en Miami desde Colombia sin viajar: firma electrónica, LLC o a tu nombre",
  "proteger tus ahorros en dólares: por qué los latinoamericanos invierten en Florida",
  "cómo se protegen tus depósitos en preconstrucción: escrow y los 15 días para cancelar en Florida",
  "registrar tu inversión ante el Banco de la República y declararla ante la DIAN: lo que tu contador debe saber",
  "préstamos para extranjeros en Florida: cuánta inicial piden y qué documentos",
  "Brickell vs Orlando para el inversionista internacional: qué cambia en precio, renta y plan de pagos",
  "las 5 preguntas que debes hacerle a cualquier desarrollador antes de firmar",
  "condo-hotel, renta corta o renta larga: qué permite cada edificio y por qué importa",
  "los gastos además del precio: cierre, HOA, seguro e impuestos de propiedad en Florida",
]

const LOCAL_THEMES = [
  "cuánto necesitas para mudarte a una casa nueva en South Florida: inicial, cierre y depósitos",
  "programas de ayuda para el pago inicial en Miami-Dade para compradores de primera vez",
  "incentivos del builder: costos de cierre pagados y tasas reducidas — cómo pedirlos",
  "por qué tener tu propio Realtor al comprar al builder no te cuesta nada",
  "casa nueva vs casa usada en Homestead y Florida City: qué te conviene",
  "comprar directo al builder (Lennar, D.R. Horton…) vs con tu Realtor: qué cambia para ti",
  "sur o norte de Miami-Dade: dónde rinde más tu presupuesto para una casa nueva",
  "qué incluye una casa nueva de builder y qué se paga aparte (upgrades, cortinas, nevera)",
  "townhome vs casa unifamiliar: pago mensual, HOA y espacio",
  "préstamo FHA o convencional para construcción nueva: requisitos reales",
  "qué revisar en la inspección y el walkthrough de una casa nueva antes de cerrar",
  "cuánto crédito necesitas para comprar casa nueva en Florida",
  "HOA y CDD en comunidades nuevas de South Florida: qué son y cuánto suman al mes",
]

const PERSONAL_THEMES = [
  "por qué Catherine se dedica a ayudar a familias hispanas a comprar en Florida",
  "un día de trabajo de Catherine visitando proyectos y comunidades nuevas",
  "el error más común que Catherine ve en compradores y cómo evitarlo",
  "lo que Catherine revisa en un contrato de preconstrucción antes de recomendarlo",
]

/** Mon..Sun → [audience, format]. Sunday's tip alternates audience by week. */
const WEEK: Record<number, [Audience | "ALTERNA", PostFormat]> = {
  1: ["LOCAL", "LISTA"],
  2: ["INTERNACIONAL", "PROYECTO"],
  3: ["LOCAL", "PREGUNTA"],
  4: ["INTERNACIONAL", "MITO_REALIDAD"],
  5: ["LOCAL", "PROYECTO"],
  6: ["ALTERNA", "PERSONAL"],
  0: ["ALTERNA", "TIP"],
}

const FORMAT_RULES: Record<PostFormat, string> = {
  LISTA: "FORMATO LISTA: un título con número (\"5 cosas…\", \"3 errores…\") y una lista numerada corta, una línea por punto.",
  PREGUNTA: "FORMATO PREGUNTA: plantea una decisión real con 2 o 3 opciones numeradas y pide que respondan con el número (\"Escribe 1 o 2\"). Da tu opinión breve al final.",
  MITO_REALIDAD: "FORMATO MITO vs REALIDAD: \"❌ Mito:\" una creencia común, \"✅ Realidad:\" la explicación con un dato concreto. Puede ser 1 o 2 pares.",
  PROYECTO: "FORMATO PROYECTO: presenta UN proyecto o tipo de producto con 3 datos concretos (precio desde, plan de pagos, un diferencial). Nada de adjetivos vacíos.",
  PERSONAL: "FORMATO PERSONAL: en primera persona, como Catherine, una reflexión o momento real de su trabajo. Cercano, sin vender. NO inventes clientes, nombres ni cifras de clientes.",
  TIP: "FORMATO TIP RÁPIDO: un solo consejo útil con un número o dato, en 40–70 palabras.",
}

const AUDIENCE_RULES: Record<Audience, string> = {
  INTERNACIONAL:
    "AUDIENCIA: inversionistas de Colombia y Latinoamérica que compran preconstrucción en Miami u Orlando desde su país. " +
    "Trátalos de USTED. Lo que les importa: proteger patrimonio en dólares, confianza (miedo a estafas), comprar sin viajar, papeleo en su país, rentas. " +
    "Nunca prometas rentabilidad, ocupación ni valorización por tu cuenta; si un proyecto tiene un programa del desarrollador (renta garantizada, lease-back), preséntalo como oferta del desarrollador, con sus condiciones.",
  LOCAL:
    "AUDIENCIA: familias hispanas que viven en South Florida y quieren comprar casa o townhome NUEVO para vivir, en TODO el sur y el norte de Miami-Dade (sur: Homestead, Florida City, Cutler Bay, Kendall; norte: Miami Gardens, Hialeah, Miami Lakes, North Miami), con builders como Lennar, D.R. Horton y otros. " +
    "Catherine trabaja con todos los builders: el comprador no paga más por tener su propia Realtor. No inventes nombres de comunidades, precios ni incentivos concretos. " +
    "Trátalos de TÚ, cercano y familiar. Lo que les importa: el pago mensual, cuánto necesitan para mudarse, programas de ayuda, incentivos del builder, escuelas y HOA. " +
    "No hables de inversión desde el extranjero.",
}

const HOOK_RULES =
  "GANCHO (lo más importante — hay 3 segundos): la PRIMERA línea tiene máximo 10 palabras y toca un dolor concreto o un número concreto. " +
  "Ejemplos del estilo: \"Con $53,290 empiezas a comprar en Brickell.\" · \"El error que te cuesta $10,000 al comprar casa nueva.\" · \"¿Pagas renta? Esto es lo que pagarías por una casa nueva.\" " +
  "PROHIBIDO empezar con: saludos (\"¡Hola!\", \"Hola familia\"), \"¿Sabías que…\", \"En el mundo de…\", \"Hoy quiero hablarte de…\", \"Descubre…\", ni con emojis."

const ANTI_GENERIC_RULES =
  "VOZ: suena como Catherine hablando, no como una agencia ni como IA. Frases cortas. Nada de \"sueño americano\", \"no te lo pierdas\", \"oportunidad única\", \"en el competitivo mercado\", \"descubre\", \"potencial\", \"invertir en tu futuro\". " +
  "Cada post debe tener al menos UN dato concreto (precio, porcentaje, plazo, requisito) y debe servirle a la persona aunque nunca compre."

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
}

/** International projects that have a real page (the guide is not a project to sell). */
function intlProjects(): Project[] {
  return PROJECTS.filter(p => !p.href.startsWith("/guias"))
}

function keywordFor(project: Project): string {
  const first = project.name.replace(/^Guía:.*/, "").split(/\s+/)[0] || "INFO"
  if (/house/i.test(first)) return "WELLNESS"
  return first.toUpperCase()
}

const INTL_TAGS = ["#InvertirEnMiami", "#Preconstruccion", "#BrickellMiami", "#InversionistasColombianos", "#BienesRaicesMiami", "#ComprarEnMiami", "#Orlando"]
const LOCAL_TAGS = ["#CasaNueva", "#CompraTuCasa", "#HomesteadFL", "#MiamiDade", "#PrimeraCasa", "#TownhomesMiami", "#FloridaCity", "#MiamiGardens", "#CutlerBay", "#NuevaConstruccion"]

function pick<T>(arr: T[], seed: number, n: number): T[] {
  const out: T[] = []
  for (let i = 0; i < arr.length && out.length < n; i++) out.push(arr[(seed + i * 3) % arr.length])
  return Array.from(new Set(out))
}

/**
 * Plan for a post. `slot` "evening" takes the other audience with a quick
 * tip, so both audiences hear from Catherine every day.
 */
export function contentPlanFor(date: Date, slot: "morning" | "evening" = "morning"): ContentPlan {
  const dow = date.getDay()
  const doy = dayOfYear(date)
  const week = Math.floor(doy / 7)
  const [aud0, fmt0] = WEEK[dow]
  let audience: Audience = aud0 === "ALTERNA" ? (week % 2 ? "INTERNACIONAL" : "LOCAL") : aud0
  let format: PostFormat = fmt0
  if (slot === "evening") {
    audience = audience === "LOCAL" ? "INTERNACIONAL" : "LOCAL"
    format = "TIP"
  }

  let project: Project | null = null
  let theme: string
  if (format === "PROYECTO" && audience === "INTERNACIONAL") {
    const list = intlProjects()
    project = list[week % list.length]
    theme = `presentación del proyecto ${project.name} (${project.place}): ${project.highlight}. ${project.summary}`
  } else if (format === "PERSONAL") {
    theme = PERSONAL_THEMES[week % PERSONAL_THEMES.length]
  } else if (format === "PROYECTO" && audience === "LOCAL") {
    theme = "casas y townhomes nuevos en South Florida: qué incluye una casa de builder, rango de precios y cómo apartar una — sin inventar nombres de comunidades ni precios exactos"
  } else {
    const pool = audience === "INTERNACIONAL" ? INTL_THEMES : LOCAL_THEMES
    theme = pool[(doy + (slot === "evening" ? 5 : 0)) % pool.length]
  }

  const commentKeyword = project ? keywordFor(project) : audience === "INTERNACIONAL" ? "INVERTIR" : "CASA"
  const link = project ? projectUrl(project) : null
  const hashtags = pick(audience === "INTERNACIONAL" ? INTL_TAGS : LOCAL_TAGS, doy, 5)

  const instructions = [
    AUDIENCE_RULES[audience],
    FORMAT_RULES[format],
    HOOK_RULES,
    ANTI_GENERIC_RULES,
    project
      ? `DATOS DEL PROYECTO (usa solo estos, no inventes otros): ${project.name}, ${project.place}. ${project.highlight}. ${project.summary} Página: ${link}`
      : "",
    `CIERRE: termina con UNA llamada a comentar: "Comenta ${commentKeyword} y te envío ${project ? "precios y la información completa" : audience === "INTERNACIONAL" ? "la guía para invertir desde tu país" : "las casas nuevas disponibles y cuánto necesitas para mudarte"} por mensaje privado." No pidas que escriban al teléfono ni que den clic en el perfil.`,
  ].filter(Boolean).join("\n\n")

  return { audience, format, theme, project, commentKeyword, instructions, hashtags }
}
