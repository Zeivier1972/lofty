/**
 * Shared design atoms for the investor project pages under /inversion.
 *
 * Both pages are sent straight to investors, so they deliberately share one
 * look — champagne gold on warm ivory, with espresso bands carrying the
 * incentives and the contact. Keeping these here means a change to the house
 * style lands on every project page at once instead of drifting per page.
 */

export const PALETTE = {
  paper: "#F3F0E8",
  card: "#FBF9F3",
  ink: "#17160F",
  muted: "#7C776A",
  line: "#E1DACA",
  gold: "#A6823B",
  goldBright: "#C7A869",
  espresso: "#17130E",
  onDark: "#ECE5D5",
} as const

/** Money, with the decimals only where they carry meaning (a cent-exact rent). */
export const usd = (n: number, decimals = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p className={`text-[0.68rem] font-medium uppercase tracking-[0.34em] ${onDark ? "text-[#C7A869]" : "text-[#A6823B]"}`}>
      {children}
    </p>
  )
}

export function Rule({ onDark = false, centered = false }: { onDark?: boolean; centered?: boolean }) {
  return <div className={`my-5 h-px w-12 ${centered ? "mx-auto " : ""}${onDark ? "bg-[#C7A869]" : "bg-[#A6823B]"}`} />
}

export function H2({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <h2
      className={`font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl ${
        onDark ? "text-white" : "text-[#17160F]"
      }`}
    >
      {children}
    </h2>
  )
}

/** Bulleted list with the small gold lozenge used across both pages. */
export function GoldList({ items, onDark = false }: { items: React.ReactNode[]; onDark?: boolean }) {
  return (
    <ul className={`space-y-4 ${onDark ? "text-[#ECE5D5]/90" : "text-[#17160F]/85"}`}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-4">
          <span aria-hidden className={`mt-[0.5rem] h-1.5 w-1.5 shrink-0 rotate-45 ${onDark ? "bg-[#C7A869]" : "bg-[#A6823B]"}`} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/** Visible Q&A. Mirror the same array into FAQPage JSON-LD on each page. */
export function FaqList({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-[#E1DACA] border-y border-[#E1DACA]">
      {faqs.map(f => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-medium text-[#17160F] marker:content-none">
            <span>{f.q}</span>
            <span aria-hidden className="mt-1 shrink-0 text-[#A6823B] transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-[68ch] leading-relaxed text-[#17160F]/80">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export function ContactBlock({ bookUrl, waUrl, phoneDisplay, phoneE164, subject }: {
  bookUrl: string
  waUrl: string
  phoneDisplay: string
  phoneE164: string
  subject: string
}) {
  return (
    <section className="border-t border-[#E1DACA] bg-[#FBF9F3]">
      <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
        <Eyebrow>Contacto</Eyebrow>
        <Rule centered />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium sm:text-5xl">Catherine Gomez</h2>
        <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[#7C776A]">Realtor · Miami &amp; Orlando</p>
        <p className="mt-6 font-[family-name:var(--mp-serif)] text-3xl tabular-nums">
          <a href={`tel:${phoneE164}`} className="text-[#17160F] hover:text-[#A6823B]">{phoneDisplay}</a>
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={bookUrl} className="rounded-lg bg-[#17130E] px-7 py-4 font-medium text-[#ECE5D5] hover:bg-[#2a241b]">
            Agendar una llamada
          </a>
          <a href={waUrl} className="rounded-lg bg-[#25D366] px-7 py-4 font-medium text-white hover:brightness-95">
            Escribir por WhatsApp
          </a>
          <a
            href={`mailto:info@catherinegomezrealtor.com?subject=${encodeURIComponent(subject)}`}
            className="rounded-lg border border-[#A6823B] px-7 py-4 font-medium text-[#A6823B] hover:bg-[#A6823B]/5"
          >
            Enviar un correo
          </a>
        </div>
      </div>
    </section>
  )
}
