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

/** Instructions for Sofía about the project page at `path`, or "" if it isn't one. */
export function projectKnowledgeFor(path: string | null | undefined, bookUrl: string): string {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "")
  if (p === "/domus") return domusKnowledge(bookUrl)
  const project = PROJECTS.find(x => x.href === p)
  if (!project) return ""
  return `EL VISITANTE ESTÁ EN LA PÁGINA DE ${project.name.toUpperCase()} (${project.place}): ${project.summary} ${project.highlight}. Página: ${projectUrl(project)}. Usa solo estos datos; para precios por unidad, planos y disponibilidad, ofrece agendar con Catherine: ${bookUrl}.`
}
