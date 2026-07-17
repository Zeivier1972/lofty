import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PrintButton } from "./print-button"
import { fetchPexelsPhoto } from "@/lib/pexels-video"
import { searchIdxListings, fetchPrimaryPhotos } from "@/lib/bridge"

export const revalidate = 0

// Curated Miami real-estate fallbacks when Pexels has no key / no result.
const HERO_FALLBACKS = [
  "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=900&q=80&auto=format&fit=crop", // Brickell skyline
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&auto=format&fit=crop", // luxury home pool
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&auto=format&fit=crop", // Miami condo towers
]
const priceStr = (p: number | null) =>
  p == null ? "" : (p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M` : `$${p.toLocaleString()}`)

export async function generateMetadata({ params }: { params: { keyword: string } }): Promise<Metadata> {
  const slug = params.keyword.toLowerCase()
  const magnet = await prisma.leadMagnet.findFirst({ where: { guideUrl: { endsWith: `/${slug}` } } })
  return {
    title: magnet ? `${magnet.title} — Catherine Gomez Realtor` : "Guía Gratuita — Catherine Gomez Realtor",
    description: magnet?.description ?? "",
  }
}

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .guide-body { font-family: Georgia, serif; background: #f8f7f4; color: #333; min-height: 100vh; }
  .guide-header { background: #1a1a2e; padding: 32px 24px; text-align: center; }
  .guide-header-tag { color: #c9a84c; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 8px; }
  .guide-header-title { color: #fff; font-size: 26px; font-weight: bold; line-height: 1.3; margin-bottom: 8px; }
  .guide-header-sub { color: #aaa; font-size: 14px; font-family: Arial, sans-serif; }
  .guide-container { max-width: 680px; margin: 0 auto; padding: 40px 24px; }
  .guide-content h2 { color: #1a1a2e; font-size: 20px; margin: 32px 0 12px; border-left: 4px solid #c9a84c; padding-left: 12px; }
  .guide-content p { font-size: 16px; line-height: 1.8; margin-bottom: 16px; color: #444; }
  .guide-content ul { margin: 12px 0 16px 20px; }
  .guide-content li { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 6px; }
  .guide-content strong { color: #1a1a2e; }
  .guide-cta-box { background: #1a1a2e; border-radius: 12px; padding: 32px; text-align: center; margin: 40px 0; }
  .guide-cta-tag { color: #c9a84c; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 12px; }
  .guide-cta-box p { color: #ddd; font-size: 15px; font-family: Arial, sans-serif; margin-bottom: 20px; line-height: 1.6; }
  .guide-cta-btn { display: inline-block; background: #c9a84c; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: bold; font-family: Arial, sans-serif; }
  .guide-agent-card { background: #fff; border: 1px solid #e5e0d5; border-radius: 12px; padding: 20px; margin-top: 24px; }
  .guide-agent-card h4 { color: #1a1a2e; font-size: 16px; margin-bottom: 6px; }
  .guide-agent-card p { color: #888; font-size: 13px; font-family: Arial, sans-serif; margin-bottom: 3px; }
  .guide-agent-card a { color: #c9a84c; text-decoration: none; }
  .guide-print-btn { text-align: center; margin: 0 0 24px; }
  .guide-print-btn button { background: none; border: 1px solid #ccc; padding: 8px 20px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #666; font-family: Arial, sans-serif; }
  .guide-hero { width: 100%; max-width: 680px; margin: 0 auto; display: block; }
  .guide-hero img { width: 100%; height: 260px; object-fit: cover; display: block; }
  .guide-props { margin: 40px 0 8px; }
  .guide-props h2 { color: #1a1a2e; font-size: 20px; margin: 0 0 16px; border-left: 4px solid #c9a84c; padding-left: 12px; }
  .guide-prop-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
  .guide-prop-card { border: 1px solid #e5e0d5; border-radius: 12px; overflow: hidden; background: #fff; text-decoration: none; display: block; }
  .guide-prop-card img { width: 100%; height: 150px; object-fit: cover; display: block; }
  .guide-prop-info { padding: 12px 14px; }
  .guide-prop-price { color: #059669; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif; margin: 0 0 2px; }
  .guide-prop-addr { color: #1a1a2e; font-size: 13px; font-family: Arial, sans-serif; margin: 0 0 2px; }
  .guide-prop-specs { color: #888; font-size: 12px; font-family: Arial, sans-serif; margin: 0; }
  .guide-props-cta { text-align: center; margin: 20px 0 0; }
  .guide-props-cta a { display: inline-block; background: #1a1a2e; color: #fff; padding: 12px 26px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: bold; font-family: Arial, sans-serif; }
  @media print { .guide-print-btn, .guide-cta-box { display: none; } }
`

export default async function GuidePage({ params }: { params: { keyword: string } }) {
  const slug = params.keyword.toLowerCase()

  const magnet = await prisma.leadMagnet.findFirst({
    where: { guideUrl: { endsWith: `/${slug}` } },
  })

  if (!magnet?.content) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const bookingUrl = `${appUrl}/book`

  // Subject hero image (relevant to the guide topic), with a curated fallback.
  const pexels = await fetchPexelsPhoto(`${magnet.title} ${slug}`).catch(() => null)
  const heroImage = pexels || HERO_FALLBACKS[Math.abs(slug.length) % HERO_FALLBACKS.length]

  // A few LIVE MLS listings with real photos (same source as the property
  // texts/emails), so this stays populated + fresh regardless of the local cache.
  const listings = await searchIdxListings({ cities: ["Miami"], limit: 8 }).catch(() => [] as any[])
  const photoMap = listings.length
    ? await fetchPrimaryPhotos(listings.map((l: any) => l.ListingKey).filter(Boolean)).catch(() => ({} as Record<string, string>))
    : {}
  const properties = (listings as any[])
    .map((l: any) => ({
      key: l.ListingKey as string,
      photo: photoMap[l.ListingKey],
      price: (l.ListPrice ?? null) as number | null,
      city: (l.City || "Miami") as string,
      beds: l.BedroomsTotal ?? null,
      baths: l.BathroomsTotalDecimal ?? null,
      sqft: l.LivingArea ?? null,
    }))
    .filter(p => p.key && p.photo)
    .slice(0, 3)

  return (
    <div className="guide-body">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="guide-header">
        <p className="guide-header-tag">Catherine Gomez Realtor · Miami</p>
        <h1 className="guide-header-title">{magnet.title}</h1>
        <p className="guide-header-sub">{magnet.description}</p>
      </div>

      {heroImage && (
        <div className="guide-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImage} alt={magnet.title} />
        </div>
      )}

      <div className="guide-container">
        <PrintButton />

        <div className="guide-content" dangerouslySetInnerHTML={{ __html: magnet.content }} />

        {properties.length > 0 && (
          <div className="guide-props">
            <h2>Propiedades destacadas en Miami</h2>
            <div className="guide-prop-grid">
              {properties.map(p => {
                const specs = [
                  p.beds != null ? `${p.beds} hab` : "",
                  p.baths != null ? `${p.baths} baños` : "",
                  p.sqft != null ? `${Number(p.sqft).toLocaleString()} sqft` : "",
                ].filter(Boolean).join(" · ")
                const href = `${appUrl}/homes/${encodeURIComponent(p.key)}`
                return (
                  <a key={p.key} href={href} target="_blank" rel="noopener noreferrer" className="guide-prop-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo as string} alt={p.city} />
                    <div className="guide-prop-info">
                      {p.price != null && <p className="guide-prop-price">{priceStr(p.price)}</p>}
                      <p className="guide-prop-addr">{p.city}, FL</p>
                      {specs && <p className="guide-prop-specs">{specs}</p>}
                    </div>
                  </a>
                )
              })}
            </div>
            <div className="guide-props-cta">
              <a href={`${appUrl}/homes`} target="_blank" rel="noopener noreferrer">Ver todas las propiedades en el sitio →</a>
            </div>
          </div>
        )}

        <div className="guide-cta-box">
          <p className="guide-cta-tag">¿Listo para el siguiente paso?</p>
          <p>
            Agenda una consulta gratuita con Catherine Gomez.<br />
            Más de 15 años ayudando a familias hispanas en South Florida.
          </p>
          <a href={bookingUrl} className="guide-cta-btn">Agendar consulta gratuita →</a>
        </div>

        <div className="guide-agent-card">
          <h4>Catherine Gomez</h4>
          <p>Realtor · South Florida · 15+ años de experiencia</p>
          <p>
            <a href="tel:3052830872">(305) 283-0872</a>
            {" · "}
            <a href="mailto:info@catherinegomezrealtor.com">info@catherinegomezrealtor.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
