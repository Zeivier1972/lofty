export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail, wrapEmail } from "@/lib/email"
import { randomUUID } from "crypto"
import { buildProjectContext, buildMarketInsightsContext, buildStrMarketContext, getProjectDetail } from "@/lib/preconstruction-context"
import { DEFAULTS as ANALYSIS_DEFAULTS, analyze as runAnalysis } from "@/lib/investment-analysis"
import { resolveStrAssumptions, lookupAppreciation, isLongTermPlay, lookupLongTermComp, strMarketDetail } from "@/lib/str-market-data"
import { loadPortfolio, findProject, priceOf, explainMiss } from "@/lib/portfolio-lookup"
import { project as runProjection, assignmentScenario, PROJECTION_DEFAULTS } from "@/lib/investment-projection"
import { compare as compareInvestments, GOAL_LABELS, ClientGoal } from "@/lib/investment-compare"
import { describeOpenAIError, isOutOfCredit, parseOpenAIError } from "@/lib/openai-errors"
import { compareCop, cop, copShort, COP_TODAY, COP_TODAY_ASOF, COP_PEAK, COP_PEAK_LABEL } from "@/lib/cop-exchange"

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
}

const SYSTEM_PROMPT = `Eres un asesor experto en inversiones inmobiliarias en Miami y el sur de la Florida. Trabajas con Catherine Gómez Realtor y ayudas a analizar proyectos de preconstrucción, calcular ROI, evaluar vecindarios y asesorar a inversionistas colombianos y latinos.

ÁREAS DE EXPERTISE:
- Proyectos de preconstrucción en Miami: Brickell, Edgewater, Wynwood, Doral, Aventura, Sunny Isles, Miami Beach, Coral Gables
- Cálculo de ROI para alquiler corto plazo (Airbnb) y largo plazo
- Financiamiento para compradores extranjeros: requisitos, bancos, down payment (típicamente 30-50% para no residentes)
- Due diligence: reputación del desarrollador, historial de proyectos, contratos, depósitos en escrow
- Impuestos para extranjeros: FIRPTA, ITIN, implicaciones fiscales en Colombia vs USA
- Mercado de Miami: tendencias, cap rates, vacantes, flujo de turistas
- Estrategias: compra en preconstrucción, asignación de contratos, reventa al completar

DATOS DEL MERCADO MIAMI 2024-2025:
- Cap rate long-term rental: 3-5% Miami Beach/Brickell, 5-7% Doral/Kendall
- Airbnb: 65-80% occupancy en zonas turísticas, $150-$400/noche promedio
- Apreciación anual histórica: 8-12% sur de la Florida
- Down payment extranjeros: 30-50% según banco
- Condo fees lujo: $500-$2,000/mes
- Property tax: ~1-1.5% del valor anual

LOS 5 INDICADORES — ASÍ SE EVALÚA UNA INVERSIÓN (metodología de Catherine, del coaching de Álvaro Rojas):
Cuando analices cualquier propiedad, calcula estos cinco y clasifica cada uno contra su rango. Muéstralos en tabla y di siempre si el número es Bajo, Aceptable, Bueno o Muy Bueno — el cliente necesita saber qué significa la cifra, no solo verla.

1. NOI (Ingreso Operativo Neto) = Ingresos operativos − Gastos operativos. Cuánto produce SIN la deuda.
2. CASH FLOW = Ingresos operativos − Gastos totales (incluyendo la hipoteca). Cuánto dinero queda después de pagar la deuda.
3. CASH ON CASH RETURN % = Flujo de caja anual / Capital invertido. Retorno sobre el capital que el cliente realmente puso.
   Rangos: <6% Bajo · 6-8% Aceptable · 8-10% Bueno · >10% Muy Bueno
4. ROI % = (Cash Flow anual + Valorización + Pago a capital de la hipoteca − Gastos de cierre) / Down Payment. Qué tan eficiente fue su dinero para generar ganancia.
   Rangos: <5% Bajo · 5-10% Aceptable · 10-15% Bueno · >15% Muy Bueno
5. CAP RATE % = NOI anual / Valor de la propiedad. Rendimiento del inmueble sobre su valor — lo que genera si la compra 100% de contado.
   Rangos: <4% Bajo · 4-6% Aceptable · 6-8% Bueno · >8% Muy Bueno

Supuestos base para modelar preconstrucción en Miami (ajústalos si el proyecto trae los suyos):
- Gastos operativos mensuales: property management 20% del ingreso · taxes 1.8% anual del precio ÷ 12 · HOA según $/sqft del proyecto · seguro ~$100
- Gastos de cierre: 5.4% del precio
- Valorización durante la obra: ~4% por entrega de lista de precios
- Para el comprador colombiano: la conversión a pesos es OBLIGATORIA, no opcional. Es el argumento que no aparece en ninguno de los cinco indicadores y el que más le pega a este público. NUNCA la calcules de cabeza ni cites una tasa de memoria: usa la herramienta convert_to_pesos, o el bloque EN PESOS COLOMBIANOS que ya trae analyze_investment. La tasa vive en el código y se actualiza; cualquier cifra que te inventes va a estar vieja.
- Y di siempre las dos direcciones: cuánto menos cuesta hoy que cuando el dólar estaba alto (2022-2023, rondando 4.800 — no lo llames "el pico", que en 2022 pasó de 5.000 y un cliente informado te corrige), Y qué pasa con la cuota si el peso se devalúa otra vez. La cuota de la hipoteca es en dólares. Un cliente que solo oye el lado bueno se siente engañado después, y Catherine pierde el referido.

DESARROLLADORES CLAVE:
- Related Group, Ugo Colombo/CMC Group, OKO Group, Melo Group, Swire Properties, Fortune International, Chateau Group

PROYECTOS EN EL PORTAFOLIO DE CATHERINE (2024-2025):
- River District 14 — Doral, desde $400K, condos en comunidad cerrada
- Millenia Park — Doral/área Mall of the Americas, acceso a amenidades premium
- Twenty-Sixth & Second — Wynwood/Edgewater, unidades boutique en área artística
- Visions — proyecto con enfoque en rentabilidad a corto/largo plazo
- 72 Park — Miami Beach, lujo frente al mar, alta demanda turística
- Waldorf Astoria Residences — Downtown Miami, desde ~$700K, marca icónica
- The Williams — proyecto residencial en zona de alta apreciación
- Edge House — diseño contemporáneo, ideal inversión Airbnb
- Okan Tower — Downtown, uso mixto residencial+hotel, torre icónica
- Nickelodeon Residences — Punta Cana (resort), retorno por alquiler vacacional
- Domus Brickell Center — Brickell, condo-hotel con programa de alquiler gestionado

CAPACIDADES ADICIONALES:
- Genera scripts para WhatsApp listos para copiar y pegar (en español)
- Crea hooks de anuncio para Facebook/Instagram si se te pide
- Usa tablas en markdown para comparar proyectos
- Responde en español o inglés según el idioma del usuario
- Puedes buscar proyectos y precios actuales en preconstruction.miami usando la herramienta de búsqueda web

FORMATO DE RESPUESTA — Catherine le muestra esta pantalla a sus clientes, así que la organización importa tanto como el contenido:
- Siempre que presentes DOS O MÁS proyectos, hazlo en una tabla de markdown. Nunca como párrafos ni como lista.
- Columnas por defecto: Proyecto | Zona | Desarrollador | Precio | Entrega | Renta/noche | Ocupación | Cash on cash. Ajusta las columnas a lo que preguntó Catherine, pero nunca dejes una columna llena de guiones: si no tienes el dato para ninguna fila, quita la columna entera.
- Deja los números limpios y comparables: $540,000 y no 540000; 7.1% y no 0.071.
- Nunca pongas URLs largas dentro de una celda — rompen la tabla. Las fuentes van debajo, en una línea aparte.
- Después de la tabla, escribe SIEMPRE una recomendación de una o dos frases: cuál conviene y por qué. La tabla informa; la recomendación es lo que Catherine necesita para vender.
- Usa negrita solo para el nombre del proyecto que recomiendas y para las cifras clave.
- Nada de "Siguientes Pasos" genéricos. Si hace falta un paso, que sea uno concreto y accionable.
- Cuando una herramienta te devuelva un enlace que empiece por /api/, cópialo TAL CUAL en tu respuesta, en su propia línea. Es el Excel del análisis y se renderiza como botón de descarga. No lo reescribas, no lo acortes y no cambies sus parámetros: llevan exactamente los supuestos con los que calculaste.

DE DÓNDE SACAS LOS PROYECTOS — en este orden, sin excepción:
1. La cartera de Catherine que aparece más abajo en el contexto. Es la fuente autoritativa: son los proyectos que ella vende, con comisión, precios negociados y planes de pago reales.
2. Solo si la cartera no tiene nada que sirva para lo que pidió Catherine, busca en la web — y dilo explícitamente: "en tu cartera no hay nada que encaje, esto lo encontré en línea".
NUNCA presentes un proyecto de búsqueda web junto a uno de la cartera sin marcar cuál es cuál. Y nunca escribas "Desarrollador: Desconocido" para un proyecto que sí está en la cartera: si aparece como desconocido, es que estás leyendo la web en vez del contexto.
Si la cartera aparece vacía, dilo de frente: "no veo proyectos cargados en tu cartera" — no lo disimules buscando en la web.

NUNCA le digas a Catherine que verifique un dato "con Catherine", ni que vaya a la página de Pre-Construcción, ni a /new-construction, ni a ningún otro lado a buscar información suya. Ella ES la fuente. Si te falta un dato (el precio de una unidad, los pies cuadrados, el HOA), PÍDESELO directamente en una frase: "¿cuántos pies cuadrados tiene esa unidad?". Si no sabes si un proyecto está en la cartera, usa list_portfolio y míralo — no lo supongas ni la mandes a verificarlo.

REGLAS:
- Habla en el idioma del usuario (español o inglés)
- Sé directo — Catherine necesita datos accionables para cerrar ventas
- Incluye números: precios, ROI%, plazos, fees, down payment
- Si no tienes datos exactos, usa rangos del mercado y dilo claramente
- Para ROI, muestra el cálculo paso a paso con supuestos claros
- Siempre menciona riesgos relevantes (developer risk, mercado, tipo de cambio)
- Prioriza proyectos del portafolio de Catherine cuando sean relevantes
- Cuando busques en la web, cita la fuente y la fecha de los datos
- IMÁGENES: cuando recomiendes un proyecto de la cartera de Catherine que tenga una "Foto:" en su ficha, incluye la imagen en tu respuesta con markdown exactamente así: ![Nombre del proyecto](URL_DE_LA_FOTO). Así Catherine puede mostrarle la foto al lead. Si un resultado de la web trae una URL de imagen clara (.jpg/.png/.webp), puedes incluirla igual. No inventes URLs de imágenes. No uses imágenes que tengan el logo, marca de agua o branding de otro corredor.
- MARCA / BRANDING (CRÍTICO): toda la información que entregas es de parte de **Catherine Gómez Realtor**. Puedes usar sitios de otros corredores (p. ej. dianajimenezproperty.com) SOLO como fuente de datos de proyectos, pero NUNCA muestres el nombre, agente, empresa, teléfono, email, enlace ni marca de ningún otro corredor o sitio de la competencia. Elimina cualquier branding ajeno y presenta todo como si fuera de Catherine. Si el lead quiere más info o ver los proyectos, dirígelo a la página de Catherine (/new-construction) y a agendar con Catherine — nunca a la competencia.
- GUARDAR PROYECTOS: cuando encuentres (vía búsqueda web, con fuente real) un proyecto de nueva construcción que NO esté ya en la cartera de Catherine y sea relevante, dile a Catherine que puedes agregarlo a su inventario; si te lo pide o si claramente vale la pena, usa la herramienta save_project para guardarlo (aparecerá en su página de Pre-Construcción y en /new-construction, marcado "por revisar"). NUNCA guardes proyectos inventados — solo reales y con fuente. Quita todo branding de la competencia antes de guardar. Después de guardar, dile a Catherine que revise/afine los datos y agregue fotos.

BÚSQUEDA EXHAUSTIVA DE PROYECTOS (MUY IMPORTANTE):
- Cuando te pregunten por proyectos disponibles, opciones de inversión, o "qué hay" en una zona/rango de precio, NO respondas solo de memoria: USA la herramienta de búsqueda web.
- Haz VARIAS búsquedas en la misma respuesta para ser exhaustivo, no una sola. Por ejemplo, busca por: (a) cada vecindario relevante ("preconstruction condos Brickell 2026", "new developments Edgewater", "Doral preconstruction"), (b) el rango de precio del lead, (c) por desarrollador, y (d) "new preconstruction Miami" en general.
- Combina los resultados de todas las búsquedas + el portafolio de Catherine + tu conocimiento en UNA lista completa. Marca claramente cuáles son del portafolio de Catherine.
- Si una búsqueda no da resultados, reformula y vuelve a intentar con otros términos antes de rendirte.
- Presenta los proyectos en una tabla (nombre, zona, desarrollador, precio desde, entrega, ROI estimado, fuente) y sé claro sobre qué datos son actuales (de la web) vs rangos generales del mercado.

MARCO DE CALIFICACIÓN DEL INVERSIONISTA ("Florida como destino inmobiliario" — TENLO SIEMPRE PRESENTE):
Este es el cuestionario que Catherine usa para calificar a inversionistas. IMPORTANTE: hablas CON Catherine (la agente), NO con el lead — NUNCA la interrogues ni respondas solo con preguntas. SIEMPRE da primero tu análisis/recomendación útil con lo que haya (usa supuestos razonables y dilo claramente). Solo DESPUÉS, y solo si de verdad faltan datos importantes, agrega al final de forma breve y OPCIONAL un máximo de 2-3 preguntas que Catherine podría hacerle al lead para afinar. Nunca conviertas tu respuesta en un cuestionario. Las áreas (solo para tu referencia):
1. ¿QUÉ? — ¿Es para Inversión, Vacacional o Vivienda propia? ¿Cuántas recámaras? ¿Tipo: Casa, Apartamento o TownHouse?
2. ¿DÓNDE? — ¿En qué zona/ciudad le interesa? (si no sabe, sugiérele según su objetivo y presupuesto)
3. ¿POR QUÉ? — Su motivación real: plusvalía, rentabilidad/renta, uso propio, diversificar patrimonio, residencia, etc.
4. ¿PARA CUÁNDO? — Su horizonte de compra (ahora, en meses, 1+ año).
5. ¿CUÁNTO? — Presupuesto total, ¿necesita financiación (sí/no)?, y ¿cuánto tiene disponible para el enganche/inicial?
6. DECISIÓN — ¿Quién decide la compra: Solo, en Pareja, o con un Socio?
Si el perfil del lead ya trae datos (presupuesto, zona, propósito, plazo), úsalos y NO preguntes por ellos. Tu prioridad SIEMPRE es dar valor concreto (proyectos, ROI, estrategia, comparativas); las preguntas son un extra corto y opcional al final, jamás el cuerpo de la respuesta. Cierra con un siguiente paso accionable (cotización, presentación, tour, o agendar con Catherine).`

