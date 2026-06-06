"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bed, Bath, Maximize2, MapPin, Calendar, Car, TreePine,
  ChevronLeft, Phone, Mail, Star, Check
} from "lucide-react"
import type { Property } from "@prisma/client"

interface ListingDetailClientProps {
  property: Property
  similar: Property[]
}

function parseImages(images: string | null | undefined): string[] {
  if (!images) return []
  try {
    return JSON.parse(images)
  } catch {
    return []
  }
}

function parseFeatures(features: string | null | undefined): string[] {
  if (!features) return []
  try {
    const parsed = JSON.parse(features)
    if (Array.isArray(parsed)) return parsed as string[]
    if (typeof parsed === "object" && parsed !== null) return Object.values(parsed) as string[]
    return [String(parsed)]
  } catch {
    return features.split(",").map((f) => f.trim()).filter(Boolean)
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

function SimilarCard({ property }: { property: Property }) {
  const images = parseImages(property.images)
  const imageUrl = images[0] || null

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group">
      <div className="aspect-[4/3] overflow-hidden rounded-t-2xl relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={property.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}
          >
            <MapPin className="w-8 h-8" style={{ color: "#c9a84c" }} />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xl font-bold mb-1" style={{ color: "#c9a84c" }}>
          {formatPrice(property.price)}
        </p>
        <p className="text-gray-600 text-sm mb-3">{property.address}, {property.city}</p>
        <Link
          href={`/site/listing/${property.id}`}
          className="w-full block text-center py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

export default function ListingDetailClient({ property, similar }: ListingDetailClientProps) {
  const images = parseImages(property.images)
  const features = parseFeatures(property.features)
  const [activeImage, setActiveImage] = useState(0)
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: `I'm interested in the property at ${property.address}.`,
    interest: "BUYING",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const displayImages = images.length > 0 ? images : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      })
      if (res.ok) setSubmitted(true)
    } catch {
      // silent fail
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div
        className="pt-24 pb-4 px-6"
        style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}
      >
        <div className="max-w-7xl mx-auto">
          <Link
            href="/site/listings"
            className="inline-flex items-center gap-2 text-gray-300 hover:text-[#c9a84c] transition-colors text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Listings
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
                >
                  {property.status === "ACTIVE" ? "For Sale" : property.status}
                </span>
                {property.propertyType && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white">
                    {property.propertyType.replace("_", " ")}
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mb-1">
                {property.address}
              </h1>
              <p className="text-gray-300 text-lg flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "#c9a84c" }} />
                {property.city}, {property.state} {property.zip}
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-4xl font-bold" style={{ color: "#c9a84c" }}>
                {formatPrice(property.price)}
              </p>
              {property.originalPrice && property.originalPrice > property.price && (
                <p className="text-gray-400 line-through text-sm">{formatPrice(property.originalPrice)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <div className="space-y-3">
              {/* Main image */}
              <div className="aspect-[16/9] rounded-2xl overflow-hidden">
                {displayImages[activeImage] ? (
                  <img
                    src={displayImages[activeImage]}
                    alt={`${property.address} - photo ${activeImage + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}
                  >
                    <div className="text-center">
                      <MapPin className="w-16 h-16 mx-auto mb-3" style={{ color: "#c9a84c", opacity: 0.5 }} />
                      <p className="text-white/50">No image available</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Thumbnails */}
              {displayImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {displayImages.slice(0, 4).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                        activeImage === idx ? "border-[#c9a84c]" : "border-transparent"
                      }`}
                    >
                      <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Key stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-serif text-xl font-bold text-[#1a1a2e] mb-5">Property Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {property.bedrooms != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Bed className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.bedrooms}</p>
                      <p className="text-xs text-gray-500">Bedrooms</p>
                    </div>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Bath className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.bathrooms}</p>
                      <p className="text-xs text-gray-500">Bathrooms</p>
                    </div>
                  </div>
                )}
                {property.sqft != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Maximize2 className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.sqft.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Sq Ft</p>
                    </div>
                  </div>
                )}
                {property.lotSize != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <TreePine className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.lotSize.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Lot Size (sqft)</p>
                    </div>
                  </div>
                )}
                {property.yearBuilt != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Calendar className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.yearBuilt}</p>
                      <p className="text-xs text-gray-500">Year Built</p>
                    </div>
                  </div>
                )}
                {property.garage != null && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,0.15)" }}>
                      <Car className="w-5 h-5" style={{ color: "#c9a84c" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a2e]">{property.garage}</p>
                      <p className="text-xs text-gray-500">Garage Spaces</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {property.description && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-serif text-xl font-bold text-[#1a1a2e] mb-4">About This Property</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
              </div>
            )}

            {/* Features */}
            {features.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-serif text-xl font-bold text-[#1a1a2e] mb-4">Features & Amenities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(201,168,76,0.15)" }}
                      >
                        <Check className="w-3.5 h-3.5" style={{ color: "#c9a84c" }} />
                      </div>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map placeholder */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-serif text-xl font-bold text-[#1a1a2e] mb-4">Location</h2>
              <div className="aspect-[16/7] rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200">
                <div className="text-center text-gray-400">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">📍 Map view coming soon</p>
                  <p className="text-xs mt-1">{property.address}, {property.city}, {property.state}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="text-center mb-5">
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
                  >
                    {property.agentName ? property.agentName.charAt(0) : "A"}
                  </div>
                  <p className="font-serif font-bold text-[#1a1a2e]">
                    {property.agentName || "Your Agent"}
                  </p>
                  <p className="text-gray-500 text-sm">Listing Agent</p>
                </div>

                <div className="flex gap-3 mb-5">
                  {property.agentPhone && (
                    <a
                      href={`tel:${property.agentPhone}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </a>
                  )}
                  {property.agentEmail && (
                    <a
                      href={`mailto:${property.agentEmail}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </a>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  {submitted ? (
                    <div className="text-center py-4">
                      <Star className="w-10 h-10 mx-auto mb-2" style={{ color: "#c9a84c" }} />
                      <p className="font-semibold text-[#1a1a2e]">Message Sent!</p>
                      <p className="text-gray-500 text-sm mt-1">We&apos;ll be in touch soon.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <p className="font-semibold text-[#1a1a2e] text-sm mb-3">Contact Agent</p>
                      <input
                        required
                        type="text"
                        placeholder="First Name *"
                        value={contactForm.firstName}
                        onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#c9a84c]"
                      />
                      <input
                        required
                        type="text"
                        placeholder="Last Name *"
                        value={contactForm.lastName}
                        onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#c9a84c]"
                      />
                      <input
                        required
                        type="email"
                        placeholder="Email *"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#c9a84c]"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#c9a84c]"
                      />
                      <textarea
                        rows={3}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#c9a84c] resize-none"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
                      >
                        {submitting ? "Sending..." : "Send Message"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-semibold text-[#1a1a2e] text-sm mb-3">Quick Info</h3>
                <div className="space-y-2 text-sm">
                  {property.mlsId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">MLS #</span>
                      <span className="font-medium text-[#1a1a2e]">{property.mlsId}</span>
                    </div>
                  )}
                  {property.daysOnMarket != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Days on Market</span>
                      <span className="font-medium text-[#1a1a2e]">{property.daysOnMarket}</span>
                    </div>
                  )}
                  {property.hoa != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">HOA</span>
                      <span className="font-medium text-[#1a1a2e]">${property.hoa}/mo</span>
                    </div>
                  )}
                  {property.taxes != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Annual Taxes</span>
                      <span className="font-medium text-[#1a1a2e]">${property.taxes.toLocaleString()}</span>
                    </div>
                  )}
                  {property.pool && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pool</span>
                      <span className="font-medium text-green-600">Yes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Properties */}
        {similar.length > 0 && (
          <div className="mt-16">
            <h2 className="font-serif text-3xl font-bold text-[#1a1a2e] mb-8">Similar Properties</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similar.map((prop) => (
                <SimilarCard key={prop.id} property={prop} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
