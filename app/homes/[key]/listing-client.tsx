"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Building2, Bed, Bath, Maximize2, MapPin, Loader2, Phone, Calendar,
  ArrowLeft, Home, Car, Waves, CalendarDays, DollarSign, Heart,
} from "lucide-react"
import { IdxDisclaimer } from "@/components/idx-disclaimer"
import { LeadCaptureModal } from "@/components/idx/lead-capture-modal"
import { getFavs, setFavs, getLead, saveHome, type LeadFields } from "@/lib/idx-favorites"

interface Listing {
  listingKey: string
  mlsNumber: string | null
  address: string
  city: string | null
  state: string | null
  zip: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  propertyType: string | null
  subType: string | null
  status: string | null
  description: string | null
  hoa: number | null
  taxes: number | null
  daysOnMarket: number | null
  pool: boolean | null
  garage: number | null
  office: string | null
  agent: string | null
  modified: string | null
  photos: string[]
}

function fmtPrice(n: number | null): string {
  if (!n) return "Consultar precio"
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export default function ListingClient({ listingKey }: { listingKey: string }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [fav, setFav] = useState(false)
  const [showLead, setShowLead] = useState(false)

  useEffect(() => {
    setFav(getFavs().includes(listingKey))
    ;(async () => {
      try {
        const res = await fetch(`/api/idx/listing/${listingKey}`)
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || "No se pudo cargar la propiedad")
        setListing(data.listing)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [listingKey])

  async function toggleFav() {
    if (!fav && !getLead()) { setShowLead(true); return }
    try {
      await saveHome({ listingKey, remove: fav })
      const favs = getFavs()
      const next = fav ? favs.filter(k => k !== listingKey) : [...favs, listingKey]
      setFavs(next); setFav(!fav)
    } catch { /* ignore */ }
  }

  async function onLeadSubmit(lead: LeadFields) {
    await saveHome({ listingKey, lead })
    setFavs([...getFavs(), listingKey]); setFav(true); setShowLead(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando propiedad…</div>
  }
  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
        <p>{error || "Propiedad no encontrada"}</p>
        <Link href="/homes" className="text-lofty-600 underline text-sm">← Volver a la búsqueda</Link>
      </div>
    )
  }

  const l = listing
  const photos = l.photos.length > 0 ? l.photos : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/homes" className="flex items-center gap-2 text-sm text-gray-600 hover:text-lofty-700">
            <ArrowLeft className="w-4 h-4" /> Búsqueda
          </Link>
          <a href="tel:+13052830872" className="flex items-center gap-1.5 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium">
            <Phone className="w-3.5 h-3.5" /> (305) 283-0872
          </a>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Gallery */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className="lg:col-span-2 aspect-[16/10] bg-gray-100 rounded-2xl overflow-hidden">
            {photos[activePhoto] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[activePhoto]} alt={l.address} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300"><Building2 className="w-12 h-12" /></div>
            )}
          </div>
          <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
            {photos.slice(0, 12).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p}
                alt={`Foto ${i + 1}`}
                onClick={() => setActivePhoto(i)}
                className={`aspect-square object-cover rounded-lg cursor-pointer ${activePhoto === i ? "ring-2 ring-lofty-500" : "opacity-80 hover:opacity-100"}`}
                loading="lazy"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main details */}
          <div className="lg:col-span-2">
            <p className="text-3xl font-extrabold text-lofty-700">{fmtPrice(l.price)}</p>
            <p className="text-lg font-medium text-gray-800 mt-1 flex items-start gap-1.5">
              <MapPin className="w-5 h-5 mt-0.5 text-gray-400 flex-shrink-0" /> {l.address}
            </p>

            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-600 mt-4 pb-4 border-b">
              {l.beds != null && <span className="flex items-center gap-1.5"><Bed className="w-4 h-4" /> {l.beds} cuartos</span>}
              {l.baths != null && <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {l.baths} baños</span>}
              {l.sqft != null && <span className="flex items-center gap-1.5"><Maximize2 className="w-4 h-4" /> {l.sqft.toLocaleString()} sqft</span>}
              {l.subType && <span className="flex items-center gap-1.5"><Home className="w-4 h-4" /> {l.subType}</span>}
            </div>

            {l.description && (
              <div className="mt-5">
                <h2 className="font-semibold text-gray-800 mb-2">Descripción</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{l.description}</p>
              </div>
            )}

            {/* Detail grid */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {l.yearBuilt != null && <Detail icon={<CalendarDays className="w-4 h-4" />} label="Año construido" value={String(l.yearBuilt)} />}
              {l.garage != null && l.garage > 0 && <Detail icon={<Car className="w-4 h-4" />} label="Garaje" value={`${l.garage} autos`} />}
              {l.pool && <Detail icon={<Waves className="w-4 h-4" />} label="Piscina" value="Sí" />}
              {l.hoa != null && l.hoa > 0 && <Detail icon={<DollarSign className="w-4 h-4" />} label="HOA" value={`$${l.hoa.toLocaleString()}/mes`} />}
              {l.taxes != null && l.taxes > 0 && <Detail icon={<DollarSign className="w-4 h-4" />} label="Impuestos" value={`$${l.taxes.toLocaleString()}/año`} />}
              {l.daysOnMarket != null && <Detail icon={<Calendar className="w-4 h-4" />} label="Días en el mercado" value={String(l.daysOnMarket)} />}
              {l.mlsNumber && <Detail icon={<Home className="w-4 h-4" />} label="MLS #" value={l.mlsNumber} />}
            </div>
          </div>

          {/* Lead CTA sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-gray-900 text-lg">¿Te interesa esta propiedad?</h3>
              <p className="text-sm text-gray-500 mt-1">Agenda una visita o consulta gratuita con Catherine Gomez.</p>
              <a href="/book" className="mt-4 w-full flex items-center justify-center gap-2 bg-lofty-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-lofty-700">
                <Calendar className="w-4 h-4" /> Agendar visita
              </a>
              <a href="tel:+13052830872" className="mt-2 w-full flex items-center justify-center gap-2 border-2 border-lofty-600 text-lofty-700 rounded-xl py-3 text-sm font-semibold hover:bg-lofty-50">
                <Phone className="w-4 h-4" /> (305) 283-0872
              </a>
              <button onClick={toggleFav}
                className={`mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${fav ? "bg-red-50 text-red-600 border-2 border-red-200" : "border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <Heart className={`w-4 h-4 ${fav ? "fill-red-500 text-red-500" : ""}`} /> {fav ? "Guardada" : "Guardar propiedad"}
              </button>
              {l.office && <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">Cortesía de {l.office}{l.agent ? ` — ${l.agent}` : ""}</p>}
            </div>
          </aside>
        </div>

        <IdxDisclaimer />
      </main>

      <LeadCaptureModal open={showLead} onClose={() => setShowLead(false)} onSubmit={onLeadSubmit} />
    </div>
  )
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">{icon} {label}</div>
      <p className="text-sm font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  )
}
