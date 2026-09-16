// Real short-term-rental performance by submarket, so the Investment Advisor
// and Aria stop quoting a generic $280/70% at every project. Every figure
// carries its source and date — when Catherine is asked "where did that come
// from?" in front of a client, there has to be an answer.
//
// Refresh these roughly every quarter. The PriceLabs index is live via the
// MCP integration (get_str_index for Florida); the submarket rows come from
// the public AirDNA / AirROI / Rabbu market reports.

export type StrMarket = {
  key: string
  label: string
  /** Lowercased fragments matched against a project's neighborhood + city. */
  match: string[]
  adr: number
  occupancyPct: number
  revpar?: number
  source: string
  asOf: string
  note?: string
  /** Occupancy swing across the year, where the source breaks it out. */
  seasonality?: { highPct: number; lowPct: number }
}

export const STR_ASOF = "septiembre 2026 (índice STR de PriceLabs, 12 meses cerrados sep 2025 – ago 2026)"

export const STR_MARKETS: StrMarket[] = [
  {
    key: "brickell",
    label: "Brickell",
    match: ["brickell"],
    adr: 278,
    occupancyPct: 64.5,
    revpar: 180,
    source: "Índice STR de PriceLabs, zip 33131, 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 79, lowPct: 53 },
    note: "Medido sobre ~1,700 anuncios activos del zip 33131. Febrero es el mes fuerte (79.2% al $332) y septiembre el flojo (52.6% al $184); marzo trae la tarifa más alta del año, $359. La tarifa subió 12.4% interanual pero la ocupación bajó 3.4 puntos: en Brickell hoy se cobra más y se llena menos.",
  },
  {
    key: "miami_beach",
    label: "Miami Beach / North Beach",
    match: ["miami beach", "north beach", "nobe", "collins", "abbott", "71st", "72"],
    adr: 333,
    occupancyPct: 52.5,
    revpar: 175,
    source: "Índice STR de PriceLabs, zip 33141, 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 66, lowPct: 38 },
    note: "Medido sobre ~900 anuncios activos del zip 33141 (North Beach, donde está 72 Park). La tarifa más alta de la cartera y la estacionalidad más brutal: 66.4% en febrero contra 38.0% en septiembre. Diciembre a marzo se cobra cerca de $400; en verano baja a $284. La tarifa subió 9.4% interanual.",
  },
  {
    key: "hollywood",
    label: "Hollywood",
    match: ["hollywood"],
    adr: 285,
    occupancyPct: 58.9,
    revpar: 168,
    source: "Índice STR de PriceLabs, zip 33019, 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 80, lowPct: 39 },
    note: "Medido sobre ~2,250 anuncios activos del zip 33019 (Hollywood Beach). Ingreso anual estimado de $63,913 por unidad. Febrero llega a 80.5% de ocupación al $368 — el pico más alto de toda la cartera, por encima de Brickell y de Miami Beach. La tarifa subió 13.3% interanual. Hollywood rinde bastante más de lo que se suele asumir.",
  },
  {
    key: "orlando",
    label: "Orlando",
    match: ["orlando", "kissimmee", "davenport", "millenia"],
    adr: 205,
    occupancyPct: 55.3,
    revpar: 113,
    source: "Índice STR de PriceLabs, límite oficial de la ciudad de Orlando, 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 65, lowPct: 43 },
    note: "Medido sobre ~2,100 anuncios activos dentro del límite de la ciudad. Ingreso anual estimado de $44,798 por unidad — el más bajo de la cartera. Febrero llega a 65.4% y agosto cae a 43.0% al $160. Orlando cobra mucho menos por noche que cualquier submercado de Miami: no se compara con Brickell ni con la playa.",
  },
  {
    key: "miami",
    label: "Miami (ciudad)",
    match: ["miami", "downtown", "edgewater", "wynwood", "midtown", "signature district", "health district", "miami river"],
    adr: 247,
    occupancyPct: 59.1,
    revpar: 146,
    source: "Índice STR de PriceLabs, zip 33137 (Edgewater), 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 74, lowPct: 45 },
    note: "Medido sobre ~1,000 anuncios activos del zip 33137. Se usa Edgewater como referencia de Miami continental fuera de Brickell. Cobra $31 menos por noche que Brickell y llena 5 puntos menos (59.1% contra 64.5%), así que rinde por debajo de Brickell en las dos puntas. Marzo llega a 74.3% al $307; agosto cae a 45.0%. La tarifa subió 10.7% interanual.",
  },
  {
    key: "florida",
    label: "Florida (línea base del estado)",
    match: [],
    adr: 295,
    occupancyPct: 57,
    revpar: 168,
    source: "Índice STR de PriceLabs, 12 meses cerrados sep 2025 – ago 2026",
    asOf: "agosto 2026",
    seasonality: { highPct: 66, lowPct: 49 },
    note: "Calculado sobre ~250,000 anuncios activos. Temporada alta (feb-jul) 65.7% de ocupación; temporada baja (ago-ene) 48.5%. Es el respaldo cuando un proyecto no cae en ningún submercado conocido.",
  },
]

