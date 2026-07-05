"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Bed, Bath, Maximize2, MapPin, Calendar, Phone, ChevronDown,
  Search, Filter, Loader2, Home, ArrowRight,
} from "lucide-react"

interface Listing {
  listingKey: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  subType: string | null
  description: string | null
  photo: string | null
}

interface Props {
  initialResults: Listing[]
  calendlyUrl: string | null
  agentName: string
  agentPhone: string | null
}

const CITIES = [
  "All Cities", "Miami", "Miami Beach", "Doral", "Coral Gables",
  "Aventura", "Sunny Isles Beach", "Brickell", "Edgewater", "Wynwood",
  "Hialeah", "Kendall", "Pinecrest", "South Miami",
]

const YEAR_OPTIONS = [
  { label: "All Years", value: "" },
  { label: "2025", value: "2025" },
  { label: "2026", value: "2026" },
  { label: "2027", value: "2027" },
]

const PRICE_OPTIONS = [
  { label: "Any Price", min: undefined, max: undefined },
  { label: "Under $500K", min: undefined, max: 500000 },
  { label: "$500K – $750K", min: 500000, max: 750000 },
  { label: "$750K – $1M", min: 750000, max: 1000000 },
  { label: "$1M – $2M", min: 1000000, max: 2000000 },
  { label: "$2M – $5M", min: 2000000, max: 5000000 },
  { label: "$5M+", min: 5000000, max: undefined },
]

const BEDS_OPTIONS = [
  { label: "Any", value: undefined },
  { label: "1+", value: 1 },
  { label: "2+", value: 2 },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
]