const EMAIL_TOOL = {
  type: "function" as const,
  function: {
    name: "send_email",
    description: "Send an email to the selected lead or a specified address with investment information, project details, ROI summaries, or any content from this conversation. This tool CANNOT attach files — it sends text only. Never write \"attached\", \"adjunto\", \"please find enclosed\" or anything implying a file travels with the message; put the actual numbers in the body instead. Do not use this tool to hand Catherine something she asked to see here: answer her in the chat. Email is for writing to a client.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Email address to send to. Use 'contact' to send to the currently selected lead, or provide an explicit email address.",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body in plain HTML. Can include project details, ROI tables, comparisons, WhatsApp scripts, etc.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
}

const SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "search_web",
    description: "Search preconstruction.miami and other Miami real estate sources for current project listings, pricing, availability, and developer info",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'River District 14 Doral prices' or 'new preconstruction condos Brickell 2025'",
        },
      },
      required: ["query"],
    },
  },
}

const SAVE_PROJECT_TOOL = {
  type: "function" as const,
  function: {
    name: "save_project",
    description: "Save a REAL new-construction/pre-construction project you found (via web search, with a real source) into Catherine's own project inventory. It will appear on Catherine's Pre-Construction page and her public /new-construction page. Only save genuine projects you actually found — never invented ones. Do NOT include any competitor realtor's name/branding. Do not duplicate a project already in Catherine's portfolio.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project/building name, e.g. 'Edge House Edgewater'" },
        developer: { type: "string", description: "Developer/builder if known" },
        neighborhood: { type: "string", description: "Neighborhood, e.g. 'Edgewater'" },
        city: { type: "string", description: "City, default 'Miami'" },
        priceMin: { type: "number", description: "Starting price in USD (number only)" },
        priceMax: { type: "number", description: "Top price in USD if known" },
        bedrooms: { type: "string", description: "Bedroom range, e.g. 'Studio-3'" },
        deliveryDate: { type: "string", description: "Estimated delivery/completion, e.g. '2027'" },
        estimatedROI: { type: "string", description: "Estimated ROI if known, e.g. '6-8%'" },
        downPayment: { type: "string", description: "Typical down payment, e.g. '30-40%'" },
        description: { type: "string", description: "Short neutral description (no competitor branding)" },
        investmentHighlights: { type: "string", description: "Key investment points" },
        sourceUrl: { type: "string", description: "The source URL where you found this project (for Catherine's reference; not shown to leads)" },
      },
      required: ["name"],
    },
  },
}

