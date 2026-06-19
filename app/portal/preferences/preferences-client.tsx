"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Home, Building2, Layers, MapPin, Sparkles,
  ChevronRight, ChevronLeft, CheckCircle2,
  DollarSign, Bed, Bath, Clock, Target,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PrefsFormData {
  purpose: string
  timelineMonths: number | null
  budgetMin: number | null
  budgetMax: number | null
  propertyType: string
  bedroomsMin: number | null
  bathroomsMin: number | null
  location: string
  mustHaves: string[]
}

const PURPOSES = [
  { value: "LIVE", icon: Home, label: "Buy to Live", labelEs: "Para vivir", color: "bg-lofty-600" },
  { value: "INVEST", icon: Building2, label: "Investment", labelEs: "Inversión", color: "bg-emerald-600" },
  { value: "VACATION", icon: MapPin, label: "Vacation Home", labelEs: "Casa vacacional", color: "bg-amber-500" },
]

const TIMELINES = [
  { months: 3, label: "1–3 months", labelEs: "1–3 meses" },
  { months: 6, label: "3–6 months", labelEs: "3–6 meses" },
  { months: 12, label: "6–12 months", labelEs: "6–12 meses" },
  { months: 24, label: "Just exploring", labelEs: "Solo explorando" },
]

const PROPERTY_TYPES = [
  { value: "SINGLE_FAMILY", label: "Single Family", icon: Home },
  { value: "CONDO", label: "Condo", icon: Building2 },
  { value: "TOWNHOUSE", label: "Townhouse", icon: Layers },
  { value: "", label: "Any Type", icon: Sparkles },
]

const BUDGET_PRESETS = [300000, 500000, 750000, 1000000, 1500000, 2000000]

const MUST_HAVES = [
  { value: "pool", label: "Pool", emoji: "🏊" },
  { value: "garage", label: "Garage", emoji: "🚗" },
  { value: "waterfront", label: "Waterfront", emoji: "🌊" },
  { value: "gated", label: "Gated Community", emoji: "🔒" },
  { value: "new_construction", label: "New Construction", emoji: "🏗️" },
  { value: "smart_home", label: "Smart Home", emoji: "📱" },
]