export const FLORIDA_BASELINE = STR_MARKETS[STR_MARKETS.length - 1]

/** Best submarket for a project, falling back to the Florida baseline. */
export function lookupStrMarket(neighborhood?: string, city?: string): StrMarket {
  const hay = `${neighborhood || ""} ${city || ""}`.toLowerCase()
  if (!hay.trim()) return FLORIDA_BASELINE
  // Order matters: the city-specific rows are listed before the generic Miami
  // one, whose "downtown" fragment would otherwise swallow Downtown Hollywood.
  for (const m of STR_MARKETS) {
    if (m.match.some(frag => hay.includes(frag))) return m
  }
  return FLORIDA_BASELINE
}


// ─── Building-level comps ───────────────────────────────────────────────────
// A neighborhood average hides a lot: a branded condo-hotel with a rental
// program and 25,000 sqft of amenities does not perform like the median Airbnb
// three blocks away. When a real number exists for the building itself — or for
// the developer's previous building — it beats the submarket average.
//
// These come from the developer presentations Catherine collected, so they are
// the developer's own claims. Labelled as such: quote them as what the
// developer reports, not as independently verified data.

export type BuildingComp = {
  label: string
  /** Lowercased fragments matched against the project name. */
  match: string[]
  adr: number
  occupancyPct: number
  source: string
  note?: string
}

export const BUILDING_COMPS: BuildingComp[] = [
  {
    label: "Palma Miami Beach (comp: 72 Park, mismo desarrollador)",
    match: ["palma"],
    adr: 280,
    occupancyPct: 87,
    source: "Presentación de Lefferts — cifras de 72 Park, su edificio anterior",
    note: "Los $280 por noche son de TEMPORADA BAJA con 87% de ocupación. Es un edificio ya operando del mismo desarrollador, no una proyección, y por eso es el comp más específico de la cartera. PERO hay que decirlo junto al mercado: PriceLabs mide el zip 33141 — el de 72 Park — en 52.5% de ocupación promedio de 12 meses, y su mejor mes del año, febrero, llega a 66.4%. El 87% del desarrollador está 35 puntos por encima del promedio del zip y 21 puntos por encima de su mejor mes. Puede ser real (un edificio nuevo con programa de renta gestionado supera al promedio del vecindario, que incluye inventario viejo), pero es una cifra del vendedor y no está verificada de forma independiente. Presentarla siempre junto al 52.5% del mercado, nunca sola.",
  },
  {
    label: "Meliá Residences Miami",
    match: ["meliá", "melia"],
    adr: 287,
    occupancyPct: 80,
    source: "Presentación de UNCG — ocupación hotelera histórica de la marca Meliá",
    note: "El 80% es la ocupación hotelera que reporta el operador. PriceLabs mide Brickell (zip 33131) en 64.5% de promedio anual, así que el 80% está 15.5 puntos por encima del mercado. Es plausible — la ocupación hotelera de una marca con programa de renta y 20 millones de miembros de lealtad no se mide igual que un Airbnb suelto — pero es cifra del vendedor. Presentarla junto al 64.5% del mercado. La tarifa no la da la presentación, así que se usa la de Brickell ($278).",
  },
]