const DETAIL_TOOL = {
  type: "function" as const,
  function: {
    name: "get_project_details",
    description: "Full stored record for one or more projects: amenities, the complete payment schedule, the description and the selling points. The portfolio in your context is a summary — call this before describing a project in depth, quoting its payment plan, or writing anything a client will read about it. Never describe amenities or terms from memory.",
    parameters: {
      type: "object",
      properties: {
        projects: { type: "array", items: { type: "string" }, description: "Project names, as they appear in the portfolio. Up to 6." },
      },
      required: ["projects"],
    },
  },
}

const MARKET_DETAIL_TOOL = {
  type: "function" as const,
  function: {
    name: "str_market_detail",
    description: "The full notes behind the rental figures: seasonality, how each number was measured, caveats, and where the appreciation rates come from. Call it when Catherine asks why a number is what it is, or when a figure needs context before you put it in front of a client.",
    parameters: { type: "object", properties: {}, required: [] },
  },
}

const PORTFOLIO_TOOL = {
  type: "function" as const,
  function: {
    name: "list_portfolio",
    description: "List exactly what is loaded in Catherine's project inventory right now, with each project's price and whether it can be analyzed. Use it when Catherine asks what she has, when a project you expected is missing, or before telling her anything is not in her portfolio — answer from this, never from memory or from the web.",
    parameters: { type: "object", properties: {}, required: [] },
  },
}

// Catherine va a estar frente a público colombiano y le van a preguntar "¿y
// eso cuánto es en pesos?" sobre cualquier cifra, no solo sobre el precio.
const COP_TOOL = {
  type: "function" as const,
  function: {
    name: "convert_to_pesos",
    description: "Convert any US dollar figure into Colombian pesos and show what it costs today versus at the peak of the dollar. Use it whenever Catherine or a client asks what something costs in pesos, how much they save because of the exchange rate, or wants a figure in their own currency — a price, a down payment, a monthly cash flow, a ten-year profit, anything. Always state whether the comparison is against the historical peak or against a rate the client actually paid: they are very different claims.",
    parameters: {
      type: "object",
      properties: {
        usd: { type: "number", description: "The dollar amount to convert." },
        label: { type: "string", description: "What this figure is, e.g. 'el precio del apartamento', 'la cuota inicial', 'el flujo mensual'. Used in the wording." },
        rateAtPurchase: { type: "number", description: `Only pass this when the client states the rate he actually bought dollars at. Left out, it uses ${COP_PEAK} — the historical peak — and the answer must say it is the peak, not what he paid.` },
        rateToday: { type: "number", description: `Only pass this when Catherine states today's TRM. Left out, it uses ${COP_TODAY} as of ${COP_TODAY_ASOF}.` },
      },
      required: ["usd"],
    },
  },
}

