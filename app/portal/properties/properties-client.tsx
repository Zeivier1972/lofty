"use client"

import Link from "next/link"
import { Home, Bed, Bath, Square, MapPin, Heart, ExternalLink, Search } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Property {
  id: string
  address: string
  city: string
  state: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  images: string | null
  status: string
}

interface Props {
  savedProperties: { property: Property; createdAt: string }[]
  preferences: {
    budgetMin: number | null
    budgetMax: number | null
    bedroomsMin: number | null
    location: string | null
  }
}

function getImg(raw: string | null) {
  try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) && a[0] ? a[0] : null } catch { return null }
}

export default function PortalPropertiesClient({ savedProperties, preferences }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Homes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Propiedades Guardadas — {savedProperties.length} saved</p>
        </div>
        <Link
          href="/homes"
          className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-xl text-sm font-medium hover:bg-lofty-700"
        >
          <Search className="w-4 h-4" /> Browse More
        </Link>
      </div>

      {/* Preferences summary */}
      {(preferences.budgetMin || preferences.budgetMax || preferences.bedroomsMin || preferences.location) && (
        <div className="bg-lofty-50 border border-lofty-200 rounded-2xl p-4 mb-6">
          <div className="text-xs font-semibold text-lofty-700 mb-2 uppercase tracking-wide">Your Search Criteria</div>
          <div className="flex flex-wrap gap-3">
            {preferences.budgetMin && preferences.budgetMax && (
              <span className="text-sm bg-white border border-lofty-200 text-lofty-800 px-3 py-1 rounded-full">
                💰 {formatCurrency(preferences.budgetMin)} – {formatCurrency(preferences.budgetMax)}
              </span>
            )}
            {preferences.bedroomsMin && (
              <span className="text-sm bg-white border border-lofty-200 text-lofty-800 px-3 py-1 rounded-full">
                🛏 {preferences.bedroomsMin}+ bedrooms
              </span>
            )}
            {preferences.location && (
              <span className="text-sm bg-white border border-lofty-200 text-lofty-800 px-3 py-1 rounded-full">
                📍 {preferences.location}
              </span>
            )}
          </div>
        </div>
      )}

      {savedProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-lofty-50 rounded-2xl flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-lofty-300" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No saved homes yet</h3>
          <p className="text-gray-500 text-sm mb-2">Browse properties and tap the heart to save your favorites.</p>
          <p className="text-gray-400 text-xs mb-6">Navega propiedades y toca el corazón para guardar tus favoritas.</p>
          <Link
            href="/homes"
            className="flex items-center gap-2 px-6 py-3 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700"
          >
            <Search className="w-4 h-4" /> Browse Properties
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedProperties.map(({ property, createdAt }) => {
            const img = getImg(property.images)
            return (
              <div key={property.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                <div className="relative h-48 bg-gray-200 overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow">
                    <Heart className="w-4 h-4 text-white fill-current" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      property.status === "ACTIVE" ? "bg-green-500 text-white" :
                      property.status === "PENDING" ? "bg-amber-500 text-white" :
                      "bg-gray-500 text-white"
                    }`}>
                      {property.status}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-lofty-600 font-bold text-xl">{formatCurrency(property.price)}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{property.address}</span>
                  </div>
                  <div className="text-xs text-gray-400">{property.city}, {property.state}</div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 border-t pt-3">
                    {property.bedrooms && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{property.bedrooms} bd</span>}
                    {property.bathrooms && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{property.bathrooms} ba</span>}
                    {property.sqft && <span className="flex items-center gap-1"><Square className="w-3.5 h-3.5" />{property.sqft.toLocaleString()}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Link
                      href={`/property/${property.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-lofty-200 text-lofty-700 rounded-xl text-sm font-medium hover:bg-lofty-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Details
                    </Link>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Saved {new Date(createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