export function lookupBuildingComp(projectName?: string): BuildingComp | null {
  if (!projectName) return null
  const hay = projectName.toLowerCase()
  return BUILDING_COMPS.find(b => b.match.some(f => hay.includes(f))) || null
}

/**
 * What to actually model, in order of how much it is worth trusting:
 * the building's own numbers, then its submarket, then the state.
 */
export function resolveStrAssumptions(projectName?: string, neighborhood?: string, city?: string): {
  adr: number
  occupancyPct: number
  label: string
  source: string
  level: "building" | "submarket" | "state"
  note?: string
} {
  const b = lookupBuildingComp(projectName)
  if (b) return { adr: b.adr, occupancyPct: b.occupancyPct, label: b.label, source: b.source, level: "building", note: b.note }
  const m = lookupStrMarket(neighborhood, city)
  return {
    adr: m.adr,
    occupancyPct: m.occupancyPct,
    label: m.label,
    source: m.source,
    level: m === FLORIDA_BASELINE ? "state" : "submarket",
    note: m.note,
  }
}

// ─── Long-term rental ───────────────────────────────────────────────────────
// Houses and townhouses in the portfolio are long-term rental plays, not
// short-term ones. Quoting a nightly rate for a Lennar house in Verdana would
// be nonsense: nobody Airbnbs it, it rents by the year.

export const LONG_TERM_COMPS = [
  {
    label: "Luminara (Lennar), plan 8 de 4 recámaras",
    match: ["luminara"],
    monthlyRent: 3200,
    source: "Presentación de Lennar",
  },
  {
    label: "SLB Home Builders, casa reformada en St. Petersburg",
    match: ["slb", "port charlotte"],
    monthlyRent: 3100,
    source: "Presentación de SLB — rango reportado de $2,600 a $3,600",
  },
]

/** True when the project rents by the year, so nightly figures do not apply. */
export function isLongTermPlay(propertyType?: string, projectName?: string): boolean {
  const t = (propertyType || "").toLowerCase()
  if (t.includes("single family") || t.includes("townhouse") || t.includes("villa")) return true
  const n = (projectName || "").toLowerCase()
  return n.includes("lennar") || n.includes("slb")
}

export function lookupLongTermComp(projectName?: string) {
  if (!projectName) return null
  const hay = projectName.toLowerCase()
  return LONG_TERM_COMPS.find(c => c.match.some(f => hay.includes(f))) || null
}

// ─── Appreciation ───────────────────────────────────────────────────────────
// Two different numbers that get confused constantly, so they are stored apart:
// the developer raises its own price list during construction, which is what a
// preconstruction buyer captures; the resale market moves separately, and right
// now it is nearly flat.

export type AppreciationRow = {
  label: string
  match: string[]
  marketYoYPct: number
  source: string
  asOf: string
  note?: string
}

export const DEVELOPER_PRICE_LIST_ESCALATION_PCT = 4

export const APPRECIATION: AppreciationRow[] = [
  {
    label: "Brickell",
    match: ["brickell"],
    marketYoYPct: 1.8,
    source: "CondoBlackBook / BrickellSold, 2026",
    asOf: "2026 año corrido",
  },
  {
    label: "Edgewater",
    match: ["edgewater"],
    marketYoYPct: 1.6,
    source: "CondoBlackBook / BrickellSold, 2026",
    asOf: "2026 año corrido",
  },
  {
    label: "Miami (condos de lujo)",
    match: ["miami", "downtown", "wynwood", "miami beach", "north beach"],
    marketYoYPct: 2.3,
    source: "CondoBlackBook, Q1 2026",
    asOf: "Q1 2026",
    note: "El precio mediano de venta subió 2.3% interanual, pero el precio por pie cuadrado BAJÓ 3.7% en el mismo periodo. O sea: se están vendiendo unidades más grandes, no unidades más caras por pie.",
  },
]

