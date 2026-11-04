/**
 * Trust and incentive blocks for the Colombia funnel.
 *
 * Built for a distrustful audience: every claim here is checkable (a state
 * license anyone can look up, the Florida statute on deposits) and the
 * incentive is information they cannot get from an ad — not a discount we
 * do not have. What Catherine must deliver on the call is listed in
 * BOOKING_BONUS; keep it in step with what she actually sends.
 */

import { Check, X, ShieldCheck, BadgeCheck, Users, Landmark } from "lucide-react"

const FOREST = "#1E2B23"
const SAND = "#B59A6A"
const LINE = "rgba(46,66,54,.22)"
const serif = "var(--font-display), Georgia, serif"

export const LICENSE = "3320405"
export const LICENSE_LOOKUP = "https://www.myfloridalicense.com/wl11.asp"

/** What someone gets for booking. Catherine delivers these on / after the call. */
export const BOOKING_BONUS = [
  "La lista de precios vigente y los planos de las residencias disponibles (no se publican en internet)",
  "Su análisis de rentabilidad unidad por unidad, con datos reales de alquiler en Brickell",
  "La guía del comprador colombiano en PDF (al instante al agendar): cómo se protegen sus depósitos, cómo enviar los dólares, comprar a su nombre o con una LLC y qué declarar ante la DIAN",
]

const WONT_HAPPEN = [
  "No le pedimos dinero, datos bancarios ni firmas",
  "No hay compromiso de compra ni insistencia después",
  "Si Parkside no le conviene, se lo decimos",
]

export function BookingPromise({ country }: { country: string }) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="border bg-white p-5" style={{ borderColor: LINE, color: FOREST }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: SAND }}>Al agendar recibe, sin costo</p>
        <ul className="mt-3 space-y-2.5 text-sm text-[#4F5A52]">
          {BOOKING_BONUS.map(t => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAND }} aria-hidden="true" /> {t}</li>
          ))}
        </ul>
      </div>
      <div className="border bg-white p-5" style={{ borderColor: LINE, color: FOREST }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: SAND }}>Lo que no pasa en la llamada</p>
        <ul className="mt-3 space-y-2.5 text-sm text-[#4F5A52]">
          {WONT_HAPPEN.map(t => (
            <li key={t} className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-[#9B4B3A]" aria-hidden="true" /> {t}</li>
          ))}
          <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAND }} aria-hidden="true" /> Puede invitar a su contador, abogado o familia, desde {country}</li>
        </ul>
        <p className="mt-3 text-xs text-[#6B6A62]">
          Catherine Gomez · Licencia de bienes raíces de Florida #{LICENSE} ·{" "}
          <a href={LICENSE_LOOKUP} target="_blank" rel="noopener noreferrer" className="underline">verifíquela aquí</a>
        </p>
      </div>
    </div>
  )
}

/** "¿Por qué confiar?" section for the page body. */
export function TrustSection() {
  const items = [
    {
      Icon: BadgeCheck,
      title: "Una agente con licencia que usted puede verificar",
      body: `Catherine Gomez tiene licencia de bienes raíces del Estado de Florida (#${LICENSE}) y trabaja en el mercado desde 2004. Puede comprobarlo en el registro oficial del Estado antes de hablar con nosotros.`,
      link: { href: LICENSE_LOOKUP, text: "Verificar licencia en myfloridalicense.com" },
    },
    {
      Icon: ShieldCheck,
      title: "Sus depósitos tienen protección de ley",
      body: "En Florida, la ley de condominios (Estatuto 718.202) obliga al desarrollador a mantener los depósitos de hasta el 10% del precio en una cuenta de garantía (escrow) independiente; lo que excede el 10% solo puede usarse en la construcción, según el contrato. En la presentación le mostramos dónde lo dice su contrato.",
      link: { href: "https://www.flsenate.gov/Laws/Statutes/2024/718.202", text: "Leer el estatuto 718.202" },
    },
    {
      Icon: Landmark,
      title: "Todo se firma y se paga por canales formales",
      body: "Los pagos van a la cuenta de garantía indicada en su contrato, nunca a una cuenta personal. Ningún asesor de nuestro equipo le pedirá que transfiera dinero a su nombre.",
    },
    {
      Icon: Users,
      title: "Decida acompañado",
      body: "Invite a su contador, abogado o familia a la presentación. Preferimos que decida con toda la información y sin prisa.",
    },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="confianza">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em]" style={{ color: SAND }}>Invertir con tranquilidad</p>
      <h2 id="confianza" className="mt-4 text-[2rem] font-light leading-tight sm:text-[2.6rem]" style={{ fontFamily: serif, color: FOREST }}>
        Antes de confiar, verifique
      </h2>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {items.map(({ Icon, title, body, link }) => (
          <li key={title} className="border-t pt-5" style={{ borderColor: "rgba(30,43,35,.2)" }}>
            <Icon className="h-6 w-6" style={{ color: SAND }} aria-hidden="true" />
            <h3 className="mt-3 text-xl font-light" style={{ fontFamily: serif, color: FOREST }}>{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4F5A52]">{body}</p>
            {link && (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline" style={{ color: FOREST }}>
                {link.text}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
