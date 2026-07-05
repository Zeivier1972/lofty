"use client"

import { useState } from "react"
import {
  Search, Mail, MessageSquare, Loader2, Home, MapPin,
  Bed, Bath, Maximize2, CheckCircle, ChevronDown, ChevronUp, Send,
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

interface Props {
  contactId: string
  contactEmail: string | null
  contactPhone: string | null
  defaultLocation?: string
  defaultMaxPrice?: number
  defaultMinBeds?: number
}

function formatPrice(price: number) {
  if (price >= 1_000_000)
    return "$" + (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + "M"
  return "$" + price.toLocaleString()
}

export default function PropertySendPanel({
  contactId,
  contactEmail,
  contactPhone,
  defaultLocation = "",
  defaultMaxPrice,
  defaultMinBeds,
}: Props) {
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [location, setLocation] = useState(defaultLocation)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice ? String(defaultMaxPrice) : "")
  const [beds, setBeds] = useState(defaultMinBeds ? String(defaultMinBeds) : "")
  const [searching, setSearching] = useState(false)
  const [listings, setListings] = useState<MlsListing[]>([])
  const [searched, setSearched] = useState(false)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState<string | null>(null) // `${listingKey}:email` or `${listingKey}:sms`
  const [sent, setSent] = useState<Set<string>>(new Set())

  async function search() {
    setSearching(true)
    setListings([])
    setSearched(false)
    try {
      const qs = new URLSearchParams()
      if (location.trim()) qs.set("city", location.trim())
      if (minPrice) qs.set("minPrice", minPrice)
      if (maxPrice) qs.set("maxPrice", maxPrice)
      if (beds) qs.set("minBeds", beds)
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

  async function send(listing: MlsListing, method: "email" | "sms") {
    if (method === "email" && !contactEmail) {
      toast({ title: "No email", description: "This contact has no email address.", variant: "destructive" })
      return
    }
    if (method === "sms" && !contactPhone) {
      toast({ title: "No phone", description: "This contact has no phone number.", variant: "destructive" })
      return
    }

    const key = `${listing.listingKey}:${method}`
    setSending(key)
    try {
      const res = await fetch(`/api/contacts/${contactId}/send-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingKey: listing.listingKey,
          listingId: listing.listingId,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          price: listing.price,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          photoUrl: listing.photo,
          method,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed")
      setSent(prev => new Set(Array.from(prev).concat(key)))
      setNoteFor(null)
      setNote("")
      toast({
        title: `Property sent via ${method === "email" ? "email" : "SMS"}`,
        description: `${listing.address || listing.listingId} sent to ${method === "email" ? contactEmail : contactPhone}`,
      })
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" })
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lofty-50 flex items-center justify-center">
            <Send className="w-4 h-4 text-lofty-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">Search &amp; Send Properties</p>
            <p className="text-xs text-gray-400">Search the live MLS and send listings directly to this client</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
          {/* Search form */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Location / City</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="Miami, Aventura, Brickell…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lofty-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Max Price</label>
              <input
                type="number"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                placeholder="800000"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lofty-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Beds</label>
              <input
                type="number"
                value={beds}
                onChange={e => setBeds(e.target.value)}
                placeholder="2"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lofty-400"
              />
            </div>
          </div>

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

          {/* Results */}
          {searched && listings.length === 0 && !searching && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No listings found. Try adjusting your filters.
            </div>
          )}

          {listings.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{listings.length} listing{listings.length !== 1 ? "s" : ""} found</p>
              {listings.map(listing => {
                const emailKey = `${listing.listingKey}:email`
                const smsKey = `${listing.listingKey}:sms`
                const emailSent = sent.has(emailKey)
                const smsSent = sent.has(smsKey)
                const showNote = noteFor === listing.listingKey

                return (
                  <div key={listing.listingKey} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      {/* Photo */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {listing.photo
                          ? <img src={listing.photo} alt={listing.address} className="w-full h-full object-cover" />
                          : <Home className="w-6 h-6 text-gray-300" />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {listing.price != null && (
                          <p className="font-bold text-emerald-700 text-sm">{formatPrice(listing.price)}</p>
                        )}
                        <p className="text-sm font-medium text-gray-900 truncate">{listing.address}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          {listing.city && <><MapPin className="w-3 h-3" /> {listing.city}{listing.state ? `, ${listing.state}` : ""}</>}
                        </p>
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

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {/* Email */}
                        <button
                          onClick={() => emailSent ? null : send(listing, "email")}
                          disabled={sending === emailKey || !contactEmail}
                          title={!contactEmail ? "No email on file" : emailSent ? "Sent!" : "Send via email"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            emailSent
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : !contactEmail
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                          }`}
                        >
                          {sending === emailKey
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : emailSent
                              ? <CheckCircle className="w-3 h-3" />
                              : <Mail className="w-3 h-3" />
                          }
                          {emailSent ? "Sent" : "Email"}
                        </button>

                        {/* SMS */}
                        <button
                          onClick={() => smsSent ? null : send(listing, "sms")}
                          disabled={sending === smsKey || !contactPhone}
                          title={!contactPhone ? "No phone on file" : smsSent ? "Sent!" : "Send via SMS"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            smsSent
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : !contactPhone
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {sending === smsKey
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : smsSent
                              ? <CheckCircle className="w-3 h-3" />
                              : <MessageSquare className="w-3 h-3" />
                          }
                          {smsSent ? "Sent" : "SMS"}
                        </button>

                        {/* Add note toggle */}
                        <button
                          onClick={() => { setNoteFor(showNote ? null : listing.listingKey); if (showNote) setNote("") }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
                        >
                          {showNote ? "Cancel note" : "+ note"}
                        </button>
                      </div>
                    </div>

                    {/* Optional personal note */}
                    {showNote && (
                      <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                        <textarea
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Add a personal note to include with this property…"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lofty-400 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Note will be included when you click Email or SMS above</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
