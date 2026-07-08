"use client"

import { useState } from "react"
import {
  Building2, Plus, Trash2, Edit, ExternalLink, X, Save, Loader2,
  TrendingUp, MapPin, Calendar, DollarSign, Users, ChevronDown, ChevronUp,
  Search, AlertCircle, RefreshCw, CheckCircle2, Bot, Home, Sparkles,
  Bed, Bath, Square,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Project = {
  id: string
  name: string
  developer: string
  neighborhood: string
  city: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  status: string
  description?: string
  url?: string
  investmentHighlights?: string
  estimatedROI?: string
  downPayment?: string
  units?: number
  photos?: string[]
}

const STATUS_OPTIONS = [
  { value: "pre_launch", label: "Pre-Launch", color: "bg-purple-100 text-purple-700" },
  { value: "launching", label: "Launching", color: "bg-blue-100 text-blue-700" },
  { value: "under_construction", label: "Under Construction", color: "bg-amber-100 text-amber-700" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
]

// Commission-safe area label — never the street address
function area(p: { neighborhood?: string; city?: string; zipCode?: string }): string {
  return [p.neighborhood, p.city].filter(Boolean).join(", ") || p.zipCode || "Miami area"
}

const EMPTY_FORM: Partial<Project> = {
  name: "", developer: "", neighborhood: "", city: "Miami", zipCode: "",
  status: "pre_launch", description: "", url: "",
  investmentHighlights: "", estimatedROI: "", downPayment: "", bedrooms: "", deliveryDate: "",
}

type MLSListing = {
  mlsId: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  yearBuilt: number | null
  propertySubType: string
  description: string
  agentName: string
  office: string
  daysOnMarket: number | null
  image: string | null
}

type ScrapedCommunity = {
  area: string
  city: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  bathrooms?: string
  sqft?: number
  deliveryDate?: string
  status?: string
  description?: string
  imageUrl?: string
  scrapedAt: string
}

interface Props {
  initialProjects: Project[]
  scrapedCommunities?: ScrapedCommunity[]
  scrapedAt?: string
}

export default function PreConstructionClient({ initialProjects, scrapedCommunities = [], scrapedAt }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [form, setForm] = useState<Partial<Project> | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ count: number; strategy: string; chromiumPath?: string | null; errors?: string[] } | null>(null)
  const [liveScrapped, setLiveScraped] = useState<ScrapedCommunity[]>(scrapedCommunities)
  const [mlsListings, setMlsListings] = useState<MLSListing[]>([])
  const [mlsLoading, setMlsLoading] = useState(false)
  const [mlsTotal, setMlsTotal] = useState<number | null>(null)
  const [mlsError, setMlsError] = useState<string | null>(null)
  const [mlsMinYear, setMlsMinYear] = useState(2025)
  const [mlsKeyword, setMlsKeyword] = useState("")
  const [savingMlsId, setSavingMlsId] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  async function backfillPhotos() {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await fetch("/api/pre-construction/backfill-photos", { method: "POST" })
      const data = await res.json()
      setBackfillMsg(data.message || (data.ok ? `Updated ${data.updated}` : "Failed"))
      if (data.updated > 0) setTimeout(() => window.location.reload(), 1200)
    } catch {
      setBackfillMsg("Could not fetch photos — try again.")
    } finally {
      setBackfilling(false)
    }
  }

  const filtered = projects.filter(p =>
    `${p.name} ${p.developer} ${p.neighborhood} ${p.city}`.toLowerCase().includes(search.toLowerCase())
  )

  const mlsFiltered = search.trim()
    ? mlsListings.filter(l =>
        `${l.address} ${l.city} ${l.zip} ${l.propertySubType} ${l.description}`.toLowerCase().includes(search.toLowerCase())
      )
    : mlsListings

  const statusInfo = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0]

  async function save() {
    if (!form?.name?.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/pre-construction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const saved: Project = await res.json()
      setProjects(prev => {
        const idx = prev.findIndex(p => p.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [...prev, saved]
      })
      setForm(null)
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project?")) return
    await fetch(`/api/pre-construction?id=${id}`, { method: "DELETE" })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const f = (field: keyof Project, value: any) =>
    setForm(prev => prev ? { ...prev, [field]: value } : prev)

  async function syncShowingNew() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/pre-construction/sync", { method: "POST" })
      if (!res.ok) {
        setSyncResult({ count: 0, strategy: "error", errors: ["Server returned " + res.status] })
        return
      }
      const data = await res.json()
      setSyncResult({ count: data.count || 0, strategy: data.strategy || "unknown", chromiumPath: data.chromiumPath, errors: data.errors })
      if (data.communities?.length > 0) setLiveScraped(data.communities)
    } catch (e: any) {
      setSyncResult({ count: 0, strategy: "error", errors: [e?.message] })
    } finally {
      setSyncing(false)
    }
  }

  async function searchMLS() {
    setMlsLoading(true)
    setMlsError(null)
    try {
      const params = new URLSearchParams({ minYear: String(mlsMinYear), limit: "48" })
      if (mlsKeyword.trim()) params.set("keyword", mlsKeyword.trim())
      const res = await fetch(`/api/mls/new-construction?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Search failed")
      setMlsListings(data.results || [])
      setMlsTotal(data.total ?? null)
    } catch (e: any) {
      setMlsError(e.message)
    } finally {
      setMlsLoading(false)
    }
  }

  async function saveFromMLS(l: MLSListing) {
    setSavingMlsId(l.mlsId)
    try {
      const project = {
        name: l.address,
        developer: l.office || l.agentName || "",
        neighborhood: "",
        city: l.city,
        zipCode: l.zip,
        priceMin: l.price,
        priceMax: l.price,
        bedrooms: l.bedrooms != null ? `${l.bedrooms}BR` : undefined,
        deliveryDate: l.yearBuilt ? `${l.yearBuilt}` : undefined,
        status: "under_construction",
        description: l.description || undefined,
        photos: l.image ? [l.image] : undefined,
      }
      const res = await fetch("/api/pre-construction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
      const saved: Project = await res.json()
      setProjects(prev => {
        if (prev.find(p => p.id === saved.id)) return prev
        return [...prev, saved]
      })
    } finally {
      setSavingMlsId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pre-Construction Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">Investment properties available for Colombian and Latin American buyers</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg overflow-hidden bg-white">
              <select
                value={mlsMinYear}
                onChange={e => setMlsMinYear(Number(e.target.value))}
                className="text-sm px-2 py-2 bg-transparent border-none outline-none text-gray-700"
              >
                <option value={2025}>From 2025</option>
                <option value={2026}>From 2026</option>
                <option value={2027}>From 2027</option>
              </select>
              <div className="w-px h-6 bg-gray-200" />
              <input
                type="text"
                value={mlsKeyword}
                onChange={e => setMlsKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchMLS()}
                placeholder="Building name… (e.g. Domus)"
                className="text-sm px-2 py-2 bg-transparent border-none outline-none text-gray-700 w-44 placeholder:text-gray-400"
              />
              <button
                onClick={searchMLS}
                disabled={mlsLoading}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                {mlsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Search MLS New Construction
              </button>
            </div>
            <button
              onClick={syncShowingNew}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-40"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync ShowingNew
            </button>
            <button
              onClick={backfillPhotos}
              disabled={backfilling}
              title="Find and attach MLS photos for projects that don't have one"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium disabled:opacity-40"
            >
              {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
              Fetch missing photos
            </button>
            <button
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Project
            </button>
          </div>
        </div>

        {/* Photo backfill status */}
        {backfillMsg && (
          <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-800">
            <Home className="w-3.5 h-3.5 flex-shrink-0" /> {backfillMsg}
          </div>
        )}

        {/* ShowingNew sync status */}
        {(liveScrapped.length > 0 || syncResult) && (
          <div className={cn(
            "mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
            syncResult?.strategy === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
          )}>
            <Bot className="w-3.5 h-3.5 flex-shrink-0" />
            {syncResult ? (
              syncResult.strategy === "error"
                ? `Sync failed: ${syncResult.errors?.[0] || "unknown error"}`
                : syncResult.count > 0
                  ? `Synced ${syncResult.count} communities from ShowingNew`
                  : syncResult.chromiumPath
                    ? `Chromium found at ${syncResult.chromiumPath} but no communities extracted — check Railway logs for details`
                    : `Chromium not found on server. Set SHOWINGNEW_CHROMIUM_PATH in Railway environment variables.`
            ) : (
              `${liveScrapped.length} communities synced from ShowingNew${scrapedAt ? ` · Last sync: ${new Date(scrapedAt).toLocaleDateString()}` : ""}`
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        {/* Add/Edit form */}
        {form && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">{form.id ? "Edit Project" : "Add New Project"}</h2>
              <button onClick={() => setForm(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Project Name *</label>
                <input value={form.name || ""} onChange={e => f("name", e.target.value)} placeholder="e.g. Baccarat Residences" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Developer</label>
                <input value={form.developer || ""} onChange={e => f("developer", e.target.value)} placeholder="e.g. Related Group" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <select value={form.status || "pre_launch"} onChange={e => f("status", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Neighborhood</label>
                <input value={form.neighborhood || ""} onChange={e => f("neighborhood", e.target.value)} placeholder="e.g. Brickell" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">City</label>
                <input value={form.city || ""} onChange={e => f("city", e.target.value)} placeholder="Miami" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Zip Code <span className="text-gray-400 font-normal">(for AI filtering)</span></label>
                <input value={form.zipCode || ""} onChange={e => f("zipCode", e.target.value)} placeholder="e.g. 33131" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Price Min ($)</label>
                <input type="number" value={form.priceMin || ""} onChange={e => f("priceMin", e.target.value)} placeholder="500000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Price Max ($)</label>
                <input type="number" value={form.priceMax || ""} onChange={e => f("priceMax", e.target.value)} placeholder="2000000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit Types / Bedrooms</label>
                <input value={form.bedrooms || ""} onChange={e => f("bedrooms", e.target.value)} placeholder="e.g. Studios, 1BR, 2BR, 3BR" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Delivery Date</label>
                <input value={form.deliveryDate || ""} onChange={e => f("deliveryDate", e.target.value)} placeholder="e.g. Q4 2026" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Estimated ROI</label>
                <input value={form.estimatedROI || ""} onChange={e => f("estimatedROI", e.target.value)} placeholder="e.g. 8-12% Airbnb" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Down Payment Required</label>
                <input value={form.downPayment || ""} onChange={e => f("downPayment", e.target.value)} placeholder="e.g. 30% at signing" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Total Units</label>
                <input type="number" value={form.units || ""} onChange={e => f("units", e.target.value)} placeholder="e.g. 80" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Photo URL <span className="text-gray-400 font-normal">(shown to you and sent to leads)</span></label>
                <div className="flex gap-3 items-start">
                  <input
                    value={form.photos?.[0] || ""}
                    onChange={e => f("photos", e.target.value.trim() ? [e.target.value.trim()] : [])}
                    placeholder="https://…/project-photo.jpg"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {form.photos?.[0] && (
                    <img src={form.photos[0]} alt="Project preview" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Project URL</label>
                <input value={form.url || ""} onChange={e => f("url", e.target.value)} placeholder="https://preconstruction.miami/developments/..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Investment Highlights</label>
                <textarea value={form.investmentHighlights || ""} onChange={e => f("investmentHighlights", e.target.value)} rows={2} placeholder="Key selling points for investors (Airbnb-friendly, condo-hotel license, strong appreciation area...)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <textarea value={form.description || ""} onChange={e => f("description", e.target.value)} rows={3} placeholder="Project description, amenities, location details..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving || !form.name?.trim()} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Project
              </button>
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* MLS New Construction results */}
        {(mlsListings.length > 0 || mlsError) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                From MLS — New Construction {mlsMinYear}+
                {mlsTotal != null && (
                  <span className="text-gray-400 font-normal">
                    {" "}({search.trim() ? `${mlsFiltered.length} of ${mlsTotal.toLocaleString()}` : mlsTotal.toLocaleString()} total)
                  </span>
                )}
              </h2>
              <span className="text-xs text-gray-400">— click "Save as Project" to add to your list</span>
            </div>

            {mlsError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-3">
                {mlsError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {mlsFiltered.map((l) => {
                const alreadySaved = projects.some(p => p.name === l.address && p.city === l.city)
                return (
                  <div key={l.mlsId} className="bg-indigo-50 border border-indigo-100 rounded-xl overflow-hidden">
                    {l.image && (
                      <img src={l.image} alt={l.address} className="w-full h-36 object-cover" />
                    )}
                    {!l.image && (
                      <div className="w-full h-20 bg-indigo-100 flex items-center justify-center">
                        <Home className="w-8 h-8 text-indigo-300" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-indigo-900 leading-tight truncate">{l.address}</p>
                          <p className="text-xs text-indigo-600">{l.city}, {l.state} {l.zip}</p>
                        </div>
                        <span className="text-xs font-bold text-indigo-700 flex-shrink-0">${l.price.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        {l.bedrooms != null && <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{l.bedrooms}bd</span>}
                        {l.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{l.bathrooms}ba</span>}
                        {l.sqft && <span className="flex items-center gap-1"><Square className="w-3 h-3" />{l.sqft.toLocaleString()} sqft</span>}
                        {l.yearBuilt && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Built {l.yearBuilt}</span>}
                      </div>

                      {l.propertySubType && (
                        <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 mb-2">{l.propertySubType}</span>
                      )}

                      {l.description && (
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-2">{l.description}</p>
                      )}

                      {l.agentName && (
                        <p className="text-[10px] text-gray-400 truncate mb-2">Agent: {l.agentName} · {l.office}</p>
                      )}

                      <button
                        onClick={() => saveFromMLS(l)}
                        disabled={savingMlsId === l.mlsId || alreadySaved}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                          alreadySaved
                            ? "bg-gray-100 text-gray-400 cursor-default"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                        )}
                      >
                        {savingMlsId === l.mlsId
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                          : alreadySaved
                            ? <><CheckCircle2 className="w-3 h-3" /> Saved</>
                            : <><Plus className="w-3 h-3" /> Save as Project</>
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ShowingNew scraped communities — read-only */}
        {liveScrapped.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-700">From ShowingNew ({liveScrapped.length})</h2>
              <span className="text-xs text-gray-400">— auto-synced, shown to AI only, never shows builder/URL to leads</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {liveScrapped.map((c, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700">ShowingNew</span>
                    {c.status && <span className="text-xs text-blue-500 capitalize">· {c.status}</span>}
                  </div>
                  {c.imageUrl && (
                    <img src={c.imageUrl} alt={c.area} className="w-full h-28 object-cover rounded-lg mb-2" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                      <MapPin className="w-3 h-3 text-gray-400" /> {c.area}
                      {c.zipCode && <span className="text-gray-400">· {c.zipCode}</span>}
                    </div>
                    {(c.priceMin || c.priceMax) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <DollarSign className="w-3 h-3 text-gray-400" />
                        {c.priceMin ? `$${c.priceMin.toLocaleString()}` : ""}
                        {c.priceMin && c.priceMax ? " – " : ""}
                        {c.priceMax ? `$${c.priceMax.toLocaleString()}` : ""}
                      </div>
                    )}
                    {(c.bedrooms || c.bathrooms) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Users className="w-3 h-3 text-gray-400" />
                        {c.bedrooms && <span>{c.bedrooms} beds</span>}
                        {c.bedrooms && c.bathrooms && <span className="text-gray-300">·</span>}
                        {c.bathrooms && <span>{c.bathrooms} baths</span>}
                      </div>
                    )}
                    {c.sqft && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-400 font-mono text-[10px]">sqft</span>
                        {c.sqft.toLocaleString()} sq ft
                      </div>
                    )}
                    {c.deliveryDate && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Calendar className="w-3 h-3 text-gray-400" /> {c.deliveryDate}
                      </div>
                    )}
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual projects grid */}
        {filtered.length === 0 && !form ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No pre-construction projects yet</p>
            <p className="text-sm text-gray-400 mt-1">Add projects from preconstruction.miami or other sources</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const st = statusInfo(p.status)
              const isExpanded = expandedId === p.id
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Hero photo — so you recognize the project at a glance */}
                  <div className="relative h-40 bg-gray-100">
                    {p.photos?.[0] ? (
                      <img src={p.photos[0]} alt={area(p)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <Building2 className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <span className={cn("absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm", st.color)}>{st.label}</span>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button onClick={() => setForm({ ...p })} className="p-1.5 bg-white/90 text-gray-500 hover:text-emerald-600 rounded-lg shadow-sm transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(p.id)} className="p-1.5 bg-white/90 text-gray-500 hover:text-red-500 rounded-lg shadow-sm transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Area is the headline — how you identify which project, not the street address */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <h3 className="font-bold text-gray-900 text-base leading-tight">{area(p)}</h3>
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
                      {p.developer && <span>{p.developer}</span>}
                      {p.developer && p.name && <span className="text-gray-300">·</span>}
                      {p.name && <span className="truncate" title={p.name}>{p.name}</span>}
                    </div>

                    <div className="space-y-1.5">
                      {(p.priceMin || p.priceMax) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {p.priceMin ? `$${p.priceMin.toLocaleString()}` : ""}
                          {p.priceMin && p.priceMax ? " – " : ""}
                          {p.priceMax ? `$${p.priceMax.toLocaleString()}` : ""}
                        </div>
                      )}
                      {p.deliveryDate && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          Delivery: {p.deliveryDate}
                        </div>
                      )}
                      {p.estimatedROI && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                          ROI: {p.estimatedROI}
                        </div>
                      )}
                    </div>

                    {p.investmentHighlights && (
                      <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg text-xs text-emerald-800">
                        {p.investmentHighlights}
                      </div>
                    )}
                  </div>

                  {/* Expandable details */}
                  {(p.description || p.bedrooms || p.downPayment || p.units || p.url) && (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Less</> : <><ChevronDown className="w-3.5 h-3.5" /> More details</>}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-2 border-t border-gray-100 pt-3">
                          {p.bedrooms && <p className="text-xs text-gray-600"><span className="font-semibold">Units:</span> {p.bedrooms}</p>}
                          {p.units && <p className="text-xs text-gray-600"><span className="font-semibold">Total units:</span> {p.units}</p>}
                          {p.downPayment && <p className="text-xs text-gray-600"><span className="font-semibold">Down payment:</span> {p.downPayment}</p>}
                          {p.description && <p className="text-xs text-gray-600 leading-relaxed">{p.description}</p>}
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <ExternalLink className="w-3 h-3" /> View project website
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
