"use client"

import { useState } from "react"
import { X, Phone, Mail, User, MessageSquare, CheckCircle, Calendar, Loader2, MapPin, Bed, Bath, Maximize2 } from "lucide-react"

interface Listing {
  listingKey: string
  listingId: string
  city: string | null
  state: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  subType: string | null
}

interface Props {
  listing: Listing
  calendlyUrl: string | null
  agentName: string
  onClose: () => void
}

function formatPrice(price: number) {
  if (price >= 1_000_000) return "$" + (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + "M"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)
}

export default function InquiryModal({ listing, calendlyUrl, agentName, onClose }: Props) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", message: "" })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const typeLabel = listing.subType
    ? listing.subType.replace(/([A-Z])/g, " $1").trim()
    : "New Construction"

  const locationLabel = [listing.city, listing.state].filter(Boolean).join(", ")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || (!form.phone.trim() && !form.email.trim())) {
      setError("Please enter your name and at least one way to reach you.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email,
          message: form.message,
          mlsId: listing.listingId || listing.listingKey, // real MLS# (A11234567)
          city: listing.city,
          price: listing.price,
          propertyType: typeLabel,
          beds: listing.beds,
          year: listing.yearBuilt,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed")
      setDone(true)
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#fff" }}
      >
        {/* Gold header */}
        <div className="px-6 py-5 text-white" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>

          {/* Property summary chips */}
          <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: "#c9a84c" }}>
            {typeLabel.toUpperCase()}
          </p>
          <h2 className="text-xl font-bold text-white mb-3">
            Get Details &amp; Schedule a Tour
          </h2>
          <div className="flex flex-wrap gap-2">
            {locationLabel && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white/80 bg-white/10">
                <MapPin className="w-3 h-3" /> {locationLabel}
              </span>
            )}
            {listing.price != null && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(201,168,76,0.25)", color: "#e8c97a" }}>
                {formatPrice(listing.price)}
              </span>
            )}
            {listing.beds != null && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white/80 bg-white/10">
                <Bed className="w-3 h-3" /> {listing.beds}bd
              </span>
            )}
            {listing.baths != null && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white/80 bg-white/10">
                <Bath className="w-3 h-3" /> {listing.baths}ba
              </span>
            )}
            {listing.yearBuilt && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white/80 bg-white/10">
                <Calendar className="w-3 h-3" /> {listing.yearBuilt}
              </span>
            )}
          </div>
        </div>

        {done ? (
          /* ── Success state ── */
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
              <CheckCircle className="w-8 h-8" style={{ color: "#c9a84c" }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Request Received!</h3>
            <p className="text-gray-500 text-sm mb-6">
              {agentName} will reach out within 24 hours with property details and availability.
            </p>
            {calendlyUrl && (
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl font-semibold text-sm text-white text-center mb-3 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
              >
                <Calendar className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                Book a Time on Calendar Now
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Continue Browsing
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={submit} className="px-6 py-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">First Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="María"
                    className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="García"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (305) 000-0000"
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="maria@email.com"
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Message <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="I'm interested in this property. Please send me more details…"
                  rows={2}
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : "Request Details & Schedule Tour"}
            </button>

            <p className="text-center text-xs text-gray-400">
              Your info is shared only with {agentName}. No spam, ever.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