function formatPrice(price: number) {
  if (price >= 1_000_000) {
    return "$" + (price / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "M"
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)
}

function PropertyCard({ listing, calendlyUrl }: { listing: Listing; calendlyUrl: string | null }) {
  const label = listing.subType
    ? listing.subType.replace(/([A-Z])/g, " $1").trim()
    : "New Construction"

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group flex flex-col">
      {/* Photo */}
      <div className="aspect-[4/3] overflow-hidden relative flex-shrink-0">
        {listing.photo ? (
          <img
            src={listing.photo}
            alt={listing.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(201,168,76,0.2)" }}>
                <Home className="w-7 h-7" style={{ color: "#c9a84c" }} />
              </div>
              <span className="text-white text-xs opacity-60">Photo Pending</span>
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}>
            New Construction
          </span>
        </div>
        {listing.yearBuilt && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {listing.yearBuilt}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {listing.price != null && (
          <p className="text-2xl font-bold mb-1" style={{ color: "#c9a84c" }}>
            {formatPrice(listing.price)}
          </p>
        )}
        <p className="text-gray-700 text-sm mb-1 font-medium leading-snug">
          {listing.address}
        </p>
        {(listing.city || listing.state) && (
          <p className="text-gray-500 text-xs mb-3 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {[listing.city, listing.state].filter(Boolean).join(", ")}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {listing.beds != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bed className="w-3 h-3" /> {listing.beds} bd
            </span>
          )}
          {listing.baths != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bath className="w-3 h-3" /> {listing.baths} ba
            </span>
          )}
          {listing.sqft != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Maximize2 className="w-3 h-3" /> {listing.sqft.toLocaleString()} sqft
            </span>
          )}
          {listing.subType && (
            <span className="bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-xs">
              {label}
            </span>
          )}
        </div>

        {listing.description && (
          <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3 flex-1">
            {listing.description}
          </p>
        )}

        <div className="mt-auto">
          {calendlyUrl ? (
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
            >
              Schedule a Tour
            </a>
          ) : (
            <Link
              href="/site#contact"
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
            >
              Schedule a Tour
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PreConstructionListingsClient({ initialResults, calendlyUrl, agentName, agentPhone }: Props) {
  const [listings, setListings] = useState<Listing[]>(initialResults)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(initialResults.length)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(initialResults.length)

  // Filters
  const [minYear, setMinYear] = useState("")
  const [priceIndex, setPriceIndex] = useState(0)
  const [minBeds, setMinBeds] = useState<number | undefined>(undefined)
  const [city, setCity] = useState("All Cities")

  const selectedPrice = PRICE_OPTIONS[priceIndex]

  const buildParams = useCallback((extra?: { offset?: number }) => {
    const p = new URLSearchParams()
    p.set("limit", "24")
    p.set("minYear", minYear || "2025")
    if (city && city !== "All Cities") p.set("city", city)
    if (selectedPrice.min != null) p.set("minPrice", String(selectedPrice.min))
    if (selectedPrice.max != null) p.set("maxPrice", String(selectedPrice.max))
    if (minBeds != null) p.set("minBeds", String(minBeds))
    p.set("sort", "price_asc")
    if (extra?.offset) p.set("offset", String(extra.offset))
    return p.toString()
  }, [minYear, city, selectedPrice, minBeds])

  async function search(opts?: { append?: boolean; currentOffset?: number }) {
    setLoading(true)
    try {
      const qs = buildParams({ offset: opts?.append ? (opts.currentOffset ?? 0) : 0 })
      const res = await fetch(`/api/idx/search?${qs}`)
      const data = await res.json()
      if (!data.ok) return
      if (opts?.append) {
        setListings(prev => [...prev, ...data.results])
        setOffset((opts.currentOffset ?? 0) + data.results.length)
      } else {
        setListings(data.results)
        setOffset(data.results.length)
        setTotal(data.total ?? data.count)
        setHasMore(data.hasMore ?? false)
      }
      setTotal(data.total ?? data.count)
      setHasMore(data.hasMore ?? false)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    search()
  }

  function loadMore() {
    search({ append: true, currentOffset: offset })
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Hero ── */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-4 py-24"
        style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 50%, #0d1420 100%)", minHeight: "420px" }}
      >
        {/* Subtle gold overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(201,168,76,0.12) 0%, transparent 70%)" }} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest mb-4" style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" }}>
            LIVE MLS · UPDATED DAILY
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            New Construction Miami
          </h1>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Browse pre-construction homes &amp; condos in Miami, Doral, Coral Gables, Aventura and South Florida. New builds 2025–2027, sourced directly from the MLS.
          </p>
          {agentPhone && (
            <a
              href={`tel:${agentPhone}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              <Phone className="w-4 h-4" />
              Call {agentName}
            </a>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="sticky top-0 z-30 shadow-md" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Year */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Year Built</label>
              <div className="relative">
                <select
                  value={minYear}
                  onChange={e => setMinYear(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {YEAR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price Range</label>
              <div className="relative">
                <select
                  value={priceIndex}
                  onChange={e => setPriceIndex(Number(e.target.value))}
                  className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {PRICE_OPTIONS.map((opt, i) => (
                    <option key={i} value={i}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Beds */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bedrooms</label>
              <div className="flex gap-1.5">
                {BEDS_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setMinBeds(opt.value)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={
                      minBeds === opt.value
                        ? { background: "#c9a84c", color: "#fff", borderColor: "#c9a84c" }
                        : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</label>
              <div className="relative">
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0a0e1a, #1a2744)" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600 text-sm">
            {loading
              ? "Searching MLS…"
              : `${total > 0 ? total.toLocaleString() : listings.length} new construction listings found`}
          </p>
          {calendlyUrl && (
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#c9a84c" }}
            >
              Schedule a Consultation <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Grid */}
        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(l => (
              <PropertyCard key={l.listingKey} listing={l} calendlyUrl={calendlyUrl} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="text-center mt-10">
            <button
              onClick={loadMore}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              Load More Listings
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {loading && listings.length > 0 && (
          <div className="text-center mt-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "#c9a84c" }} />
          </div>
        )}
      </div>

      {/* ── Bottom CTA ── */}
      <div className="py-16 px-4 text-center" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Ready to Explore New Construction?
        </h2>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto">
          Get exclusive access to pre-construction pricing, floor plans, and developer incentives. {agentName} will guide you every step of the way.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          {calendlyUrl ? (
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              <Calendar className="w-4 h-4" />
              Book a Free Consultation
            </a>
          ) : null}
          {agentPhone && (
            <a
              href={`tel:${agentPhone}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              <Phone className="w-4 h-4" />
              {agentPhone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
