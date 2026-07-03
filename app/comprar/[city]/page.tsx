import type { Metadata } from "next"
import { notFound } from "next/navigation"
import HomesClient from "@/app/homes/homes-client"
import { cityBySlug, SOFLA_CITIES } from "@/lib/sofla-cities"

export function generateStaticParams() {
  return SOFLA_CITIES.map(c => ({ city: c.slug }))
}

export function generateMetadata({ params }: { params: { city: string } }): Metadata {
  const c = cityBySlug(params.city)
  if (!c) return { title: "Casas en venta — Catherine Gomez Realtor" }
  const title = `Casas en venta en ${c.name}, FL — Catherine Gomez Realtor`
  const description = `Explora casas, condos y townhouses en venta en ${c.name}, ${c.county} County. Listados actualizados del MLS con fotos, precios y detalles. Catherine Gomez Realtor — 20+ años en South Florida.`
  return {
    title,
    description,
    alternates: { canonical: `/comprar/${c.slug}` },
    openGraph: { title, description, type: "website" },
  }
}

export default function CityLandingPage({ params }: { params: { city: string } }) {
  const c = cityBySlug(params.city)
  if (!c) notFound()

  return (
    <div>
      {/* SEO intro block above the search */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            Casas en venta en {c.name}, FL
          </h1>
          <p className="text-sm text-gray-600 mt-2 max-w-3xl leading-relaxed">
            Descubre las propiedades activas en <strong>{c.name}</strong> ({c.county} County) — casas,
            condominios y townhouses directamente del MLS, con fotos, precios y detalles actualizados.
            ¿Preguntas sobre el mercado de {c.name}? Catherine Gomez, Realtor con más de 20 años en South
            Florida, te ayuda a encontrar la propiedad ideal. Llama al (305) 283-0872.
          </p>
        </div>
      </section>

      <HomesClient initialCity={c.name} />

      {/* Internal links to other city pages (SEO interlinking) */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Explora otras áreas de South Florida</h2>
          <div className="flex flex-wrap gap-2">
            {SOFLA_CITIES.filter(x => x.slug !== c.slug).map(x => (
              <a key={x.slug} href={`/comprar/${x.slug}`}
                className="text-xs text-lofty-700 bg-lofty-50 border border-lofty-100 rounded-full px-3 py-1.5 hover:bg-lofty-100">
                Casas en {x.name}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
