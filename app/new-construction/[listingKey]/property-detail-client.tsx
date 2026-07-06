"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Bed, Bath, Maximize2, Calendar, Home, MapPin,
  Car, Waves, Shield, ChevronLeft, ChevronRight, X,
  DollarSign, Layers,
} from "lucide-react"
import InquiryModal from "../inquiry-modal"

interface Property {
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
  garage: number | null
  pool: boolean | null
  hoa: number | null
  lotAcres: number | null
  features: string[]
  description: string
  photos: string[]
}

interface Props {
  property: Property
  calendlyUrl: string | null
  agentName: string
}

function fmtPrice(p: number) {
  if (p >= 1_000_000) return "$" + (p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1) + "M"
  return "$" + p.toLocaleString()
}

function PhotoGallery({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (!photos.length) {
    return (
      <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <Home className="w-16 h-16 text-gray-600" />
      </div>
    )
  }

  function prev() { setCurrent(i => (i - 1 + photos.length) % photos.length) }
  function next() { setCurrent(i => (i + 1) % photos.length) }

  return (
    <>
      {/* Main photo */}
      <div className="relative aspect-video bg-black overflow-hidden group">
        <img
          src={photos[current]}
          alt={`Property photo ${current + 1}`}
          className="w-full h-full object-cover cursor-zoom-in"
          onClick={() => setLightbox(current)}
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Photo count badge */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium">
          {current + 1} / {photos.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-2 px-1" style={{ scrollbarWidth: "thin" }}>
          {photos.map((src, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === current ? "border-yellow-500" : "border-transparent hover:border-gray-400"}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? (i - 1 + photos.length) % photos.length : 0) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? (i + 1) % photos.length : 0) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={photos[lightbox]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox + 1} of {photos.length} — click outside to close
          </p>
        </div>
      )}
    </>
  )
}

export default function PropertyDetailClient({ property, calendlyUrl, agentName }: Props) {
  const [inquiryOpen, setInquiryOpen] = useState(false)

  const typeLabel = property.subType
    ? property.subType.replace(/([A-Z])/g, " $1").trim()
    : "New Construction"
  const locationLabel = [property.city, property.state].filter(Boolean).join(", ")

  const listingForModal = {
    listingKey: property.listingKey,
    listingId: property.listingId,
    city: property.city,
    state: property.state,
    price: property.price,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    yearBuilt: property.yearBuilt,
    subType: property.subType,
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f9fafb", minHeight: "100vh" }}>
      {/* Nav breadcrumb */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-gray-500">
          <Link href="/new-construction" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            New Construction
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{typeLabel} in {locationLabel || "South Florida"}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — gallery + details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Gallery */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <PhotoGallery photos={property.photos} />
            </div>

            {/* Header: type + price + location */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2" style={{ background: "rgba(201,168,76,0.15)", color: "#9a7c2e" }}>
                    {typeLabel.toUpperCase()} · NEW CONSTRUCTION
                  </span>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {property.price != null ? fmtPrice(property.price) : "Price on Request"}
                  </h1>
                  {locationLabel && (
                    <p className="flex items-center gap-1.5 text-gray-500 mt-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {locationLabel}
                      <span className="ml-2 text-xs text-gray-400 font-mono">MLS# {property.listingId}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Key specs grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {property.beds != null && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Bed className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="font-bold text-gray-900">{property.beds}</p>
                    <p className="text-xs text-gray-500">Bedrooms</p>
                  </div>
                )}
                {property.baths != null && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Bath className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="font-bold text-gray-900">{property.baths}</p>
                    <p className="text-xs text-gray-500">Bathrooms</p>
                  </div>
                )}
                {property.sqft != null && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Maximize2 className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="font-bold text-gray-900">{property.sqft.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Sq Ft</p>
                  </div>
                )}
                {property.yearBuilt != null && (
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Calendar className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="font-bold text-gray-900">{property.yearBuilt}</p>
                    <p className="text-xs text-gray-500">Year Built</p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional features */}
            {(property.garage != null || property.pool != null || property.hoa != null || property.lotAcres != null) && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Property Details</h2>
                <div className="grid grid-cols-2 gap-3">
                  {property.garage != null && property.garage > 0 && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Garage</p>
                        <p className="font-semibold text-gray-900 text-sm">{property.garage} {property.garage === 1 ? "space" : "spaces"}</p>
                      </div>
                    </div>
                  )}
                  {property.pool === true && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <Waves className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Pool</p>
                        <p className="font-semibold text-gray-900 text-sm">Private Pool</p>
                      </div>
                    </div>
                  )}
                  {property.hoa != null && property.hoa > 0 && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">HOA Fee</p>
                        <p className="font-semibold text-gray-900 text-sm">${property.hoa.toLocaleString()}/mo</p>
                      </div>
                    </div>
                  )}
                  {property.lotAcres != null && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Lot Size</p>
                        <p className="font-semibold text-gray-900 text-sm">{property.lotAcres.toFixed(2)} acres</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {property.description && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3">About This Property</h2>
                <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">{property.description}</p>
              </div>
            )}

            {/* Interior features */}
            {property.features.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3">Interior Features</h2>
                <div className="flex flex-wrap gap-2">
                  {property.features.map((f, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Commission-protection notice */}
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                <strong>Buyer Representation:</strong> Address, builder details, and listing agent information are disclosed after you connect with a licensed agent. As your agent, {agentName} represents <em>your</em> interests exclusively at no cost to you.
              </p>
            </div>
          </div>

          {/* Right column — sticky contact card */}
          <div className="space-y-4">
            <div className="sticky top-4">
              {/* Inquiry CTA card */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                <div className="px-6 py-5 text-white" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}>
                  <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: "#c9a84c" }}>
                    EXCLUSIVE ACCESS
                  </p>
                  <h2 className="text-lg font-bold">Get Full Property Details</h2>
                  <p className="text-sm text-white/70 mt-1">
                    Address, floor plans, pricing, and tour scheduling — after a quick intro.
                  </p>
                </div>
                <div className="p-6 space-y-3">
                  <button
                    onClick={() => setInquiryOpen(true)}
                    className="block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)", color: "#0a0e1a" }}
                  >
                    Request Details &amp; Schedule Tour
                  </button>
                  {calendlyUrl && (
                    <a
                      href={calendlyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-3 rounded-xl font-medium text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Book Directly on Calendar
                    </a>
                  )}
                </div>

                {/* Trust signals */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Why Use an Agent</p>
                  <ul className="space-y-2">
                    {[
                      "Buyer representation is free — builder pays",
                      "Access to pre-MLS and exclusive inventory",
                      "Negotiation & contract expertise",
                      "Bilingual service — Atención en Español",
                    ].map(t => (
                      <li key={t} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-yellow-500 font-bold flex-shrink-0">✓</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Back link */}
              <Link
                href="/new-construction"
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors mt-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Browse all listings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {inquiryOpen && (
        <InquiryModal
          listing={listingForModal}
          calendlyUrl={calendlyUrl}
          agentName={agentName}
          onClose={() => setInquiryOpen(false)}
        />
      )}
    </div>
  )
}