const COMPARE_TOOL = {
  type: "function" as const,
  function: {
    name: "compare_investments",
    description: "Rank several projects from Catherine's portfolio against one client's actual situation and goal, and say which is the better investment FOR THAT CLIENT. Use it whenever Catherine asks which project suits a lead, or to compare two or more projects. A buyer who needs monthly income and one parking capital for five years should get different answers from the same inventory, and this weights the indicators accordingly. Pass the unit size or the monthly HOA for each project — without one of the two a project cannot be scored and will be dropped silently, so say which ones you could not score.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string", enum: ["flujo", "valorizacion", "uso_propio", "balanceado"], description: "What the client is actually after: monthly cash flow, appreciation and exit, personal use with rental income, or balanced." },
        capitalAvailable: { type: "number", description: "Cash the client has, all in — down payment plus closing costs." },
        budgetMax: { type: "number", description: "Top price the client will consider." },
        horizonYears: { type: "number", description: "Years until they expect to sell. Defaults to 5." },
        candidates: {
          type: "array",
          description: "The projects to compare. Include every one worth considering, not just two.",
          items: {
            type: "object",
            properties: {
              project: { type: "string", description: "Project name as it appears in the portfolio." },
              sqft: { type: "number", description: "Unit size in square feet." },
              hoaMonthly: { type: "number", description: "Monthly HOA in USD, if the size is unknown." },
              price: { type: "number", description: "Unit price, if different from the project's starting price." },
              monthlyRent: { type: "number", description: "Expected monthly rent, for houses and townhouses." },
            },
            required: ["project"],
          },
        },
      },
      required: ["goal", "candidates"],
    },
  },
}

const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_investment",
    description: "Run Catherine's 5-indicator investment model (NOI, cash flow, cash on cash, ROI, cap rate) on a project and return the numbers with their rating. Use it whenever Catherine asks what a project returns, or wants to compare two projects with real numbers. When you omit nightlyRate and occupancyPct it uses the real figures for that building, or failing that its submarket, from the market data in your system context. Never guess these: omit them and the tool uses real measured market data, and cite the source it returns, saying whether it is a building number or a neighborhood average. The tool hands you a download link for the Excel at the end of its output — end your answer with that link exactly as given. Do not tell Catherine to go find a button anywhere; the link is how she gets the file.",
    parameters: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project name as it appears in Catherine's portfolio. Omit if you are pricing a unit that is not in the portfolio and pass price instead." },
        price: { type: "number", description: "Unit price in USD. Defaults to the project's priceMin." },
        sqft: { type: "number", description: "Interior square feet. Pass this OR hoaMonthly — one of the two is needed for the expenses." },
        hoaMonthly: { type: "number", description: "Monthly HOA in USD. Use when the unit size is unknown; it replaces sqft entirely." },
        horizonYears: { type: "number", description: "Years until the client expects to sell. Defaults to 5." },
        nightlyRate: { type: "number", description: "ONLY pass this when Catherine states a nightly rate herself, or asks for a what-if at a specific rate. Never estimate, research or infer it: leaving it out makes the tool use the real measured rate for that building or submarket, which is what the numbers must be built on. A rate you supplied is flagged as a manual assumption in the output." },
        occupancyPct: { type: "number", description: "ONLY pass this when Catherine states an occupancy herself, or asks for a what-if at a specific number. Never estimate it and never borrow another project's figure: leaving it out makes the tool use the real measured occupancy for that building or submarket. A number you supplied is flagged as a manual assumption in the output." },
        downPaymentPct: { type: "number", description: "Down payment as a decimal, e.g. 0.4 for 40%." },
        hoaPerSqft: { type: "number", description: "Monthly HOA in USD per square foot." },
        mortgageRatePct: { type: "number", description: "Mortgage rate, e.g. 6.5. Use 7-8 for a foreign national loan if that is the case." },
        appreciationPeriods: { type: "number", description: "How many price-list releases remain before delivery." },
        monthlyRent: { type: "number", description: "Expected monthly rent in USD. Use this INSTEAD of nightlyRate for houses and townhouses (Lennar, SLB) — those are long-term rental plays and a nightly rate does not apply." },
        copRateAtPurchase: { type: "number", description: "COP per USD at the earlier reference point." },
        copRateToday: { type: "number", description: "COP per USD today." },
      },
      required: [],
    },
  },
}

async function tavilySearch(query: string, apiKey: string): Promise<string> {
  // Extensive search by default: "advanced" depth + more results. Domains are
  // configurable (comma-separated) so Catherine can add sources without a code
  // change; leave TAVILY_INCLUDE_DOMAINS empty to search the whole web.
  const depth = process.env.TAVILY_SEARCH_DEPTH || "advanced"
  const maxResults = Number(process.env.TAVILY_MAX_RESULTS || 12)
  const domainsRaw = process.env.TAVILY_INCLUDE_DOMAINS ?? "preconstruction.miami,dianajimenezproperty.com"
  const includeDomains = domainsRaw.split(",").map(d => d.trim()).filter(Boolean)
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: depth,
        max_results: maxResults,
        include_answer: true,
        ...(includeDomains.length ? { include_domains: includeDomains } : {}),
      }),
    })
    if (!resp.ok) return `Search unavailable (status ${resp.status})`
    const data = await resp.json()
    const results: any[] = data.results || []
    if (results.length === 0) return `No results found for "${query}". Try a broader query or a different neighborhood/price range.`
    const answer = data.answer ? `RESUMEN: ${data.answer}\n\n` : ""
    return answer + results
      .map(r => `**${r.title}**\nURL: ${r.url}\n${r.content?.slice(0, 900) || ""}`)
      .join("\n\n---\n\n")
  } catch (e: any) {
    return `Search error: ${e.message}`
  }
}

