import { UNITS, UNITS_AS_OF, type DomusUnit } from "@/app/domus/units"
import { PROJECTS, projectUrl } from "@/lib/projects"

/**
 * What Sofía knows about the project page the visitor is on. The website chat
 * gets this as part of her instructions, so on /domus she answers with the
 * real prices, units, deposit plan and amenities instead of generic Miami
 * talk — and points to the booking calendar on the same page.
 *
 * Facts come from the same sources as the page itself (app/domus/units.ts is
 * the developer's availability list), so the chat and the page never disagree.
 */

const usd = (n: number) => `$${n.toLocaleString("en-US")}`

function domusKnowledge(bookUrl: string): string {
  const byType = (t: DomusUnit["type"]) => UNITS.filter(u => u.type === t)
  const line = (t: DomusUnit["type"]) => {
    const us = byType(t)
    const sizes = us.map(u => u.sqft)
    const cheapest = us.slice(0, 3).map(u => `unidad ${u.unit} (${u.sqft} ft², orientación ${u.exposure}, ${usd(u.price)})`).join("; ")
    return `- ${t}: ${us.length} disponibles, ${Math.min(...sizes)}–${Math.max(...sizes)} pies² interiores, desde ${usd(Math.min(...us.map(u => u.price)))} hasta ${usd(Math.max(...us.map(u => u.price)))}. Las más económicas: ${cheapest}.`
  }
  return `EL VISITANTE ESTÁ EN LA PÁGINA DE DOMUS BRICKELL CENTER. Responde con estos datos (son del desarrollador; no inventes otros):
- Dirección: 1034 SW 2nd Avenue, Miami, FL 33130 (Brickell). Torre de 35 pisos, 579 FLATS totalmente amueblados: estudios, 1 y 2 habitaciones. Servicio tipo hotel.
- Precios (lista del ${UNITS_AS_OF}, ${UNITS.length} unidades disponibles):
${line("Estudio")}
${line("1 habitación")}
${line("2 habitaciones")}
- Capacidad: estudios 2–4 huéspedes, 1 habitación 4, 2 habitaciones 6.
- Plan de depósitos: 10% al contrato, 10% al inicio de construcción, 5% a los 2 meses, 5% a los 4 meses y 5% a los 6 meses del inicio de obra, 65% al cierre (35% antes del cierre). Ej.: estudio de $532,900 → 10% inicial $53,290.
- Cada FLAT: amueblado y terminado, pisos de madera, balcón privado, techos de 9+ pies, cerradura inteligente, electrodomésticos Bosch, encimeras de piedra, lavadora/secadora, agua filtrada UV.
- Amenidades: piscina y terraza panorámica en la azotea, bar en la azotea, cabañas, jacuzzi, deck de yoga, gimnasio interior/exterior, salas de tratamiento, baño de vapor, lounge del vestíbulo con restaurante y bar, jardín, coworking, sala de conferencias, bike share, carga para autos eléctricos, pet friendly.
- Servicios: recepción, valet y atención al cliente 24/7 (valet 30 días gratis al año por 3 años para propietarios), limpieza de hotelería, portal de alquiler para propietarios.
- App Domus y alquiler: check-in móvil y llaves digitales; según el desarrollador conecta con más de 100 plataformas de reservas (1.4 mil millones de vistas mensuales) y alianzas con Hyatt y Marriott (100M+ miembros). NO prometas ingresos, ocupación ni rentabilidad; las reglas de alquiler se confirman con el desarrollador.
- Ubicación: 2 min de Metrorail, Metromover y Southside Park; 5 min Mary Brickell Village; 8 min Brightline; 10 min Brickell City Centre; 18 min aeropuerto de Miami.
- Equipo: North Development (Oak Capital + Edifica), arquitectura Studio Mc+G, interiores Urban Robot, administración North Management, ventas Cervera.
- Fecha de entrega: no está en el material; dile que Catherine la confirma con el desarrollador.
- No hay datos de HOA/mantenimiento ni de rentabilidad: no los inventes; ofrece que Catherine los revise en la llamada.
- No le preguntes si busca preconstrucción o reventa: ya está viendo Domus. Habla de Domus primero.
AGENDAR: en esta misma página está el calendario ("Agende una llamada", más abajo) para elegir día y hora con Catherine por teléfono o Zoom; o el enlace ${bookUrl}. Cuando muestre interés en una unidad, recomiéndale agendar para confirmar disponibilidad.`
}

