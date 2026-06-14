"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Home, Plus, Search, Bed, Bath, Square, MapPin,
  DollarSign, Calendar, Eye, Heart, MoreVertical, SlidersHorizontal, X, Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
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
  const { toast } = useToast()
  const [search, setSearch] = useState(filters.search || "")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    address: "", city: "", state: "FL", zip: "", price: "",
    bedrooms: "", bathrooms: "", sqft: "", propertyType: "SINGLE_FAMILY",
    status: "ACTIVE", description: "",
  })
  const [images, setImages] = useState<string[]>([])

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData(); formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImages(prev => [...prev, data.url])
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProperty = async () => {
    if (!form.address || !form.price) return
    setSaving(true)
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "✅ Propiedad agregada" })
      setShowAdd(false)
      setForm({ address: "", city: "", state: "FL", zip: "", price: "", bedrooms: "", bathrooms: "", sqft: "", propertyType: "SINGLE_FAMILY", status: "ACTIVE", description: "" })
      setImages([])
      router.refresh()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

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
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2" onClick={() => setShowAdd(true)}>
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
          <Button className="mt-4 bg-lofty-600 hover:bg-lofty-700" onClick={() => setShowAdd(true)}>
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

    {/* Add Property Modal */}
    {showAdd && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-auto" onClick={() => setShowAdd(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Nueva propiedad</h2>
            <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Fotos</label>
            <div className="flex flex-wrap gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                </div>
              ))}
              <label className={`w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-lofty-400 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => Array.from(e.target.files || []).forEach(handleImageUpload)} />
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-xs text-gray-400">{uploading ? "Subiendo..." : "Agregar foto"}</span>
              </label>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Dirección *</label>
              <input value={form.address} onChange={e => f("address", e.target.value)} placeholder="123 Main St"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ciudad</label>
              <input value={form.city} onChange={e => f("city", e.target.value)} placeholder="Miami"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Zip</label>
              <input value={form.zip} onChange={e => f("zip", e.target.value)} placeholder="33101"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Precio *</label>
              <input type="number" value={form.price} onChange={e => f("price", e.target.value)} placeholder="450000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
              <select value={form.propertyType} onChange={e => f("propertyType", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Cuartos</label>
              <input type="number" value={form.bedrooms} onChange={e => f("bedrooms", e.target.value)} placeholder="3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Baños</label>
              <input type="number" value={form.bathrooms} onChange={e => f("bathrooms", e.target.value)} placeholder="2"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pies² (sqft)</label>
              <input type="number" value={form.sqft} onChange={e => f("sqft", e.target.value)} placeholder="1500"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
              <select value={form.status} onChange={e => f("status", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción</label>
              <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
                placeholder="Describe la propiedad..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lofty-400" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleSaveProperty} disabled={saving || !form.address || !form.price}
              className="bg-lofty-600 hover:bg-lofty-700">
              {saving ? "Guardando..." : "Guardar propiedad"}
            </Button>
          </div>
        </div>
      </div>
    )}
  )
}