function simulateSSE(content: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`
        )
      )
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured in Railway. Add it to your Railway environment variables." },
      { status: 503 }
    )
  }

  const tavilyKey = process.env.TAVILY_API_KEY || ""

  const { messages, contactId } = await req.json()
  if (!Array.isArray(messages)) return NextResponse.json({ error: "messages required" }, { status: 400 })

  const contextLines: string[] = []

  if (contactId) {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          firstName: true, lastName: true, email: true,
          buyerBudgetMin: true, buyerBudgetMax: true,
          buyerLocation: true, buyerPropertyType: true,
          buyerPurpose: true, buyerTimelineMonths: true, buyerMustHaves: true,
        },
      })
      if (contact) {
        contextLines.push(`LEAD EN ANÁLISIS: ${contact.firstName} ${contact.lastName || ""}${contact.email ? ` (email: ${contact.email})` : ""}`)
        if (contact.buyerBudgetMin || contact.buyerBudgetMax) {
          const min = contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()}` : "?"
          const max = contact.buyerBudgetMax ? `$${contact.buyerBudgetMax.toLocaleString()}` : "?"
          contextLines.push(`Presupuesto: ${min} – ${max}`)
        }
        if (contact.buyerLocation) contextLines.push(`Área de interés: ${contact.buyerLocation}`)
        if (contact.buyerPropertyType) contextLines.push(`Tipo buscado: ${contact.buyerPropertyType}`)
        if (contact.buyerPurpose) contextLines.push(`Propósito: ${contact.buyerPurpose}`)
        if (contact.buyerTimelineMonths) contextLines.push(`Plazo: ${contact.buyerTimelineMonths} meses`)
        if (contact.buyerMustHaves) contextLines.push(`Must-haves: ${contact.buyerMustHaves}`)
      }
    } catch {}
  }

  contextLines.push(buildStrMarketContext())

  const insights = await buildMarketInsightsContext()
  if (insights) contextLines.push(insights)
  contextLines.push(...await buildProjectContext())

  const systemContent = contextLines.length > 0
    ? `${SYSTEM_PROMPT}\n\n---\nCONTEXTO ACTUAL:\n${contextLines.join("\n")}`
    : SYSTEM_PROMPT

  const openaiMessages = [
    { role: "system", content: systemContent },
    ...messages.slice(-20),
  ]

  const tools: any[] = [EMAIL_TOOL, SAVE_PROJECT_TOOL, ANALYSIS_TOOL, COP_TOOL, COMPARE_TOOL, PORTFOLIO_TOOL, DETAIL_TOOL, MARKET_DETAIL_TOOL, ...(tavilyKey ? [SEARCH_TOOL] : [])]

  const callOpenAI = (msgs: any[], opts: { stream: boolean; withTools: boolean }) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: msgs,
        ...(opts.withTools && tools.length ? { tools, tool_choice: "auto" } : {}),
        ...(opts.stream ? { stream: true } : {}),
        temperature: 0.6,
        max_tokens: 2000,
      }),
    })

  async function executeToolCall(tc: any): Promise<string> {
    try {
      if (tc.function.name === "get_project_details") {
        const args = JSON.parse(tc.function.arguments || "{}")
        const names = Array.isArray(args.projects) ? args.projects.map(String) : []
        if (names.length === 0) return "Dime qué proyecto quieres. Si no sabes cuáles hay, usa list_portfolio."
        return getProjectDetail(names)
      }

      if (tc.function.name === "str_market_detail") return strMarketDetail()

      if (tc.function.name === "list_portfolio") {
        const all = await loadPortfolio()
        if (all.length === 0) return explainMiss(undefined, { project: null, near: [], portfolioSize: 0, ambiguous: false })
        const lines = [`La cartera de Catherine tiene ${all.length} proyecto(s):`]
        all.forEach(p => {
          const price = priceOf(p)
          lines.push([
            `• ${p.name}`,
            p.neighborhood || p.city ? `(${[p.neighborhood, p.city].filter(Boolean).join(", ")})` : "",
            price ? `desde $${price.toLocaleString()}` : "SIN PRECIO REGISTRADO",
            p.deliveryDate ? `entrega ${p.deliveryDate}` : "",
          ].filter(Boolean).join(" · "))
        })
        const noPrice = all.filter(p => !priceOf(p))
        if (noPrice.length) lines.push(`Sin precio y por lo tanto no analizables: ${noPrice.map(p => p.name).join(", ")}. Pídele el precio a Catherine.`)
        return lines.join("\n")
      }

      if (tc.function.name === "compare_investments") {
        const args = JSON.parse(tc.function.arguments || "{}")
        const all = await loadPortfolio()
        if (all.length === 0) return explainMiss(undefined, { project: null, near: [], portfolioSize: 0, ambiguous: false })

        const skipped: string[] = []
        const candidates = (args.candidates || []).map((c: any) => {
          const m = findProject(all, c.project)
          const rec = m.project
          if (rec && m.ambiguous) { skipped.push(`${c.project}: encaja con ${[rec.name, ...m.near.map((x: any) => x.name)].join(" o ")} — pregúntale a Catherine cuál`); return null }
          if (!rec) { skipped.push(`${c.project}: ${m.near.length ? `no está exacto, ¿será ${m.near.map(p => p.name).join(" o ")}?` : "no está en la cartera"}`); return null }
          if (!priceOf(rec) && !Number(c.price)) { skipped.push(`${rec.name}: está en la cartera pero sin precio — pídeselo a Catherine`); return null }
          if (!c.sqft && (c.hoaMonthly === undefined || c.hoaMonthly === null)) { skipped.push(`${rec.name}: falta el tamaño en pies cuadrados o el HOA mensual`); return null }
          return { project: rec, sqft: Number(c.sqft) || undefined, hoaMonthly: c.hoaMonthly === undefined || c.hoaMonthly === null ? undefined : Number(c.hoaMonthly), price: Number(c.price) || priceOf(rec), monthlyRent: Number(c.monthlyRent) || undefined }
        }).filter(Boolean)

        if (candidates.length === 0) {
          return `No pude comparar ninguno. ${skipped.join(" · ")}. Pídele a Catherine lo que falta — son datos suyos, no la mandes a buscarlos.`
        }

        const ranked = compareInvestments(candidates as any, {
          goal: (args.goal || "balanceado") as ClientGoal,
          capitalAvailable: Number(args.capitalAvailable) || undefined,
          budgetMax: Number(args.budgetMax) || undefined,
          horizonYears: Number(args.horizonYears) || 5,
        })

        const m2 = (n: number) => `$${Math.round(n).toLocaleString()}`
        const lines = [`COMPARACIÓN — objetivo del cliente: ${GOAL_LABELS[(args.goal || "balanceado") as ClientGoal]}${args.budgetMax ? `, presupuesto hasta ${m2(Number(args.budgetMax))}` : ""}${args.capitalAvailable ? `, efectivo disponible ${m2(Number(args.capitalAvailable))}` : ""}`]
        ranked.forEach((x, i) => {
          lines.push([
            `${i + 1}. ${x.name}${x.neighborhood ? ` (${x.neighborhood})` : ""}${x.fits ? "" : "  ⚠️ NO CUADRA CON SU PRESUPUESTO O EFECTIVO"}`,
            `   Precio ${m2(x.price)} · efectivo necesario ${m2(x.cashNeeded)} · flujo ${m2(x.cashFlowMonth)}/mes`,
            `   Cash on cash ${x.cashOnCashPct.toFixed(1)}% · cap rate ${x.capRatePct.toFixed(1)}% · ROI año 1 ${x.roiPct.toFixed(1)}%`,
            `   Si vende al año ${x.horizonYear}: ${m2(x.profitIfSold)} netos, ${x.annualizedPct.toFixed(1)}% anualizado · cediendo el contrato ${x.assignmentReturnPct.toFixed(0)}% sobre depósitos`,
            `   Base: ${x.marketLabel} (${x.marketSource})`,
            x.reasons.length ? `   A favor: ${x.reasons.join(" · ")}` : "",
            x.warnings.length ? `   Ojo: ${x.warnings.join(" · ")}` : "",
          ].filter(Boolean).join("\n"))
        })
        lines.push("")
        lines.push("Enlaces para bajar el Excel de cada uno — inclúyelos tal cual, cada uno en su propia línea, debajo de tu recomendación:")
        ranked.forEach(x => {
          const c = (candidates as any[]).find(y => y.project.name === x.name)
          const qs = new URLSearchParams()
          if (c?.project?.id) qs.set("projectId", c.project.id); else qs.set("name", x.name)
          qs.set("price", String(Math.round(x.price)))
          if (c?.sqft) qs.set("sqft", String(c.sqft))
          if (c?.hoaMonthly !== undefined) qs.set("hoaMonthly", String(c.hoaMonthly))
          qs.set("years", "10")
          lines.push(`[Descargar el Excel de ${x.name}](/api/investment-analysis?${qs.toString()})`)
        })
        if (skipped.length) lines.push(`No pude puntuar: ${skipped.join(" · ")}`)
        lines.push("Dale a Catherine una recomendación clara con el porqué en una frase, no solo la tabla. Si el primero no cuadra con el efectivo del cliente, dilo de entrada.")
        return lines.join("\n")
      }

      if (tc.function.name === "analyze_investment") {
        const args = JSON.parse(tc.function.arguments || "{}")
        const all = await loadPortfolio()
        const match = findProject(all, args.project)
        const projectRecord = match.project

        // Every refusal names what the tool actually found, so the model never
        // has to guess why — and never tells Catherine to verify her own data.
        if (args.project && !projectRecord) return explainMiss(args.project, match)
        if (match.ambiguous && projectRecord) {
          return `"${args.project}" encaja con más de un proyecto: ${[projectRecord.name, ...match.near.map((x: any) => x.name)].join(" · ")}. Pregúntale a Catherine cuál quiere antes de calcular — son proyectos distintos con precios y planes de pago distintos.`
        }

        const price = Number(args.price) || (projectRecord ? priceOf(projectRecord) : undefined)
        const sqft = Number(args.sqft) || undefined
        const hoaMonthly = args.hoaMonthly === undefined || args.hoaMonthly === null ? undefined : Number(args.hoaMonthly)
        if (!price) {
          return projectRecord
            ? `${projectRecord.name} está en la cartera pero NO tiene precio registrado. Pídele a Catherine el precio de la unidad y vuelve a llamarme pasándolo en price — no la mandes a buscarlo a otra página, ella es la dueña de estos datos.`
            : "Falta el precio. Pregúntale a Catherine el precio de la unidad y pásamelo en price."
        }
        if (!sqft && hoaMonthly === undefined) {
          return `Tengo el precio de ${projectRecord?.name || "la unidad"} ($${Number(price).toLocaleString()}), pero me falta el tamaño. Pregúntale a Catherine los pies cuadrados de la unidad (sqft) o el HOA mensual en dólares (hoaMonthly) — con cualquiera de los dos calculo. Es un dato que el deck no trae, así que pregúntaselo directamente en vez de decirle que lo busque.`
        }

        // Building comp beats submarket average beats state baseline.
        const longTerm = isLongTermPlay(projectRecord?.propertyType, projectRecord?.name || args.project)
        const ltComp = longTerm ? lookupLongTermComp(projectRecord?.name || args.project) : null
        const monthlyRent = Number(args.monthlyRent) || ltComp?.monthlyRent
        if (longTerm && !monthlyRent && !Number(args.nightlyRate)) {
          return "Este proyecto es de renta larga (casa o townhouse). Pásame la renta mensual esperada en monthlyRent — una tarifa por noche no aplica aquí."
        }
        const mkt = resolveStrAssumptions(projectRecord?.name || args.project, projectRecord?.neighborhood, projectRecord?.city)
        const apr = lookupAppreciation(projectRecord?.neighborhood, projectRecord?.city)
        // Whether the model handed us its own rent assumptions instead of using
        // the measured ones. The output has to say so where it happens.
        const rateOverridden = !longTerm && Number(args.nightlyRate) > 0
        const occOverridden = !longTerm && Number(args.occupancyPct) > 0
        const a = {
          ...ANALYSIS_DEFAULTS,
          price,
          sqft,
          hoaMonthly,
          downPaymentPct: Number(args.downPaymentPct) || ANALYSIS_DEFAULTS.downPaymentPct,
          nightlyRate: Number(args.nightlyRate) || (longTerm ? monthlyRent! / 30 : mkt.adr),
          occupancyPct: Number(args.occupancyPct) || (longTerm ? 100 : mkt.occupancyPct),
          hoaPerSqft: Number(args.hoaPerSqft) || ANALYSIS_DEFAULTS.hoaPerSqft,
          mortgageRatePct: Number(args.mortgageRatePct) || ANALYSIS_DEFAULTS.mortgageRatePct,
          appreciationPeriods: Number(args.appreciationPeriods) || ANALYSIS_DEFAULTS.appreciationPeriods,
          // Antes esto quedaba vacío si el modelo no pasaba las tasas, y el
          // argumento que más le importa al público colombiano no aparecía.
          copRateAtPurchase: Number(args.copRateAtPurchase) || COP_PEAK,
          copRateToday: Number(args.copRateToday) || COP_TODAY,
        }
        const r = runAnalysis(a)
        const m = (n: number) => `$${Math.round(n).toLocaleString()}`
        return [
          `Análisis de ${projectRecord?.name || "la unidad"} — ${m(price)}, ${sqft} sqft`,
          `Inicial ${m(r.downPayment)} (${(a.downPaymentPct * 100).toFixed(0)}%) · financia ${m(r.financed)}`,
          longTerm
            ? `Renta LARGA: $${monthlyRent!.toLocaleString()} al mes${ltComp ? ` (${ltComp.source})` : ""}. No aplica tarifa por noche ni ocupación de Airbnb.`
            : `Base de mercado (${mkt.level === "building" ? "dato del edificio" : mkt.level === "submarket" ? "submercado" : "línea base de Florida"}): ${mkt.label} — $${mkt.adr}/noche al ${mkt.occupancyPct}% (${mkt.source})${apr ? ` · reventa ${apr.marketYoYPct}% interanual` : ""}`,
          // A supplied rate or occupancy silently replaced the measured one and
          // the numbers below were built on it. Catherine reads these figures to
          // an investor, so an assumption can never look like a measurement.
          !longTerm && (rateOverridden || occOverridden)
            ? `⚠️ SUPUESTO MANUAL, NO DATO DE MERCADO: este análisis NO usa ${rateOverridden && occOverridden ? "la tarifa ni la ocupación medidas" : rateOverridden ? "la tarifa medida" : "la ocupación medida"}. Se calculó con ${rateOverridden ? `$${a.nightlyRate}/noche` : `$${a.nightlyRate}/noche (medido)`} al ${a.occupancyPct}%${occOverridden ? "" : " (medido)"}, contra ${mkt.label} que mide $${mkt.adr}/noche al ${mkt.occupancyPct}%. Dile a Catherine de forma explícita que estas cifras son un supuesto y de dónde salió, y ofrécele correrlo con el dato real. Si el supuesto no salió de ella, vuelve a correrlo sin él.`
            : "",
          `Renta ${m(r.operatingIncome)}/mes ($${a.nightlyRate}/noche al ${a.occupancyPct}%) · gastos operativos ${m(r.operatingExpenses)} · hipoteca ${m(r.mortgage)}`,
          `1. NOI: ${m(r.noiMonth)}/mes, ${m(r.noiYear)}/año`,
          `2. Cash flow: ${m(r.cashFlowMonth)}/mes, ${m(r.cashFlowYear)}/año`,
          `3. Cash on cash: ${r.cashOnCashPct.toFixed(2)}% — ${r.cashOnCashBand}`,
          `4. ROI: ${r.roiPct.toFixed(2)}% — ${r.roiBand} (incluye ${m(r.appreciation)} de valorización y ${m(r.principalYear)} de abono a capital, menos ${m(r.closingCosts)} de cierre)`,
          `5. Cap rate: ${r.capRatePct.toFixed(2)}% — ${r.capRateBand}`,
          (() => {
            const c = compareCop(price, a.copRateAtPurchase, a.copRateToday)
            if (!c) return ""
            const propia = Number(args.copRateAtPurchase) > 0
            return [
              `EN PESOS COLOMBIANOS — el argumento que no aparece en ningún indicador:`,
              `  Hoy a ${c.rateNow.toLocaleString("es-CO")} COP/USD: ${cop(c.copNow)} (${copShort(c.copNow)})`,
              propia
                ? `  A la tasa de ${c.rateHigh.toLocaleString("es-CO")} que te dio Catherine: ${cop(c.copAtHigh)}`
                : `  Al ${COP_PEAK_LABEL}, ${c.rateHigh.toLocaleString("es-CO")} COP/USD: ${cop(c.copAtHigh)}`,
              `  DIFERENCIA A FAVOR: ${cop(c.saving)} (${copShort(c.saving)}), un ${c.savingPct.toFixed(1)}% menos`,
              propia
                ? `  Di que el cliente compró a ${c.rateHigh.toLocaleString("es-CO")}, así que ese ahorro es suyo de verdad.`
                : `  IMPORTANTE: di que es contra la tasa alta de 2022-2023, no "lo que usted pagó". El cliente no pagó a ${c.rateHigh.toLocaleString("es-CO")} salvo que él te diga que sí. La frase honesta es: "este apartamento le cuesta ${copShort(c.saving)} de pesos menos de lo que le habría costado cuando el dólar estaba en ${c.rateHigh.toLocaleString("es-CO")}".`,
              `  Y EL RIESGO, dilo tú antes de que lo pregunten: si el peso se devalúa otra vez a ${c.rateHigh.toLocaleString("es-CO")}, la misma propiedad le costaría ${cop(c.exposureIfBack)} y la cuota de la hipoteca, que es en dólares, le sale ${c.savingPct.toFixed(0)}% más cara en pesos. Es una apuesta en dos direcciones.`,
              `  (TRM de referencia al ${COP_TODAY_ASOF}. Si Catherine dice la tasa del día, úsala y vuelve a correrlo.)`,
            ].join("\n")
          })(),
          (() => {
            const h = Math.max(1, Math.min(Number(args.horizonYears) || 5, PROJECTION_DEFAULTS.years))
            const rows = runProjection(a, { ...PROJECTION_DEFAULTS, marketAppreciationPct: apr?.marketYoYPct ?? PROJECTION_DEFAULTS.marketAppreciationPct })
            const at = rows[h - 1]
            const asg = assignmentScenario(a)
            return [
              `PROYECCIÓN — si vende al año ${h}: la propiedad valdría ${m(at.propertyValue)}, habría cobrado ${m(at.cumulativeCashFlow)} de flujo acumulado, y le quedarían ${m(at.totalProfitIfSold)} netos después de costos de venta y saldo de hipoteca. Eso es ${at.annualizedReturnPct.toFixed(1)}% anualizado.`,
              `CEDER EL CONTRATO antes de cerrar: ganancia neta ${m(asg.netGain)} sobre ${m(asg.depositsPaid)} de depósitos = ${asg.returnOnDepositsPct.toFixed(1)}%. ${asg.caveat}`,
            ].join("\n")
          })(),
          // Built here, not by the model, so the workbook always carries the
          // exact assumptions that produced the numbers just quoted.
          (() => {
            const qs = new URLSearchParams()
            if (projectRecord?.id) qs.set("projectId", projectRecord.id)
            else qs.set("name", projectRecord?.name || args.project || "Análisis de inversión")
            qs.set("price", String(a.price))
            if (a.sqft) qs.set("sqft", String(a.sqft))
            if (a.hoaMonthly !== undefined) qs.set("hoaMonthly", String(a.hoaMonthly))
            qs.set("nightlyRate", String(Math.round(a.nightlyRate)))
            qs.set("occupancyPct", String(a.occupancyPct))
            qs.set("downPaymentPct", String(a.downPaymentPct))
            qs.set("mortgageRatePct", String(a.mortgageRatePct))
            qs.set("appreciationPeriods", String(a.appreciationPeriods))
            if (apr?.marketYoYPct) qs.set("marketAppreciationPct", String(apr.marketYoYPct))
            if (Number(args.horizonYears)) qs.set("years", String(Math.max(Number(args.horizonYears), 10)))
            if (Number(args.copRateAtPurchase)) qs.set("copRateAtPurchase", String(Number(args.copRateAtPurchase)))
            if (Number(args.copRateToday)) qs.set("copRateToday", String(Number(args.copRateToday)))
            return `Termina tu respuesta con este enlace tal cual, en su propia línea, para que Catherine baje el Excel con estos mismos números:\n[Descargar el Excel de este análisis](/api/investment-analysis?${qs.toString()})`
          })(),
        ].filter(Boolean).join("\n")
      }

      if (tc.function.name === "save_project") {
        const p = JSON.parse(tc.function.arguments || "{}")
        if (!p.name?.trim()) return "No pude guardar: falta el nombre del proyecto."
        const SETTING_KEY = "preconstruction_projects"
        const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
        let projects: any[] = []
        if (row) { try { projects = JSON.parse(row.value) } catch {} }
        if (projects.some(x => (x.name || "").trim().toLowerCase() === p.name.trim().toLowerCase())) {
          return `El proyecto "${p.name}" ya está en la cartera de Catherine — no lo dupliqué.`
        }
        const project = {
          id: randomUUID(),
          name: p.name.trim(),
          developer: p.developer?.trim() || "",
          neighborhood: p.neighborhood?.trim() || "",
          city: p.city?.trim() || "Miami",
          priceMin: p.priceMin ? Number(p.priceMin) : undefined,
          priceMax: p.priceMax ? Number(p.priceMax) : undefined,
          bedrooms: p.bedrooms?.trim() || undefined,
          deliveryDate: p.deliveryDate?.trim() || undefined,
          estimatedROI: p.estimatedROI?.trim() || undefined,
          downPayment: p.downPayment?.trim() || undefined,
          description: p.description?.trim() || undefined,
          investmentHighlights: p.investmentHighlights?.trim() || undefined,
          url: p.sourceUrl?.trim() || undefined,
          status: "por_revisar",
        }
        projects.push(project)
        await prisma.setting.upsert({
          where: { key: SETTING_KEY },
          update: { value: JSON.stringify(projects) },
          create: { key: SETTING_KEY, value: JSON.stringify(projects) },
        })
        console.log(`[Investment Advisor] Saved project to portfolio: ${project.name}`)
        return `✅ Guardé "${project.name}" en la cartera de Catherine (marcado "por revisar"). Ya aparece en la página de Pre-Construcción y en /new-construction. Sugiérele a Catherine revisar los datos y agregar fotos.`
      }
      if (tc.function.name === "search_web" && tavilyKey) {
        const { query } = JSON.parse(tc.function.arguments || "{}")
        console.log("[Investment Advisor] Tavily search:", query)
        return await tavilySearch(query, tavilyKey)
      }
      if (tc.function.name === "convert_to_pesos") {
        const { usd, label, rateAtPurchase, rateToday } = JSON.parse(tc.function.arguments || "{}")
        const c = compareCop(Number(usd), Number(rateAtPurchase) || COP_PEAK, Number(rateToday) || COP_TODAY)
        if (!c) return "Necesito una cifra en dólares mayor que cero para convertirla a pesos."
        const propia = Number(rateAtPurchase) > 0
        const qué = label || "esa cifra"
        return [
          `${qué}: $${Number(usd).toLocaleString("en-US")} USD`,
          `  Hoy a ${c.rateNow.toLocaleString("es-CO")} COP/USD: ${cop(c.copNow)} (${copShort(c.copNow)})`,
          propia
            ? `  A ${c.rateHigh.toLocaleString("es-CO")}, la tasa que pagó el cliente: ${cop(c.copAtHigh)}`
            : `  Al ${COP_PEAK_LABEL}, ${c.rateHigh.toLocaleString("es-CO")}: ${cop(c.copAtHigh)}`,
          `  Diferencia: ${cop(c.saving)} (${copShort(c.saving)}), ${c.savingPct.toFixed(1)}% menos`,
          propia
            ? `  Ese ahorro es real y es del cliente: compró dólares a ${c.rateHigh.toLocaleString("es-CO")}.`
            : `  DILO ASÍ, no de otra forma: "${copShort(c.saving)} de pesos menos de lo que habría costado cuando el dólar estaba en ${c.rateHigh.toLocaleString("es-CO")}". No digas "usted ahorró" salvo que el cliente haya comprado a esa tasa.`,
          `  (TRM de referencia al ${COP_TODAY_ASOF}${propia ? "" : `; los ${COP_PEAK.toLocaleString("es-CO")} son la tasa alta de 2022-2023`}.)`,
        ].join("\n")
      }
      if (tc.function.name === "send_email") {
        const { to, subject, body } = JSON.parse(tc.function.arguments || "{}")
        let recipientEmail = to
        if (to === "contact" || !to?.includes("@")) {
          if (!contactId) return "No contact selected and no email address provided. Please specify an email address."
          const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } }).catch(() => null)
          if (!c?.email) return "No email address found for this contact. Please ask for their email address first."
          recipientEmail = c.email
        }
        const html = wrapEmail(body, { agentName: "Catherine Gómez Realtor" })
        const sent = await sendEmail({ to: recipientEmail, subject, html })
        if (sent && contactId) {
          prisma.activity.create({
            data: { type: "EMAIL_SENT", title: `Investment advisor email: ${subject}`, description: `Sent to ${recipientEmail}: ${subject}`, contactId },
          }).catch(() => {})
        }
        return sent ? `Email sent successfully to ${recipientEmail}` : "Failed to send email — check RESEND_API_KEY in Railway."
      }
    } catch (e: any) {
      return `Tool error: ${e.message}`
    }
    return "Tool not available."
  }

  // Multi-round tool loop: let the model search, read results, and search AGAIN
  // A rate limit is transient and OpenAI tells us how long to wait, so waiting
  // is strictly better than handing Catherine an error she cannot act on.
  const callOpenAIWithRetry = async (msgs: any[], opts: { stream: boolean; withTools: boolean }) => {
    let resp = await callOpenAI(msgs, opts)
    for (let attempt = 0; attempt < 2 && resp.status === 429; attempt++) {
      const body = await resp.clone().text().catch(() => "")
      // Un 429 por falta de saldo no se arregla esperando: reintentarlo solo
      // le cuesta a Catherine media hora de reloj antes del mismo error.
      const { code, message } = parseOpenAIError(body)
      if (isOutOfCredit(resp.status, code, message)) {
        console.error("[Investment Advisor] OpenAI sin saldo — no se reintenta")
        break
      }
      const suggested = Number(body.match(/try again in ([\d.]+)s/i)?.[1])
      const waitMs = Math.min(Math.max((Number.isFinite(suggested) ? suggested : 2 ** attempt) * 1000 + 500, 1000), 15000)
      console.warn(`[Investment Advisor] 429 de OpenAI, reintentando en ${Math.round(waitMs)}ms`)
      await new Promise(r => setTimeout(r, waitMs))
      resp = await callOpenAI(msgs, opts)
    }
    return resp
  }

  // (e.g. several neighborhoods / price bands / developers) before writing its
  // answer, so it surfaces as many projects as possible. Bounded to cap cost.
  const MAX_TOOL_ROUNDS = Number(process.env.ADVISOR_MAX_TOOL_ROUNDS || 2)
  const convo: any[] = [...openaiMessages]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await callOpenAIWithRetry(convo, { stream: false, withTools: tools.length > 0 })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      console.error("[Investment Advisor] OpenAI error:", errText)
      return NextResponse.json({ error: describeOpenAIError(resp.status, errText) }, { status: 502 })
    }
    const data = await resp.json()
    const choice = data.choices?.[0]

    if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
      convo.push(choice.message)
      for (const tc of choice.message.tool_calls) {
        const content = await executeToolCall(tc)
        convo.push({ role: "tool", tool_call_id: tc.id, content })
      }
      continue
    }

    // Model answered without needing (more) tools — return its complete answer.
    return simulateSSE(choice?.message?.content || "")
  }

  // Tool budget exhausted while still searching — force a final written answer
  // (streaming, tools off) from everything gathered so far.
  const finalResp = await callOpenAIWithRetry(convo, { stream: true, withTools: false })
  if (!finalResp.ok) {
    const errText = await finalResp.text().catch(() => "")
    console.error("[Investment Advisor] OpenAI error on final pass:", errText)
    return NextResponse.json({ error: describeOpenAIError(finalResp.status, errText) }, { status: 502 })
  }
  return new Response(finalResp.body, { headers: SSE_HEADERS })
}