// Parkside and House of Wellness: written from the facts on their own pages
// (app/parkside/page.tsx, app/house-of-wellness/page.tsx). Next does not let a
// page.tsx export its data, so when a price or date changes there, change it
// here too.

function parksideKnowledge(bookUrl: string): string {
  return `EL VISITANTE ESTÁ EN LA PÁGINA DE PARKSIDE RESIDENCES AT BRICKELL. Responde con estos datos (del desarrollador; no inventes otros):
- Edificio boutique de 8 pisos con 187 residencias amuebladas, frente a Simpson Park en Brickell, Miami. Desarrollador: BI Group USA (30 años, 400+ proyectos, ~95 millones de pies² — antecedentes corporativos, no garantía). Arquitectura e interiores: Kobi Karp.
- Precios (lista del desarrollador del 27 de octubre de 2026): estudios desde $490,000 (417–510 pies², 39–47 m²); 1 habitación desde $582,750 (488–689 pies², incluye opciones Junior 1 habitación); 2 habitaciones desde $1,160,250 (842–992 pies²). Cambian según piso, vista y disponibilidad.
- Plan de depósitos: 20% al firmar ($98,000 en un estudio de $490,000), 10% al top-off (enero de 2027), 10% en abril de 2027 y 60% al cierre. Entrega estimada: primer trimestre de 2028.
- Cada residencia: amueblada, ventanales de piso a techo, cocinas Italkraft, encimeras de cuarzo, electrodomésticos Bosch, lavadora y secadora, baños en porcelanato.
- Amenidades (The Infinity Level, ~16,500 pies²): piscina, spa, gimnasio, estudio de yoga, sala de spinning, coworking lounge, sala de conferencias, health market, lounge exterior con bar.
- Alquiler: programa de administración con Wello (reservaciones, marketing y fotos, distribución en plataformas, ingresos, reportes, atención a huéspedes, limpieza y mantenimiento). Condiciones y costos se confirman con el desarrollador. NO prometas ingresos ni ocupación.
- Ubicación: frente a Simpson Park, cerca de The Underline, Brickell City Centre y el distrito financiero.
- No hay datos de HOA ni de rentabilidad de Parkside: no los inventes; Catherine los revisa en la llamada.
- Dato de MERCADO que sí puedes citar (no es de Parkside, dilo así): según PriceLabs, en Brickell (nov 2025 – oct 2026, estudios y 1 habitación) la ocupación promedio de alquiler a corto plazo fue 63.3% y la tarifa promedio US$229.57 por noche; temporada alta enero–marzo, la más baja en octubre. Para calcular un escenario con sus números: https://www.catherinegomezrealtor.com/parkside/colombia
- Comprar desde Colombia es fácil: no necesita visa ni residencia, todo se firma y se paga a distancia, y los bancos de EE. UU. financian a inversionistas extranjeros — normalmente el comprador aporta cerca del 50% del precio y en algunos proyectos menos (en Parkside, los depósitos antes de la entrega ya son el 40%). Las condiciones dependen del banco y del perfil; no prometas aprobación ni tasas.
- Confianza: Catherine tiene licencia de bienes raíces de Florida #3320405 (verificable en myfloridalicense.com). Los depósitos de hasta el 10% van a una cuenta de garantía (escrow) por ley de Florida (Estatuto 718.202). En la llamada no se pide dinero ni datos bancarios, y puede invitar a su contador o familia.
- Al agendar la presentación por Zoom recibe sin costo: la lista de precios vigente y planos disponibles, su análisis de rentabilidad unidad por unidad y la guía del comprador colombiano.
- No le preguntes si busca preconstrucción o reventa: ya está viendo Parkside.
AGENDAR: en esta página está el formulario "Solicitar mi análisis personalizado" y el botón de WhatsApp; para una llamada con Catherine comparte ${bookUrl}.`
}