export function lookupAppreciation(neighborhood?: string, city?: string): AppreciationRow | null {
  const hay = `${neighborhood || ""} ${city || ""}`.toLowerCase()
  if (!hay.trim()) return null
  for (const row of APPRECIATION) if (row.match.some(f => hay.includes(f))) return row
  return null
}

/**
 * The block both Catherine-facing agents get, so neither invents a number.
 * Deliberately terse: it rides on every request, and the verbose per-market
 * notes are available through `str_market_detail` when a number needs context.
 */
export function strMarketContext(): string {
  const rows = STR_MARKETS.map(m =>
    `• ${m.label}: $${m.adr}/noche, ${m.occupancyPct}% ocupación (${m.source})`
  ).join("\n")

  const comps = BUILDING_COMPS.map(b =>
    `• ${b.label}: $${b.adr}/noche, ${b.occupancyPct}% (${b.source})`
  ).join("\n")

  const lt = LONG_TERM_COMPS.map(c => `• ${c.label}: $${c.monthlyRent.toLocaleString()}/mes`).join("\n")

  const apr = APPRECIATION.map(a => `• ${a.label}: ${a.marketYoYPct}% interanual`).join("\n")

  return `
RENTA CORTA — datos reales a ${STR_ASOF}. Úsalos siempre en vez de inventar una tarifa u ocupación, y cita la fuente:
${rows}

DATOS DEL EDIFICIO — mandan sobre el promedio del barrio. Son cifras que reporta el desarrollador, preséntalas como tal:
${comps}

RENTA LARGA — las casas y townhouses (Lennar, SLB) NO son renta corta: se rentan por año, no les apliques tarifa por noche ni ocupación de Airbnb.
${lt}

VALORIZACIÓN — son DOS números distintos y no se mezclan:
1. La lista de precios del desarrollador sube ~${DEVELOPER_PRICE_LIST_ESCALATION_PCT}% en cada nueva lista durante la obra. Eso sí lo captura el comprador en preconstrucción, porque firmó al precio viejo.
2. La reventa va aparte y hoy está casi plana:
${apr}
Di siempre cuál de las dos estás citando. Prometer 4% anual de valorización de mercado en Miami hoy sería faltar a la verdad.

Si un proyecto no cae en ningún submercado, usa la línea base de Florida y dilo. Para el contexto completo de un mercado (estacionalidad, advertencias, cómo se calculó), llama a str_market_detail.`
}

/** The full notes behind each figure, for when a number needs explaining. */
export function strMarketDetail(): string {
  const rows = STR_MARKETS.map(m => [
    `${m.label}: $${m.adr}/noche, ${m.occupancyPct}% de ocupación${m.revpar ? `, RevPAR $${m.revpar}` : ""} (${m.source})`,
    m.seasonality ? `  Temporada alta ${m.seasonality.highPct}% / baja ${m.seasonality.lowPct}%` : "",
    m.note ? `  ${m.note}` : "",
  ].filter(Boolean).join("\n")).join("\n")

  const comps = BUILDING_COMPS.map(b =>
    `${b.label}: $${b.adr}/noche, ${b.occupancyPct}% (${b.source})${b.note ? `\n  ${b.note}` : ""}`
  ).join("\n")

  const apr = APPRECIATION.map(a =>
    `${a.label}: ${a.marketYoYPct}% interanual (${a.source}, ${a.asOf})${a.note ? `\n  ${a.note}` : ""}`
  ).join("\n")

  return [`SUBMERCADOS\n${rows}`, `EDIFICIOS\n${comps}`, `VALORIZACIÓN DE REVENTA\n${apr}`].join("\n\n")
}