function formatBudget(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

const STEPS = ["Goal", "Budget", "Details", "Location"]

interface InitialPrefs {
  purpose?: string
  timelineMonths?: number | null
  budgetMin?: number | null
  budgetMax?: number | null
  propertyType?: string
  bedroomsMin?: number | null
  bathroomsMin?: number | null
  location?: string
  mustHaves?: string  // raw JSON string from DB
}

export default function PreferencesClient({
  initialPrefs,
}: {
  initialPrefs: InitialPrefs | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PrefsFormData>({
    purpose: initialPrefs?.purpose || "",
    timelineMonths: initialPrefs?.timelineMonths || null,
    budgetMin: initialPrefs?.budgetMin || null,
    budgetMax: initialPrefs?.budgetMax || null,
    propertyType: initialPrefs?.propertyType || "",
    bedroomsMin: initialPrefs?.bedroomsMin || null,
    bathroomsMin: initialPrefs?.bathroomsMin || null,
    location: initialPrefs?.location || "",
    mustHaves: (() => {
      try { return JSON.parse((initialPrefs as any)?.mustHaves || "[]") } catch { return [] }
    })(),
  })

  function set<K extends keyof PrefsFormData>(key: K, value: PrefsFormData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }

  function toggleMustHave(val: string) {
    setData(d => ({
      ...d,
      mustHaves: d.mustHaves.includes(val)
        ? d.mustHaves.filter(x => x !== val)
        : [...d.mustHaves, val],
    }))
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      await fetch("/api/portal/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      router.push("/portal/matches")
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-600 to-lofty-600 rounded-2xl mb-4 shadow-lg">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">AI Property Match</h1>
        <p className="text-gray-500 text-sm mt-1">Tell Sofia what you&apos;re looking for · Cuéntale a Sofía lo que buscas</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                i < step ? "bg-lofty-600 border-lofty-600 text-white" :
                i === step ? "bg-white border-lofty-600 text-lofty-600" :
                "bg-white border-gray-200 text-gray-400"
              )}>
                {i < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium", i === step ? "text-lofty-700" : "text-gray-400")}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 flex-1 mb-5 mx-1", i < step ? "bg-lofty-600" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Goal & Timeline */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">What&apos;s your goal?</h2>
            <p className="text-sm text-gray-500 mb-4">¿Cuál es tu objetivo?</p>
            <div className="grid grid-cols-3 gap-3">
              {PURPOSES.map(p => (
                <button
                  key={p.value}
                  onClick={() => set("purpose", p.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    data.purpose === p.value
                      ? "border-lofty-600 bg-lofty-50"
                      : "border-gray-200 bg-white hover:border-lofty-300"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", p.color)}>
                    <p.icon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                    <div className="text-xs text-gray-400">{p.labelEs}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">What&apos;s your timeline?</h2>
            <p className="text-sm text-gray-500 mb-4">¿En qué plazo quieres comprar?</p>
            <div className="grid grid-cols-2 gap-3">
              {TIMELINES.map(t => (
                <button
                  key={t.months}
                  onClick={() => set("timelineMonths", t.months)}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all",
                    data.timelineMonths === t.months
                      ? "border-lofty-600 bg-lofty-50"
                      : "border-gray-200 bg-white hover:border-lofty-300"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    data.timelineMonths === t.months ? "bg-lofty-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-400">{t.labelEs}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Budget */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">What&apos;s your budget?</h2>
            <p className="text-sm text-gray-500 mb-4">¿Cuál es tu presupuesto? (Optional / Opcional)</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
                  <DollarSign className="w-3 h-3 inline mr-1" />Minimum
                </label>
                <input
                  type="number"
                  placeholder="e.g. 300000"
                  value={data.budgetMin || ""}
                  onChange={e => set("budgetMin", e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
                  <DollarSign className="w-3 h-3 inline mr-1" />Maximum
                </label>
                <input
                  type="number"
                  placeholder="e.g. 800000"
                  value={data.budgetMax || ""}
                  onChange={e => set("budgetMax", e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick select max budget</div>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => set("budgetMax", p)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                      data.budgetMax === p
                        ? "bg-lofty-600 text-white border-lofty-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-lofty-400"
                    )}
                  >
                    {formatBudget(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Property Details */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Property type</h2>
            <p className="text-sm text-gray-500 mb-4">Tipo de propiedad</p>
            <div className="grid grid-cols-2 gap-3">
              {PROPERTY_TYPES.map(pt => (
                <button
                  key={pt.value}
                  onClick={() => set("propertyType", pt.value)}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all",
                    data.propertyType === pt.value
                      ? "border-lofty-600 bg-lofty-50"
                      : "border-gray-200 bg-white hover:border-lofty-300"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    data.propertyType === pt.value ? "bg-lofty-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    <pt.icon className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{pt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Bedrooms & Bathrooms</h2>
            <p className="text-sm text-gray-500 mb-4">Habitaciones y baños (minimum)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5" /> Min Bedrooms
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => set("bedroomsMin", n)}
                      className={cn(
                        "w-10 h-10 rounded-xl border-2 text-sm font-bold transition-all",
                        data.bedroomsMin === n
                          ? "bg-lofty-600 border-lofty-600 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-lofty-400"
                      )}
                    >
                      {n}{n === 5 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Bath className="w-3.5 h-3.5" /> Min Bathrooms
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => set("bathroomsMin", n)}
                      className={cn(
                        "w-10 h-10 rounded-xl border-2 text-sm font-bold transition-all",
                        data.bathroomsMin === n
                          ? "bg-lofty-600 border-lofty-600 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-lofty-400"
                      )}
                    >
                      {n}{n === 4 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Location & Must-Haves */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Preferred area</h2>
            <p className="text-sm text-gray-500 mb-4">¿Dónde quieres vivir? (city, neighborhood, zip)</p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="e.g. Miami Beach, Coral Gables, Doral..."
                value={data.location}
                onChange={e => set("location", e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lofty-400"
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Must-haves</h2>
            <p className="text-sm text-gray-500 mb-4">Features you can&apos;t live without · Lo que no puede faltar</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MUST_HAVES.map(mh => {
                const selected = data.mustHaves.includes(mh.value)
                return (
                  <button
                    key={mh.value}
                    onClick={() => toggleMustHave(mh.value)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-left",
                      selected
                        ? "border-lofty-600 bg-lofty-50"
                        : "border-gray-200 bg-white hover:border-lofty-300"
                    )}
                  >
                    <span className="text-xl">{mh.emoji}</span>
                    <span className={cn("text-sm font-medium", selected ? "text-lofty-700" : "text-gray-700")}>
                      {mh.label}
                    </span>
                    {selected && (
                      <CheckCircle2 className="w-4 h-4 text-lofty-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-3 mt-10">
        {step > 0 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex-1" />

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-2 px-6 py-3 bg-lofty-600 text-white rounded-xl text-sm font-semibold hover:bg-lofty-700 transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-lofty-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? (
              "Calculating matches..."
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Find My Matches
              </>
            )}
          </button>
        )}
      </div>

      {/* Skip link */}
      {step === 0 && (
        <p className="text-center mt-4">
          <button
            onClick={() => router.push("/portal/matches")}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Skip for now — show me all properties
          </button>
        </p>
      )}
    </div>
  )
}
