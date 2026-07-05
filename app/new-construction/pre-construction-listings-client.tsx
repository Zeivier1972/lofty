"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Bed, Bath, Maximize2, MapPin, Calendar, Phone, ChevronDown,
  Search, Filter, Loader2, Home, ArrowRight,
} from "lucide-react"
import InquiryModal from "./inquiry-modal"

interface Listing {
  listingKey: string
  listingId: string   // real MLS# like A11234567
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

const TYPE_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Single Family", value: "SingleFamilyResidence" },
  { label: "Townhouse", value: "Townhouse" },
  { label: "Condominium", value: "Condominium" },
]

function formatPrice(price: number) {
  if (price >= 1_000_000) {
    return "$" + (price / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "M"
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)
}

function PropertyCard({
  listing,
  agentName,
  onInquire,
}: {
  listing: Listing
  agentName: string
  onInquire: (l: Listing) => void
}) {
  const typeLabel = listing.subType
    ? listing.subType.replace(/([A-Z])/g, " $1").trim()
    : "New Construction"
  const locationLabel = [listing.city, listing.state].filter(Boolean).join(", ")

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group flex flex-col">
      {/* Photo — links to detail page */}
      <Link href={`/new-construction/${listing.listingKey}`} className="aspect-[4/3] overflow-hidden relative flex-shrink-0 block">
        {listing.photo ? (
          <img
            src={listing.photo}
            alt={`${typeLabel} in ${listing.city || "Miami"}`}
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
          <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}>
            New Construction
          </span>
        </div>
        {listing.yearBuilt && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {listing.yearBuilt}
            </span>
          </div>
        )}
        {/* View details overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "rgba(10,14,26,0.55)", backdropFilter: "blur(2px)" }}>
          <span className="px-4 py-2 rounded-full text-sm font-semibold text-white border border-white/40 bg-white/10">
            View Photos &amp; Details →
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {listing.price != null && (
          <p className="text-2xl font-bold mb-0.5" style={{ color: "#c9a84c" }}>
            {formatPrice(listing.price)}
          </p>
        )}
        <Link href={`/new-construction/${listing.listingKey}`} className="text-gray-700 text-sm font-semibold mb-0.5 hover:text-gray-900 transition-colors">
          {typeLabel}
        </Link>
        {locationLabel && (
          <p className="text-gray-500 text-xs mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {locationLabel}
          </p>
        )}
        <p className="text-gray-400 text-[10px] mb-3 font-mono tracking-wide">MLS# {listing.listingId || listing.listingKey}</p>

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
        </div>

        {listing.description && (
          <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3 flex-1">
            {listing.description}
          </p>
        )}

        <div className="mt-auto flex gap-2">
          <Link
            href={`/new-construction/${listing.listingKey}`}
            className="flex-1 text-center py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            More Photos
          </Link>
          <button
            onClick={() => onInquire(listing)}
            className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
          >
            Inquire
          </button>
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
  const [inquiryListing, setInquiryListing] = useState<Listing | null>(null)

  const [minYear, setMinYear] = useState("")
  const [priceIndex, setPriceIndex] = useState(0)
  const [minBeds, setMinBeds] = useState<number | undefined>(undefined)
  const [city, setCity] = useState("All Cities")
  const [propType, setPropType] = useState("")

  const selectedPrice = PRICE_OPTIONS[priceIndex]

  const buildParams = useCallback((extra?: { offset?: number }) => {
    const p = new URLSearchParams()
    p.set("limit", "24")
    p.set("minYear", minYear || "2025")
    if (city && city !== "All Cities") p.set("city", city)
    if (selectedPrice.min != null) p.set("minPrice", String(selectedPrice.min))
    if (selectedPrice.max != null) p.set("maxPrice", String(selectedPrice.max))
    if (minBeds != null) p.set("minBeds", String(minBeds))
    if (propType) p.set("type", propType)
    p.set("sort", "price_asc")
    if (extra?.offset) p.set("offset", String(extra.offset))
    return p.toString()
  }, [minYear, city, selectedPrice, minBeds, propType])

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
      }
      setTotal(data.total ?? data.count)
      setHasMore(data.hasMore ?? false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-4 py-24"
        style={{ minHeight: "480px" }}
      >
        {/* Background photo */}
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=85"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,14,26,0.72) 0%, rgba(10,14,26,0.85) 100%)" }} />
        {/* Gold glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 60% 30%, rgba(201,168,76,0.15) 0%, transparent 65%)" }} />
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
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setInquiryListing(listings[0] ?? { listingKey: "", listingId: "", address: "", city: "Miami", state: "FL", zip: null, price: null, beds: null, baths: null, sqft: null, yearBuilt: null, subType: null, description: null, photo: null })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              Get Started — It&apos;s Free
            </button>
            {agentPhone && (
              <a
                href={`tel:${agentPhone}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                <Phone className="w-4 h-4" /> {agentPhone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-white border-b border-gray-100 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 font-medium">
          <span>🔒 Address shared only after you inquire</span>
          <span>📋 Direct MLS access — no middleman</span>
          <span>🏆 Licensed Realtor — {agentName}</span>
          <span>🇪🇸 Atención en Español</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-30 shadow-md bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Year Built</label>
              <div className="relative">
                <select value={minYear} onChange={e => setMinYear(e.target.value)} className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {YEAR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price Range</label>
              <div className="relative">
                <select value={priceIndex} onChange={e => setPriceIndex(Number(e.target.value))} className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {PRICE_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bedrooms</label>
              <div className="flex gap-1.5">
                {BEDS_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setMinBeds(opt.value)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={minBeds === opt.value
                      ? { background: "#c9a84c", color: "#fff", borderColor: "#c9a84c" }
                      : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Property Type</label>
              <div className="relative">
                <select value={propType} onChange={e => setPropType(e.target.value)} className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</label>
              <div className="relative">
                <select value={city} onChange={e => setCity(e.target.value)} className="appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={() => search()}
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

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600 text-sm">
            {loading ? "Searching MLS…" : `${total > 0 ? total.toLocaleString() : listings.length} new construction listings available`}
          </p>
          <p className="hidden md:block text-xs text-gray-400 italic">Inquire on any listing to receive the full address &amp; floor plans</p>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(l => (
              <PropertyCard key={l.listingKey} listing={l} agentName={agentName} onInquire={setInquiryListing} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center mt-10">
            <button
              onClick={() => search({ append: true, currentOffset: offset })}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              Load More Listings <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {loading && listings.length > 0 && (
          <div className="text-center mt-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "#c9a84c" }} />
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="py-16 px-4 text-center" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Ready to Explore New Construction?
        </h2>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto">
          Get exclusive access to pre-construction pricing, floor plans, and developer incentives. {agentName} will guide you every step of the way — en español.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => setInquiryListing(listings[0] ?? { listingKey: "", listingId: "", address: "", city: "Miami", state: "FL", zip: null, price: null, beds: null, baths: null, sqft: null, yearBuilt: null, subType: null, description: null, photo: null })}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
          >
            <Calendar className="w-4 h-4" /> Request a Free Consultation
          </button>
          {agentPhone && (
            <a
              href={`tel:${agentPhone}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              <Phone className="w-4 h-4" /> {agentPhone}
            </a>
          )}
        </div>
      </div>

      {/* Inquiry Modal */}
      {inquiryListing && (
        <InquiryModal
          listing={inquiryListing}
          calendlyUrl={calendlyUrl}
          agentName={agentName}
          onClose={() => setInquiryListing(null)}
        />
      )}
    </div>
  )
}
