"use client"

import { useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Search, SlidersHorizontal, Heart, Eye, MapPin, Bed, Bath,
  Square, DollarSign, Home, X, ChevronDown, Phone, Mail,
  Building2, ArrowRight, CheckCircle2,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface Property {
  id: string
  title: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  type: string
  status: string
  images: string
  description: string | null
}

interface Props {
  properties: Property[]
  filters: {
    type?: string
    minPrice?: string
    maxPrice?: string
    beds?: string
    city?: string
    status?: string
  }
}

interface LeadForm {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const PROPERTY_TYPES = ["SINGLE_FAMILY", "CONDO", "TOWNHOUSE", "MULTI_FAMILY", "LAND", "COMMERCIAL"]
const BED_OPTIONS = ["1", "2", "3", "4", "5"]
const PRICE_OPTIONS = [100000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000]

function getImages(raw: string): string[] {
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

export default function SearchClient({ properties, filters }: Props) {
  const router = useRouter()
  const [showFilters, setShowFilters] = useState(false)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [viewedIds, setViewedIds] = useState<string[]>([])
  const [leadForm, setLeadForm] = useState<LeadForm>({ firstName: "", lastName: "", email: "", phone: "" })
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: "save" | "view"; propertyId: string } | null>(null)
  const [leadContactId, setLeadContactId] = useState<string | null>(null)
  const [filterValues, setFilterValues] = useState(filters)

  function applyFilters(newFilters: typeof filters) {
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
    router.push(`/search?${params.toString()}`)
  }

  async function registerLead(form: LeadForm) {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        source: "IDX_SEARCH",
        status: "NEW_LEAD",
      }),
    })
    const data = await res.json()
    return data.id as string
  }

  async function trackView(propertyId: string, contactId?: string) {
    if (viewedIds.includes(propertyId)) return
    setViewedIds(prev => [...prev, propertyId])
    await fetch("/api/properties/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, contactId }),
    })
  }

  async function handleSave(propertyId: string) {
    if (!leadContactId && !leadSaved) {
      setPendingAction({ type: "save", propertyId })
      setShowLeadModal(true)
      return
    }
    setSavedIds(prev => [...prev, propertyId])
    await fetch("/api/properties/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, contactId: leadContactId }),
    })
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault()
    const contactId = await registerLead(leadForm)
    setLeadContactId(contactId)
    setLeadSaved(true)
    setShowLeadModal(false)

    if (pendingAction) {
      if (pendingAction.type === "save") {
        setSavedIds(prev => [...prev, pendingAction.propertyId])
        await fetch("/api/properties/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: pendingAction.propertyId, contactId }),
        })
      } else {
        await trackView(pendingAction.propertyId, contactId)
      }
      setPendingAction(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-lofty-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-lg">Lofty</span>
            </Link>
            <div className="flex items-center gap-4">
              {!leadSaved ? (
                <button
                  onClick={() => setShowLeadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
                >
                  <Phone className="w-4 h-4" /> Connect with Agent
                </button>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Agent Notified
                </div>
              )}
              <Link href="/login" className="text-sm text-gray-600 hover:text-lofty-700">Agent Login</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Search bar + filters */}
      <div className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by city, zip, or address..."
                value={filterValues.city || ""}
                onChange={e => setFilterValues(f => ({ ...f, city: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && applyFilters(filterValues)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-lofty-500 text-sm"
              />
            </div>
            <button
              onClick={() => applyFilters(filterValues)}
              className="px-5 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
            >
              Search
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors",
                showFilters ? "bg-lofty-50 border-lofty-400 text-lofty-700" : "text-gray-600 hover:border-lofty-400"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {Object.values(filters).filter(Boolean).length > 0 && (
                <span className="w-4 h-4 bg-lofty-600 text-white rounded-full text-xs flex items-center justify-center">
                  {Object.values(filters).filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
                <select
                  value={filterValues.type || ""}
                  onChange={e => setFilterValues(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                >
                  <option value="">All Types</option>
                  {PROPERTY_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              {/* Min Price */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Min Price</label>
                <select
                  value={filterValues.minPrice || ""}
                  onChange={e => setFilterValues(f => ({ ...f, minPrice: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                >
                  <option value="">No Min</option>
                  {PRICE_OPTIONS.map(p => (
                    <option key={p} value={String(p)}>{formatCurrency(p)}</option>
                  ))}
                </select>
              </div>
              {/* Max Price */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Price</label>
                <select
                  value={filterValues.maxPrice || ""}
                  onChange={e => setFilterValues(f => ({ ...f, maxPrice: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                >
                  <option value="">No Max</option>
                  {PRICE_OPTIONS.map(p => (
                    <option key={p} value={String(p)}>{formatCurrency(p)}</option>
                  ))}
                </select>
              </div>
              {/* Beds */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Min Bedrooms</label>
                <select
                  value={filterValues.beds || ""}
                  onChange={e => setFilterValues(f => ({ ...f, beds: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                >
                  <option value="">Any</option>
                  {BED_OPTIONS.map(b => (
                    <option key={b} value={b}>{b}+ Beds</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4 flex gap-3">
                <button
                  onClick={() => applyFilters(filterValues)}
                  className="px-5 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => { setFilterValues({}); router.push("/search") }}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:border-red-300 hover:text-red-600"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {properties.length} Properties Found
          </h2>
          <div className="text-sm text-gray-500">
            Showing active listings
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Home className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No properties found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your filters or search in a different area</p>
            <button
              onClick={() => router.push("/search")}
              className="px-6 py-2.5 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map(property => {
              const images = getImages(property.images)
              const isSaved = savedIds.includes(property.id)
              return (
                <div
                  key={property.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-md transition-shadow group"
                  onMouseEnter={() => trackView(property.id, leadContactId || undefined)}
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    {images[0] ? (
                      <img
                        src={images[0]}
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    {/* Save button */}
                    <button
                      onClick={() => handleSave(property.id)}
                      className={cn(
                        "absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all",
                        isSaved ? "bg-red-500 text-white" : "bg-white text-gray-500 hover:bg-red-50 hover:text-red-500"
                      )}
                    >
                      <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
                    </button>
                    {/* Status badge */}
                    <div className="absolute top-3 left-3">
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded",
                        property.status === "ACTIVE" ? "bg-green-500 text-white" :
                        property.status === "PENDING" ? "bg-amber-500 text-white" :
                        "bg-gray-500 text-white"
                      )}>
                        {property.status}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
                        {property.title}
                      </h3>
                    </div>
                    <p className="text-lofty-600 font-bold text-lg">
                      {formatCurrency(property.price)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{property.city}, {property.state}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-600 border-t pt-3">
                      {property.bedrooms && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5" /> {property.bedrooms} bd
                        </span>
                      )}
                      {property.bathrooms && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5" /> {property.bathrooms} ba
                        </span>
                      )}
                      {property.sqft && (
                        <span className="flex items-center gap-1">
                          <Square className="w-3.5 h-3.5" /> {property.sqft.toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/property/${property.id}`}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 border-2 border-lofty-200 text-lofty-700 rounded-lg hover:bg-lofty-50 text-sm font-medium transition-colors"
                    >
                      View Details <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Lead capture modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Save This Home</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Create a free account to save favorites and get alerts</p>
                </div>
                <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">First Name *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.firstName}
                      onChange={e => setLeadForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.lastName}
                      onChange={e => setLeadForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    placeholder="(555) 000-0000"
                  />
                </div>

                <div className="bg-lofty-50 rounded-lg p-3 text-xs text-lofty-700">
                  <strong>What happens next:</strong> You'll be instantly matched with our agent who will send you similar properties and help schedule a tour.
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors"
                >
                  Save Home &amp; Connect with Agent
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Continue browsing without saving
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
