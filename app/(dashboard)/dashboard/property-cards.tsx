"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, Eye, Home, Phone, Mail, MapPin, BedDouble, Bath, Square, X } from "lucide-react"

const LS_KEY = "dismissed_property_cards"

interface Buyer {
  id: string
  name: string
  phone: string | null
  email: string | null
  action: "saved" | "viewed"
  at: string
}

interface PropertyCard {
  id: string
  address: string
  city: string
  state: string
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  images: string | null
  mlsId: string | null
  totalSaves: number
  totalViews: number
  buyers: Buyer[]
}

function getFirstImage(images: string | null): string | null {
  if (!images) return null
  try {
    const parsed = JSON.parse(images)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as string
  } catch {
    if (images.startsWith("http")) return images
  }
  return null
}

export default function PropertyCards() {
  const [cards, setCards] = useState<PropertyCard[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = new Set<string>(JSON.parse(localStorage.getItem(LS_KEY) || "[]"))
    setDismissed(saved)

    fetch("/api/dashboard/property-cards")
      .then(r => r.json())
      .then(d => { if (d.ok) setCards(d.cards || []) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  function dismissCard(id: string) {
    const next = new Set(dismissed).add(id)
    setDismissed(next)
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(next)))
  }

  const visibleCards = cards.filter(c => !dismissed.has(c.id))

  if (!loaded || visibleCards.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Actividad de Propiedades</h2>
          <p className="text-xs text-gray-400 mt-0.5">Propiedades guardadas/vistas en los últimos 30 días</p>
        </div>
        {dismissed.size > 0 && (
          <button
            onClick={() => {
              setDismissed(new Set())
              localStorage.removeItem(LS_KEY)
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Show all ({dismissed.size} hidden)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleCards.map(card => {
          const imgSrc = getFirstImage(card.images)
          const priceStr = card.price ? `$${Number(card.price).toLocaleString()}` : null

          return (
            <div key={card.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4 group relative">
              {/* Dismiss button */}
              <button
                onClick={() => dismissCard(card.id)}
                className="absolute top-3 right-3 p-1 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                title="Mark as seen"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Property info row */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  {imgSrc ? (
                    <img src={imgSrc} alt={card.address} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl select-none">🏠</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{card.address}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{card.city}, {card.state}</span>
                      </p>
                    </div>
                    {priceStr && (
                      <p className="text-sm font-bold text-lofty-700 flex-shrink-0">{priceStr}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {card.bedrooms != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <BedDouble className="w-3 h-3" />{card.bedrooms} bed
                      </span>
                    )}
                    {card.bathrooms != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Bath className="w-3 h-3" />{card.bathrooms} bath
                      </span>
                    )}
                    {card.sqft != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Square className="w-3 h-3" />{Number(card.sqft).toLocaleString()} sqft
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-red-500" />{card.totalSaves} guardados
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />{card.totalViews} vistas
                    </span>
                  </div>
                </div>
              </div>

              {/* Interesados section */}
              {card.buyers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Interesados ({card.buyers.length})
                  </p>
                  <ul className="space-y-2">
                    {card.buyers.map(buyer => (
                      <li key={buyer.id} className="flex items-start justify-between gap-2 py-2 border-t border-gray-100 first:border-t-0">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/contacts/${buyer.id}`}
                            className="text-sm font-medium text-lofty-600 hover:text-lofty-800 hover:underline truncate block"
                          >
                            {buyer.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {buyer.phone && (
                              <a
                                href={`/dialer?contactId=${buyer.id}`}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-lofty-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full"
                              >
                                <Phone className="w-3 h-3" />{buyer.phone}
                              </a>
                            )}
                            {buyer.email && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                <Mail className="w-3 h-3" />{buyer.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          buyer.action === "saved"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-blue-600"
                        }`}>
                          {buyer.action === "saved" ? "♥ guardó" : "👁 vio"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
