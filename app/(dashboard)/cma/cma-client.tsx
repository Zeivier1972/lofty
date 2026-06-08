"use client"

import { useState } from "react"
import { FileText, Plus, Share2, Eye, Trash2, TrendingUp, Home, Calculator, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Comp {
  address: string
  beds: number
  baths: number
  sqft: number
  soldPrice: number
  soldDate: string
  pricePerSqft?: number
  distance?: string
}

interface CMAReport {
  id: string
  title: string
  address: string
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  yearBuilt: number | null
  condition: string
  estimatedMin: number | null
  estimatedMax: number | null
  estimatedValue: number | null
  shareToken: string
  contactId: string | null
  sentAt: string | null
  viewedAt: string | null
  createdAt: string
}

interface Contact { id: string; firstName: string; lastName: string; email: string | null }

const CONDITION_OPTS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_WORK"]
const CONDITION_ES: Record<string, string> = {
  EXCELLENT: "Excelente", GOOD: "Buena", FAIR: "Regular", NEEDS_WORK: "Necesita Reparaciones"
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

export default function CMAClient({ reports: initialReports, contacts }: { reports: CMAReport[]; contacts: Contact[] }) {
  const [reports, setReports] = useState(initialReports)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Form state
  const [form, setForm] = useState({
    title: "", address: "", bedrooms: "", bathrooms: "", sqft: "", yearBuilt: "", condition: "GOOD",
    notes: "", contactId: "", estimatedMin: "", estimatedMax: "", estimatedValue: "",
  })
  const [comps, setComps] = useState<Comp[]>([
    { address: "", beds: 3, baths: 2, sqft: 0, soldPrice: 0, soldDate: "", distance: "" }
  ])

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const addComp = () => setComps(prev => [...prev, { address: "", beds: 3, baths: 2, sqft: 0, soldPrice: 0, soldDate: "", distance: "" }])
  const updateComp = (i: number, k: keyof Comp, v: any) =>
    setComps(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c))
  const removeComp = (i: number) => setComps(prev => prev.filter((_, idx) => idx !== i))

  const calcEstimate = () => {
    const validComps = comps.filter(c => c.soldPrice > 0 && c.sqft > 0)
    if (validComps.length === 0) return
    const pricesPerSqft = validComps.map(c => c.soldPrice / c.sqft)
    const avgPPS = pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length
    const subjectSqft = parseInt(form.sqft) || 0
    if (!subjectSqft) { toast({ title: "Ingresa el área de la propiedad sujeta", variant: "destructive" }); return }
    const est = avgPPS * subjectSqft
    f("estimatedValue", Math.round(est).toString())
    f("estimatedMin", Math.round(est * 0.95).toString())
    f("estimatedMax", Math.round(est * 1.05).toString())
    toast({ title: "Estimado calculado basado en comparables" })
  }

  const handleSave = async () => {
    if (!form.address) { toast({ title: "Dirección requerida", variant: "destructive" }); return }
    setSaving(true)
    try {
      const res = await fetch("/api/cma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
          bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
          sqft: form.sqft ? parseInt(form.sqft) : null,
          yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : null,
          estimatedMin: form.estimatedMin ? parseFloat(form.estimatedMin) : null,
          estimatedMax: form.estimatedMax ? parseFloat(form.estimatedMax) : null,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
          comps: comps.filter(c => c.address),
          contactId: form.contactId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReports(prev => [data, ...prev])
      setShowForm(false)
      toast({ title: "CMA creado exitosamente" })
    } catch (e: any) {
      toast({ title: e.message || "Error al crear CMA", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/cma/${id}`, { method: "DELETE" })
    setReports(prev => prev.filter(r => r.id !== id))
    toast({ title: "CMA eliminado" })
  }

  const shareUrl = (token: string) => `${window.location.origin}/cma/${token}`

  const copyShare = async (token: string) => {
    await navigator.clipboard.writeText(shareUrl(token))
    toast({ title: "Link copiado al portapapeles" })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CMA — Análisis de Mercado</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comparative Market Analysis para vendedores</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Plus className="w-4 h-4" /> Nuevo CMA
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Create Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Crear nuevo CMA</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Subject property */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Home className="w-4 h-4 text-lofty-600" /> Propiedad Sujeta
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Título del reporte</label>
                      <Input placeholder="Ej: CMA para Juan García" value={form.title} onChange={e => f("title", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Dirección *</label>
                      <Input placeholder="123 Ocean Drive, Miami, FL 33139" value={form.address} onChange={e => f("address", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Recámaras</label>
                      <Input type="number" placeholder="3" value={form.bedrooms} onChange={e => f("bedrooms", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Baños</label>
                      <Input type="number" step="0.5" placeholder="2" value={form.bathrooms} onChange={e => f("bathrooms", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Área (sqft)</label>
                      <Input type="number" placeholder="1800" value={form.sqft} onChange={e => f("sqft", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Año de construcción</label>
                      <Input type="number" placeholder="2005" value={form.yearBuilt} onChange={e => f("yearBuilt", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Condición</label>
                      <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" value={form.condition} onChange={e => f("condition", e.target.value)}>
                        {CONDITION_OPTS.map(c => <option key={c} value={c}>{CONDITION_ES[c]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Contacto (opcional)</label>
                      <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" value={form.contactId} onChange={e => f("contactId", e.target.value)}>
                        <option value="">— Ninguno —</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
                      <textarea rows={2} placeholder="Observaciones adicionales..." className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none" value={form.notes} onChange={e => f("notes", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Comps */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-lofty-600" /> Comparables Vendidos
                    </h3>
                    <button onClick={addComp} className="text-xs text-lofty-600 hover:text-lofty-700 font-medium">+ Agregar comparable</button>
                  </div>
                  <div className="space-y-3">
                    {comps.map((comp, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="col-span-3">
                            <Input placeholder="Dirección del comparable" value={comp.address} onChange={e => updateComp(i, "address", e.target.value)} className="text-sm" />
                          </div>
                          <Input type="number" placeholder="Rec" value={comp.beds || ""} onChange={e => updateComp(i, "beds", parseInt(e.target.value))} />
                          <Input type="number" step="0.5" placeholder="Baños" value={comp.baths || ""} onChange={e => updateComp(i, "baths", parseFloat(e.target.value))} />
                          <Input type="number" placeholder="Sqft" value={comp.sqft || ""} onChange={e => updateComp(i, "sqft", parseInt(e.target.value))} />
                          <div className="col-span-2">
                            <Input type="number" placeholder="Precio venta ($)" value={comp.soldPrice || ""} onChange={e => updateComp(i, "soldPrice", parseInt(e.target.value))} />
                          </div>
                          <Input type="date" value={comp.soldDate} onChange={e => updateComp(i, "soldDate", e.target.value)} />
                        </div>
                        {comp.sqft > 0 && comp.soldPrice > 0 && (
                          <p className="text-xs text-green-600 font-medium">${Math.round(comp.soldPrice / comp.sqft)}/sqft</p>
                        )}
                        {comps.length > 1 && (
                          <button onClick={() => removeComp(i)} className="text-xs text-red-400 hover:text-red-600 mt-1">Eliminar</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estimate */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-lofty-600" /> Valor Estimado
                    </h3>
                    <button onClick={calcEstimate} className="text-xs bg-lofty-50 text-lofty-700 hover:bg-lofty-100 px-3 py-1 rounded-full font-medium">
                      Calcular automáticamente
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
                      <Input type="number" placeholder="450000" value={form.estimatedMin} onChange={e => f("estimatedMin", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Estimado</label>
                      <Input type="number" placeholder="475000" value={form.estimatedValue} onChange={e => f("estimatedValue", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
                      <Input type="number" placeholder="500000" value={form.estimatedMax} onChange={e => f("estimatedMax", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-lofty-600 hover:bg-lofty-700">
                  {saving ? "Guardando..." : "Crear CMA"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reports list */}
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300">
            <FileText className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">No hay CMAs creados</p>
            <p className="text-sm mt-1">Crea tu primer análisis de mercado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reports.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{r.address}</p>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Specs */}
                <div className="flex gap-3 text-xs text-gray-500 mb-4">
                  {r.bedrooms && <span>{r.bedrooms} rec</span>}
                  {r.bathrooms && <span>{r.bathrooms} baños</span>}
                  {r.sqft && <span>{r.sqft.toLocaleString()} sqft</span>}
                </div>

                {/* Estimate */}
                {r.estimatedValue && (
                  <div className="bg-lofty-50 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-lofty-600 font-medium">Valor estimado</p>
                    <p className="text-xl font-bold text-lofty-700">{fmt(r.estimatedValue)}</p>
                    {r.estimatedMin && r.estimatedMax && (
                      <p className="text-xs text-lofty-500">{fmt(r.estimatedMin)} – {fmt(r.estimatedMax)}</p>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                  {r.sentAt && <span className="text-green-500">✓ Enviado</span>}
                  {r.viewedAt && <span className="text-blue-500 ml-1">✓ Visto</span>}
                  <span className="ml-auto">{new Date(r.createdAt).toLocaleDateString("es")}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <a href={`/cma/${r.shareToken}`} target="_blank" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={() => copyShare(r.shareToken)} className="gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Compartir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
