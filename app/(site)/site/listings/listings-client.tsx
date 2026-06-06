"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { MapPin, Bed, Bath, Maximize2, SlidersHorizontal } from "lucide-react"
import type { Property } from "@prisma/client"

interface ListingsClientProps {
  properties: Property[]
}

function parseImages(images: string | null | undefined): string[] {
  if (!images) return []
  try {
    return JSON.parse(images)
  } catch {
    return []
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

function PropertyCard({ property }: { property: Property }) {
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
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(201,168,76,0.2)" }}>
                <MapPin className="w-7 h-7" style={{ color: "#c9a84c" }} />
              </div>
              <span className="text-white text-xs opacity-60">No Image</span>
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
          >
            For Sale
          </span>
        </div>
        {property.propertyType && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/40 text-white backdrop-blur-sm">
              {property.propertyType.replace("_", " ")}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="text-2xl font-bold mb-1" style={{ color: "#c9a84c" }}>
          {formatPrice(property.price)}
        </p>
        <p className="text-gray-700 text-sm mb-3 font-medium">
          {property.address}, {property.city}, {property.state} {property.zip}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {property.bedrooms != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {property.bedrooms} bd
            </span>
          )}
          {property.bathrooms != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {property.bathrooms} ba
            </span>
          )}
          {property.sqft != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Maximize2 className="w-3 h-3" />
              {property.sqft.toLocaleString()} sqft
            </span>
          )}
        </div>

        <Link
          href={`/site/listing/${property.id}`}
          className="w-full block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

export default function ListingsClient({ properties }: ListingsClientProps) {
  const [priceRange, setPriceRange] = useState("ALL")
  const [beds, setBeds] = useState("ANY")
  const [propertyType, setPropertyType] = useState("ALL")
  const [sort, setSort] = useState("NEWEST")
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = [...properties]

    if (priceRange === "UNDER_500K") list = list.filter((p) => p.price < 500000)
    else if (priceRange === "500K_1M") list = list.filter((p) => p.price >= 500000 && p.price < 1000000)
    else if (priceRange === "1M_2M") list = list.filter((p) => p.price >= 1000000 && p.price < 2000000)
    else if (priceRange === "2M_PLUS") list = list.filter((p) => p.price >= 2000000)

    if (beds === "1+") list = list.filter((p) => (p.bedrooms ?? 0) >= 1)
    else if (beds === "2+") list = list.filter((p) => (p.bedrooms ?? 0) >= 2)
    else if (beds === "3+") list = list.filter((p) => (p.bedrooms ?? 0) >= 3)
    else if (beds === "4+") list = list.filter((p) => (p.bedrooms ?? 0) >= 4)

    if (propertyType === "SINGLE_FAMILY") list = list.filter((p) => p.propertyType === "SINGLE_FAMILY")
    else if (propertyType === "CONDO") list = list.filter((p) => p.propertyType === "CONDO")
    else if (propertyType === "TOWNHOUSE") list = list.filter((p) => p.propertyType === "TOWNHOUSE")
    else if (propertyType === "LAND") list = list.filter((p) => p.propertyType === "LAND")

    if (sort === "PRICE_HIGH") list.sort((a, b) => b.price - a.price)
    else if (sort === "PRICE_LOW") list.sort((a, b) => a.price - b.price)
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return list
  }, [properties, priceRange, beds, propertyType, sort])

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Page header */}
      <div
        className="pt-32 pb-16 px-6"
        style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}
      >
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: "#c9a84c" }}>
            Exclusive Portfolio
          </p>
          <h1 className="font-serif text-5xl font-bold text-white mb-3">All Properties</h1>
          <p className="text-gray-400 text-lg">
            {properties.length} {properties.length === 1 ? "property" : "properties"} available
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-20 z-40 bg-white shadow-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="hidden md:flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter:</span>
              </div>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="ALL">Any Price</option>
                <option value="UNDER_500K">Under $500K</option>
                <option value="500K_1M">$500K – $1M</option>
                <option value="1M_2M">$1M – $2M</option>
                <option value="2M_PLUS">$2M+</option>
              </select>
              <select
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="ANY">Any Beds</option>
                <option value="1+">1+ Beds</option>
                <option value="2+">2+ Beds</option>
                <option value="3+">3+ Beds</option>
                <option value="4+">4+ Beds</option>
              </select>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="ALL">All Types</option>
                <option value="SINGLE_FAMILY">Single Family</option>
                <option value="CONDO">Condo</option>
                <option value="TOWNHOUSE">Townhouse</option>
                <option value="LAND">Land</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="NEWEST">Newest</option>
                <option value="PRICE_HIGH">Price: High to Low</option>
                <option value="PRICE_LOW">Price: Low to High</option>
              </select>
            </div>

            <button
              className="md:hidden flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            <span className="text-sm text-gray-500">
              <span className="font-semibold text-[#1a1a2e]">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "property" : "properties"} found
            </span>
          </div>

          {filtersOpen && (
            <div className="md:hidden mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700"
              >
                <option value="ALL">Any Price</option>
                <option value="UNDER_500K">Under $500K</option>
                <option value="500K_1M">$500K – $1M</option>
                <option value="1M_2M">$1M – $2M</option>
                <option value="2M_PLUS">$2M+</option>
              </select>
              <select
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700"
              >
                <option value="ANY">Any Beds</option>
                <option value="1+">1+ Beds</option>
                <option value="2+">2+ Beds</option>
                <option value="3+">3+ Beds</option>
                <option value="4+">4+ Beds</option>
              </select>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700"
              >
                <option value="ALL">All Types</option>
                <option value="SINGLE_FAMILY">Single Family</option>
                <option value="CONDO">Condo</option>
                <option value="TOWNHOUSE">Townhouse</option>
                <option value="LAND">Land</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700"
              >
                <option value="NEWEST">Newest</option>
                <option value="PRICE_HIGH">Price: High to Low</option>
                <option value="PRICE_LOW">Price: Low to High</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-gray-100">
              <MapPin className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500 text-xl font-medium">No properties match your filters</p>
            <p className="text-gray-400 mt-2 text-sm">Try adjusting your search criteria</p>
            <button
              onClick={() => {
                setPriceRange("ALL")
                setBeds("ANY")
                setPropertyType("ALL")
                setSort("NEWEST")
              }}
              className="mt-6 px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
