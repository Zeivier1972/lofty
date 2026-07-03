"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { Building2, Search, Bed, Bath, Maximize2, MapPin, Loader2, Phone } from "lucide-react"
import { IdxDisclaimer } from "@/components/idx-disclaimer"

interface Result {
  listingKey: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  subType: string | null
  photo: string | null
  office: string | null
}

const PRICE_OPTIONS = [
  { label: "Sin mínimo", value: "" },
  { label: "$200k", value: "200000" },
  { label: "$400k", value: "400000" },
  { label: "$600k", value: "600000" },
  { label: "$800k", value: "800000" },
  { label: "$1M", value: "1000000" },
  { label: "$2M", value: "2000000" },
]

// RESO PropertySubType values (verified via /api/mls/bridge-test → subTypesSeen)
const PROPERTY_TYPES = [
  { label: "Cualquier tipo", value: "" },
  { label: "Casa", value: "Single Family Residence" },
  { label: "Condominio", value: "Condominium" },
  { label: "Townhouse", value: "Townhouse" },
  { label: "Cooperativa", value: "Stock Cooperative" },
]

// South Florida cities (Miami-Dade, Broward, Palm Beach) for the city autocomplete.
const SOUTH_FLORIDA_CITIES = [
  // Miami-Dade
  "Miami", "Miami Beach", "Coral Gables", "Doral", "Hialeah", "Hialeah Gardens",
  "Homestead", "Kendall", "Aventura", "Sunny Isles Beach", "North Miami",
  "North Miami Beach", "Miami Gardens", "Miami Lakes", "Miami Springs", "Cutler Bay",
  "Palmetto Bay", "Pinecrest", "Key Biscayne", "South Miami", "West Miami",
  "Sweetwater", "Bal Harbour", "Surfside", "Bay Harbor Islands", "Golden Beach",
  "Opa-locka", "Florida City",
  // Broward
  "Fort Lauderdale", "Hollywood", "Pembroke Pines", "Miramar", "Coral Springs",
  "Pompano Beach", "Davie", "Plantation", "Sunrise", "Weston", "Deerfield Beach",
  "Coconut Creek", "Tamarac", "Margate", "Lauderhill", "Hallandale Beach",
  "Oakland Park", "Wilton Manors", "Cooper City", "Dania Beach", "Lauderdale Lakes",
  "Parkland", "North Lauderdale", "Lighthouse Point", "Southwest Ranches",
  // Palm Beach
  "West Palm Beach", "Boca Raton", "Boynton Beach", "Delray Beach",
  "Palm Beach Gardens", "Jupiter", "Wellington", "Royal Palm Beach", "Lake Worth",
  "Palm Beach", "Riviera Beach", "Greenacres", "Palm Springs", "North Palm Beach",
  "Lantana", "Juno Beach", "Tequesta", "Loxahatchee",
]

function fmtPrice(n: number | null): string {
  if (!n) return "Consultar precio"
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export default function HomesClient() {
  const [city, setCity] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [minBeds, setMinBeds] = useState("")
  const [minBaths, setMinBaths] = useState("")
  const [minGarage, setMinGarage] = useState("")
  const [propType, setPropType] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (city.trim()) params.set("city", city.trim())
      if (minPrice) params.set("minPrice", minPrice)
      if (maxPrice) params.set("maxPrice", maxPrice)
      if (minBeds) params.set("minBeds", minBeds)
      if (minBaths) params.set("minBaths", minBaths)
      if (minGarage) params.set("minGarage", minGarage)
      if (propType) params.set("type", propType)
      const res = await fetch(`/api/idx/search?${params.toString()}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Error en la búsqueda")
      setResults(data.results || [])
    } catch (e: any) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [city, minPrice, maxPrice, minBeds, minBaths, minGarage, propType])

  useEffect(() => { search() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-lofty-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm leading-tight block">Catherine Gomez</span>
              <span className="text-xs text-gray-500 leading-tight block">Miami Real Estate</span>
            </div>
          </Link>
          <a href="tel:+13052830872" className="flex items-center gap-1.5 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium">
            <Phone className="w-3.5 h-3.5" /> (305) 283-0872
          </a>
        </div>
      </header>

      {/* Search bar */}
      <div className="bg-white border-b">
        <div className="max-w-screen-xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Ciudad (Miami, Fort Lauderdale, West Palm Beach…)"
            list="sfla-cities"
            className="col-span-2 md:col-span-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400"
          />
          <datalist id="sfla-cities">
            {SOUTH_FLORIDA_CITIES.map(c => <option key={c} value={c} />)}
          </datalist>
          <select value={propType} onChange={e => setPropType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            {PROPERTY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={minPrice} onChange={e => setMinPrice(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            {PRICE_OPTIONS.map(o => <option key={`min${o.value}`} value={o.value}>{o.value ? `Desde ${o.label}` : "Precio mín."}</option>)}
          </select>
          <select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            {PRICE_OPTIONS.map(o => <option key={`max${o.value}`} value={o.value}>{o.value ? `Hasta ${o.label}` : "Precio máx."}</option>)}
          </select>
          <select value={minBeds} onChange={e => setMinBeds(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            <option value="">Cuartos</option>
            {[1, 2, 3, 4, 5].map(b => <option key={b} value={b}>{b}+ cuartos</option>)}
          </select>
          <select value={minBaths} onChange={e => setMinBaths(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            <option value="">Baños</option>
            {[1, 2, 3, 4].map(b => <option key={b} value={b}>{b}+ baños</option>)}
          </select>
          <select value={minGarage} onChange={e => setMinGarage(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
            <option value="">Garaje</option>
            <option value="1">1+ garaje</option>
            <option value="2">2+ garaje</option>
          </select>
          <button onClick={search} className="flex items-center justify-center gap-2 bg-lofty-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-lofty-700">
            <Search className="w-4 h-4" /> Buscar
          </button>
        </div>
      </div>

      {/* Results */}
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Buscando propiedades…
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-500 text-sm">{error}</div>
        ) : results.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">No se encontraron propiedades. Ajusta los filtros.</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{results.length} propiedades activas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {results.map(r => (
                <Link key={r.listingKey} href={`/homes/${r.listingKey}`} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                    {r.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo} alt={r.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Building2 className="w-10 h-10" /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xl font-extrabold text-lofty-700">{fmtPrice(r.price)}</p>
                    <p className="text-sm font-medium text-gray-800 mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" /> {r.address}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                      {r.beds != null && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {r.beds}</span>}
                      {r.baths != null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {r.baths}</span>}
                      {r.sqft != null && <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> {r.sqft.toLocaleString()} sqft</span>}
                    </div>
                    {r.office && <p className="text-[10px] text-gray-400 mt-2 truncate">Cortesía de {r.office}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        <IdxDisclaimer />
      </main>
    </div>
  )
}
