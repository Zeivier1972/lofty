"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Home, Plus, Search, Bed, Bath, Square, MapPin,
  DollarSign, Calendar, Eye, Heart, MoreVertical, SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatCurrency, getStatusColor, PROPERTY_TYPES } from "@/lib/utils"

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SOLD", label: "Sold" },
  { value: "EXPIRED", label: "Expired" },
  { value: "OFF_MARKET", label: "Off Market" },
]

interface PropertiesClientProps {
  properties: any[]
  total: number
  filters: any
}

export default function PropertiesClient({ properties, total, filters }: PropertiesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(filters.search || "")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v && k !== key) params.set(k, v as string) })
    if (value && value !== "ALL") params.set(key, value)
    router.push(`/properties?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(filters)
    if (search) params.set("search", search)
    else params.delete("search")
    router.push(`/properties?${params.toString()}`)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} properties in your database</p>
        </div>
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by address, city, zip..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </form>
        <Select value={filters.status || "ALL"} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type || "ALL"} onValueChange={(v) => updateFilter("type", v)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Property Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {PROPERTY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Properties grid */}
      {properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No properties found</p>
          <Button className="mt-4 bg-lofty-600 hover:bg-lofty-700">
            <Plus className="w-4 h-4 mr-2" /> Add Property
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((property) => {
            const images = property.images ? JSON.parse(property.images) : []
            const features = property.features ? JSON.parse(property.features) : []

            return (
              <Card key={property.id} className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                {/* Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {images[0] ? (
                    <img
                      src={images[0]}
                      alt={property.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge className={cn("text-xs font-medium", getStatusColor(property.status))}>
                      {property.status}
                    </Badge>
                  </div>
                  {property.daysOnMarket != null && (
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                      {property.daysOnMarket} DOM
                    </div>
                  )}
                  <button className="absolute bottom-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                    <Heart className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <CardContent className="p-4">
                  {/* Price */}
                  <div className="flex items-start justify-between">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(property.price)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {property.sqft ? `$${Math.round(property.price / property.sqft)}/sqft` : ""}
                    </p>
                  </div>

                  {/* Address */}
                  <p className="text-sm font-medium text-gray-800 mt-1">{property.address}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {property.city}, {property.state} {property.zip}
                  </p>

                  {/* Stats */}
                  <div className="flex gap-4 mt-3 text-sm text-gray-600">
                    {property.bedrooms != null && (
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4 text-gray-400" />
                        {property.bedrooms} bd
                      </div>
                    )}
                    {property.bathrooms != null && (
                      <div className="flex items-center gap-1">
                        <Bath className="w-4 h-4 text-gray-400" />
                        {property.bathrooms} ba
                      </div>
                    )}
                    {property.sqft != null && (
                      <div className="flex items-center gap-1">
                        <Square className="w-4 h-4 text-gray-400" />
                        {property.sqft.toLocaleString()} sqft
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {features.slice(0, 3).map((f: string) => (
                        <span key={f} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Type + interests */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{property.propertyType.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Eye className="w-3.5 h-3.5" />
                      {property._count.interests} interested
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
