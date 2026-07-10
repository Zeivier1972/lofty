"use client"

import { useState } from "react"
import {
  Search, Mail, MessageSquare, Loader2, Home, MapPin,
  Bed, Bath, Maximize2, CheckCircle, ChevronDown, ChevronUp,
  Send, Square, CheckSquare, X,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface MlsListing {
  listingKey: string
  listingId: string
  address: string
  city: string | null
  state: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  photo: string | null
}

// Selectable MLS subtypes — pick any combination (none = all types)
const PROP_TYPE_OPTIONS = [
  { value: "Single Family Residence", label: "Single Family" },
  { value: "Townhouse", label: "Townhouse" },
  { value: "Condominium", label: "Condo" },
  { value: "Multi Family", label: "Multi-Family" },
]

// CRM buyerPropertyType enum → Bridge subtype
const CRM_TO_BRIDGE: Record<string, string> = {
  SINGLE_FAMILY: "Single Family Residence",
  CONDO: "Condominium",
  TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi Family",
}

interface Props {
  contactId: string
  contactEmail: string | null
  contactPhone: string | null
  defaultLocation?: string
  defaultMaxPrice?: number
  defaultMinBeds?: number
  defaultPropertyType?: string | null
}

function fmtPrice(price: number) {
  if (price >= 1_000_000) return "$" + (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + "M"
  return "$" + price.toLocaleString()
}

export default function PropertySendPanel({
  contactId, contactEmail, contactPhone,
  defaultLocation = "", defaultMaxPrice, defaultMinBeds, defaultPropertyType,
}: Props) {
  const { toast } = useToast()

  // Panel open/close
  const [open, setOpen] = useState(false)

  // Search form
  const [keyword, setKeyword] = useState("")        // MLS# or address keyword
  const [location, setLocation] = useState(defaultLocation)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice ? String(defaultMaxPrice) : "")
  const [beds, setBeds] = useState(defaultMinBeds ? String(defaultMinBeds) : "")
  // Extra ("more") filters
  const [maxBeds, setMaxBeds] = useState("")
  const [minBaths, setMinBaths] = useState("")
  const [minSqft, setMinSqft] = useState("")
  const [maxSqft, setMaxSqft] = useState("")
  const [minYear, setMinYear] = useState("")
  const [maxHoa, setMaxHoa] = useState("")
  const [pool, setPool] = useState(false)
  const [waterfront, setWaterfront] = useState(false)
  const [showMore, setShowMore] = useState(false)
  // Multiple property types — start with the buyer's known preference(s).
  // buyerPropertyType may hold several comma-separated types.
  const [propTypes, setPropTypes] = useState<Set<string>>(
    new Set(
      (defaultPropertyType || "")
        .split(",")
        .map(t => CRM_TO_BRIDGE[t.trim()])
        .filter(Boolean)
    )
  )

  function togglePropType(v: string) {
    setPropTypes(prev => {
      const next = new Set(Array.from(prev))
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  // Results
  const [searching, setSearching] = useState(false)
  const [listings, setListings] = useState<MlsListing[]>([])
  const [searched, setSearched] = useState(false)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Per-card single send (email/sms keys)
  const [sending, setSending] = useState<string | null>(null)
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set())

  // Batch send
  const [batchSending, setBatchSending] = useState<"email" | "sms" | null>(null)
  const [batchSent, setBatchSent] = useState(false)

  // Note
  const [note, setNote] = useState("")
  const [showNote, setShowNote] = useState(false)

  function markSent(key: string) {
    setSentKeys(prev => new Set(Array.from(prev).concat(key)))
  }

  function toggleSelect(listingKey: string) {
    setSelected(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(listingKey)) next.delete(listingKey)
      else next.add(listingKey)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(listings.map(l => l.listingKey)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function search() {
    setSearching(true)
    setListings([])
    setSearched(false)
    setSelected(new Set())
    setBatchSent(false)
    try {
      const qs = new URLSearchParams()
      if (keyword.trim()) qs.set("keyword", keyword.trim())
      if (location.trim()) qs.set("city", location.trim())
      if (minPrice) qs.set("minPrice", minPrice)
      if (maxPrice) qs.set("maxPrice", maxPrice)
      if (beds) qs.set("minBeds", beds)
      if (maxBeds) qs.set("maxBeds", maxBeds)
      if (minBaths) qs.set("minBaths", minBaths)
      if (minSqft) qs.set("minSqft", minSqft)
      if (maxSqft) qs.set("maxSqft", maxSqft)
      if (minYear) qs.set("minYear", minYear)
      if (maxHoa) qs.set("maxHoa", maxHoa)
      if (pool) qs.set("pool", "1")
      if (waterfront) qs.set("waterfront", "1")
      if (propTypes.size) qs.set("type", Array.from(propTypes).join(","))
      qs.set("limit", "12")
      const res = await fetch(`/api/idx/search?${qs}`)
      const data = await res.json()
      setListings(data.results || [])
    } catch {
      toast({ title: "Search failed", description: "Could not reach MLS. Try again.", variant: "destructive" })
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  async function sendOne(listing: MlsListing, method: "email" | "sms") {
    if (method === "email" && !contactEmail) {
      toast({ title: "No email on file", variant: "destructive" }); return
    }
    if (method === "sms" && !contactPhone) {
      toast({ title: "No phone on file", variant: "destructive" }); return
    }
    const key = `${listing.listingKey}:${method}`
    setSending(key)
    try {
      const res = await fetch(`/api/contacts/${contactId}/send-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingKey: listing.listingKey, listingId: listing.listingId,
          address: listing.address, city: listing.city, state: listing.state,
          price: listing.price, beds: listing.beds, baths: listing.baths,
          sqft: listing.sqft, photoUrl: listing.photo,
          method, note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed")
      markSent(key)
      toast({ title: `Sent via ${method}`, description: listing.address || listing.listingId })
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" })
    } finally {
      setSending(null)
    }
  }

  async function sendBatch(method: "email" | "sms") {
    if (method === "email" && !contactEmail) {
      toast({ title: "No email on file", variant: "destructive" }); return
    }
    if (method === "sms" && !contactPhone) {
      toast({ title: "No phone on file", variant: "destructive" }); return
    }
    const toSend = listings.filter(l => selected.has(l.listingKey))
    if (!toSend.length) return

    setBatchSending(method)
    try {
      const res = await fetch(`/api/contacts/${contactId}/send-properties-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listings: toSend.map(l => ({
            listingKey: l.listingKey, listingId: l.listingId,
            address: l.address, city: l.city, state: l.state,
            price: l.price, beds: l.beds, baths: l.baths,
            sqft: l.sqft, photoUrl: l.photo,
          })),
          method,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed")
      // Mark each selected listing as sent for that method
      toSend.forEach(l => markSent(`${l.listingKey}:${method}`))
      setBatchSent(true)
      clearSelection()
      toast({
        title: `${toSend.length} propert${toSend.length === 1 ? "y" : "ies"} sent via ${method}`,
        description: method === "email" ? `Sent to ${contactEmail}` : `Sent to ${contactPhone}`,
      })
    } catch (e: any) {
      toast({ title: "Batch send failed", description: e.message, variant: "destructive" })
    } finally {
      setBatchSending(null)
    }
  }

  const selectedCount = selected.size

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Send className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">Search &amp; Send Properties</p>
            <p className="text-xs text-gray-400">Search live MLS listings and send directly to this client</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Search form */}
          <div className="px-5 pt-4 pb-3 space-y-3">
            {/* Row 1: keyword (MLS# or address) */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">MLS# or Address</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="A11234567, 123 Main St, Brickell…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Row 2: city / area / zip */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">City / Area / ZIP</label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="Miami, 33032, 33034…"
                  className="w-full pl-7 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Row 3: min price + max price + min beds */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Price</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="300000"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Max Price</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="800000"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Beds</label>
                <input
                  type="number"
                  value={beds}
                  onChange={e => setBeds(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="2"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Row 4: property type — pick one OR MORE (none = all types) */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Property Type <span className="font-normal text-gray-400">· pick one or more</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROP_TYPE_OPTIONS.map(o => {
                  const active = propTypes.has(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => togglePropType(o.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {active && <CheckCircle className="w-3 h-3" />}
                      {o.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {propTypes.size === 0
                  ? "Showing all property types"
                  : `Searching ${Array.from(propTypes).map(v => PROP_TYPE_OPTIONS.find(o => o.value === v)?.label).join(" + ")}`}
              </p>
            </div>

            {/* More filters — expandable */}
            <button
              type="button"
              onClick={() => setShowMore(m => !m)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showMore ? "Fewer filters" : "More filters"}
            </button>

            {showMore && (
              <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Max Beds</label>
                    <input type="number" value={maxBeds} onChange={e => setMaxBeds(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Baths</label>
                    <input type="number" value={minBaths} onChange={e => setMinBaths(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Sqft</label>
                    <input type="number" value={minSqft} onChange={e => setMinSqft(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="1000" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Max Sqft</label>
                    <input type="number" value={maxSqft} onChange={e => setMaxSqft(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Built After (year)</label>
                    <input type="number" value={minYear} onChange={e => setMinYear(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="2000" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Max HOA / mo</label>
                    <input type="number" value={maxHoa} onChange={e => setMaxHoa(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={pool} onChange={e => setPool(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Pool
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={waterfront} onChange={e => setWaterfront(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Waterfront
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={search}
              disabled={searching}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1a2744, #2d4070)" }}
            >
              {searching
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching MLS…</>
                : <><Search className="w-4 h-4" /> Search MLS</>}
            </button>
          </div>

          {/* Results */}
          {searched && !searching && listings.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm border-t border-gray-100">
              No listings found. Try adjusting your filters.
            </div>
          )}

          {listings.length > 0 && (
            <div className="border-t border-gray-100">
              {/* Toolbar: select-all + note toggle */}
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectedCount === listings.length ? clearSelection : selectAll}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {selectedCount === listings.length
                      ? <><CheckSquare className="w-3.5 h-3.5 text-blue-600" /> Deselect all</>
                      : <><Square className="w-3.5 h-3.5" /> Select all</>}
                  </button>
                  {selectedCount > 0 && (
                    <span className="text-xs text-blue-600 font-semibold">
                      {selectedCount} selected
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNote(n => !n)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {showNote ? "Hide note" : "+ Add note"}
                </button>
              </div>

              {/* Optional note */}
              {showNote && (
                <div className="px-5 py-3 border-b border-gray-100 bg-yellow-50">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a personal note to include with the properties…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Included in all sends (single and batch)</p>
                </div>
              )}

              {/* Listing cards */}
              <div className="divide-y divide-gray-100">
                {listings.map(listing => {
                  const isSelected = selected.has(listing.listingKey)
                  const emailKey = `${listing.listingKey}:email`
                  const smsKey = `${listing.listingKey}:sms`
                  const emailSent = sentKeys.has(emailKey)
                  const smsSent = sentKeys.has(smsKey)

                  return (
                    <div
                      key={listing.listingKey}
                      className={`flex items-start gap-3 px-5 py-3 transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(listing.listingKey)}
                        className="flex-shrink-0 mt-1"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4.5 h-4.5 text-blue-600" style={{ width: 18, height: 18 }} />
                          : <Square className="w-4.5 h-4.5 text-gray-300 hover:text-gray-500" style={{ width: 18, height: 18 }} />}
                      </button>

                      {/* Photo */}
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {listing.photo
                          ? <img src={listing.photo} alt={listing.address} className="w-full h-full object-cover" />
                          : <Home className="w-5 h-5 text-gray-300" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {listing.price != null && (
                          <p className="font-bold text-emerald-700 text-sm">{fmtPrice(listing.price)}</p>
                        )}
                        <p className="text-sm font-medium text-gray-900 truncate">{listing.address}</p>
                        {listing.city && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {listing.city}{listing.state ? `, ${listing.state}` : ""}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {listing.beds != null && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-500">
                              <Bed className="w-3 h-3" /> {listing.beds}bd
                            </span>
                          )}
                          {listing.baths != null && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-500">
                              <Bath className="w-3 h-3" /> {listing.baths}ba
                            </span>
                          )}
                          {listing.sqft != null && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-500">
                              <Maximize2 className="w-3 h-3" /> {listing.sqft.toLocaleString()} sqft
                            </span>
                          )}
                        </div>
                        {listing.listingId && (
                          <p className="text-xs text-gray-400 mt-0.5">MLS# {listing.listingId}</p>
                        )}
                      </div>

                      {/* Per-card quick send buttons */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => !emailSent && sendOne(listing, "email")}
                          disabled={sending === emailKey || !contactEmail}
                          title={!contactEmail ? "No email on file" : emailSent ? "Already sent" : "Send via email"}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            emailSent
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : !contactEmail
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                          }`}
                        >
                          {sending === emailKey
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : emailSent ? <CheckCircle className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                          {emailSent ? "Sent" : "Email"}
                        </button>

                        <button
                          onClick={() => !smsSent && sendOne(listing, "sms")}
                          disabled={sending === smsKey || !contactPhone}
                          title={!contactPhone ? "No phone on file" : smsSent ? "Already sent" : "Send via SMS"}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            smsSent
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : !contactPhone
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {sending === smsKey
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : smsSent ? <CheckCircle className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          {smsSent ? "Sent" : "SMS"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Batch send bar — appears when ≥1 selected */}
              {selectedCount > 0 && (
                <div className="sticky bottom-0 border-t border-blue-200 bg-blue-600 px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={clearSelection} className="text-blue-200 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <span className="text-white font-semibold text-sm">
                      {selectedCount} propert{selectedCount === 1 ? "y" : "ies"} selected
                    {(!contactEmail || !contactPhone) && (
                      <span className="text-[11px] text-white/70">
                        {!contactEmail && "· no email on file "}
                        {!contactPhone && "· no phone on file"}
                      </span>
                    )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendBatch("sms")}
                      disabled={!!batchSending || !contactPhone}
                      title={!contactPhone ? "This contact has no phone number — add one to send SMS" : "Send the selected properties by text message"}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/20 text-white hover:bg-white/30 disabled:opacity-50 transition-colors"
                    >
                      {batchSending === "sms"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <MessageSquare className="w-3.5 h-3.5" />}
                      Send {selectedCount} via SMS
                    </button>
                    <button
                      onClick={() => sendBatch("email")}
                      disabled={!!batchSending || !contactEmail}
                      title={!contactEmail ? "This contact has no email address — add one to send email" : "Send the selected properties by email"}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      {batchSending === "email"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Mail className="w-3.5 h-3.5" />}
                      Send {selectedCount} via Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