function houseOfWellnessKnowledge(bookUrl: string): string {
  return `EL VISITANTE ESTÁ EN LA PÁGINA DE HOUSE OF WELLNESS BRICKELL. Responde con estos datos (no inventes otros):
- 152 SW 9th Street, Brickell, Miami: junto a The Underline, a una cuadra de Brickell City Centre, con tren directo al aeropuerto. Torre de 34 pisos, 656 residencias, más de 22,000 pies² de amenidades de bienestar. Desarrollador: North Development (Oak Capital + Edifica).
- Precios: estudios con balcón desde $419,900 (371 pies², 34 m²). 1 habitación y 2 habitaciones (620 pies², 58 m²): el precio depende del piso y la vista; Catherine envía la lista vigente el mismo día de la cita.
- Plan de pagos: 10% al contrato (desde $41,990), 10% durante 2026, 10% en junio de 2027, 10% durante 2028 y 60% al cierre.
- Gastos mensuales: HOA estimado en $1.70 por pie² al mes (≈$630 en un estudio de 371 pies²) e impuestos de propiedad ≈1.8% del valor al año.
- Las unidades NO se entregan amuebladas (Catherine puede conectar con proveedores de mobiliario).
- Alquiler: permitido con un mínimo de 15 días; no hay programa de administración obligatorio. El dueño puede quedarse sin límite de días.
- Amenidades: gimnasio con entrenador personal, spa con sauna y hammam, cold plunge, estudios de yoga y meditación, piscina en la azotea con vista a la bahía, juice bar con vitaminas IV y nutricionista, administración on-site y cinco niveles de estacionamiento.
- Extranjeros pueden comprar a su nombre o con una LLC; hay préstamos para extranjeros con ~30–40% de enganche.
- Fecha de entrega: el desarrollador la confirma al reservar; queda en el contrato.
- No prometas rentabilidad ni ocupación.
- No le preguntes si busca preconstrucción o reventa: ya está viendo House of Wellness.
AGENDAR: en esta misma página está el calendario para elegir día y hora con Catherine (teléfono o Zoom); también ${bookUrl}.`
}

/** Instructions for Sofía about the project page at `path`, or "" if it isn't one. */
export function projectKnowledgeFor(path: string | null | undefined, bookUrl: string): string {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "")
  if (p === "/domus") return domusKnowledge(bookUrl)
  if (p === "/parkside") return parksideKnowledge(bookUrl)
  if (p === "/house-of-wellness") return houseOfWellnessKnowledge(bookUrl)
  if (p === "/proyectos") {
    return `EL VISITANTE ESTÁ VIENDO LA LISTA DE PROYECTOS DE CATHERINE. Estos son (usa solo estos datos y comparte el link del que le interese):\n${PROJECTS.map(x => `- ${x.name} (${x.place}) — ${x.highlight}. ${x.summary} ${projectUrl(x)}`).join("\n")}\nNo le preguntes si busca preconstrucción o reventa: ayúdale a elegir entre estos proyectos según su objetivo y presupuesto, y ofrece agendar con Catherine: ${bookUrl}.`
  }
  const project = PROJECTS.find(x => p === x.href || p.startsWith(x.href + "/"))
  if (!project) return ""
  return `EL VISITANTE ESTÁ EN LA PÁGINA DE ${project.name.toUpperCase()} (${project.place}): ${project.summary} ${project.highlight}. Página: ${projectUrl(project)}. Usa solo estos datos y los que el visitante vea en la página; no inventes precios, fechas ni rentabilidad. Para precios por unidad, planos y disponibilidad, ofrece agendar con Catherine: ${bookUrl}. No le preguntes si busca preconstrucción o reventa: ya está viendo este proyecto.`
}
