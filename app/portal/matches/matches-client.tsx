"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Home, Bed, Bath, Square, MapPin, Heart, HeartOff,
  Sparkles, Settings2, MessageSquare, ArrowRight, Star,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface Property {
  id: string
  address: string
  city: string
  state: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  propertyType: string
  images: string | null
  status: string
}

interface Match {
  property: Property
  score: number
  reasons: string[]
  saved: boolean
  aiExplanation: string
}

interface Props {
  matches: Match[]
  hasPrefs: boolean
  firstName: string
}

function getImg(raw: string | null): string | null {
  try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) && a[0] ? a[0] : null } catch { return null }
}

function ScoreRing({ score }: { score: number }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#c9a84c" : score >= 40 ? "#2563eb" : "#9ca3af"
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Great" : score >= 40 ? "Good" : "Partial"
  const labelEs = score >= 80 ? "Excelente" : score >= 60 ? "Muy bueno" : score >= 40 ? "Bueno" : "Parcial"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>{score}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold" style={{ color }}>{label}</div>
        <div className="text-[10px] text-gray-400">{labelEs}</div>
      </div>
    </div>
  )
}

function MatchCard({ match, onToggleSave }: { match: Match; onToggleSave: (id: string, saved: boolean) => void }) {
  const img = getImg(match.property.images)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      await fetch("/api/portal/property-interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: match.property.id,
          type: match.saved ? "UNSAVE" : "SAVE",
        }),
      })
      onToggleSave(match.property.id, !match.saved)
    } finally {
      setLoading(false)
    }
  }

  async function handleView() {
    fetch("/api/portal/property-interaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: match.property.id, type: "VIEW" }),
    }).catch(() => {})
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={match.property.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-gray-400" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded",
            match.property.status === "ACTIVE" ? "bg-green-500 text-white" : "bg-gray-500 text-white"
          )}>
            {match.property.status}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={cn(
            "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all",
            match.saved ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:text-red-400"
          )}
        >
          {match.saved ? <Heart className="w-4 h-4 fill-current" /> : <Heart className="w-4 h-4" />}
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-lofty-600 font-bold text-xl">{formatCurrency(match.property.price)}</div>
            <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate">{match.property.address}</span>
            </div>
            <div className="text-xs text-gray-400">{match.property.city}, {match.property.state}</div>
          </div>
          <ScoreRing score={match.score} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 border-t pt-3">
          {match.property.bedrooms && (
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{match.property.bedrooms} bd</span>
          )}
          {match.property.bathrooms && (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{match.property.bathrooms} ba</span>
          )}
          {match.property.sqft && (
            <span className="flex items-center gap-1"><Square className="w-3.5 h-3.5" />{match.property.sqft.toLocaleString()} sqft</span>
          )}
        </div>

        {/* Match reasons */}
        {match.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {match.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-lofty-50 text-lofty-700 rounded-full border border-lofty-200 font-medium">
                ✓ {r}
              </span>
            ))}
          </div>
        )}

        {/* AI explanation */}
        {match.aiExplanation && (
          <div className="mt-3 flex items-start gap-2 bg-gradient-to-r from-purple-50 to-lofty-50 rounded-xl p-3 border border-purple-100">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-800 leading-relaxed">{match.aiExplanation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Link
            href={`/property/${match.property.id}`}
            onClick={handleView}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-lofty-600 text-white rounded-xl text-sm font-semibold hover:bg-lofty-700 transition-colors"
          >
            View Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/portal/messages"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-lofty-200 text-lofty-700 rounded-xl text-sm font-medium hover:bg-lofty-50"
            title="Ask Sofia"
          >
            <MessageSquare className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function MatchesClient({ matches, hasPrefs, firstName }: Props) {
  const [localMatches, setLocalMatches] = useState(matches)

  const toggleSave = useCallback((id: string, saved: boolean) => {
    setLocalMatches(prev =>
      prev.map(m => m.property.id === id ? { ...m, saved } : m)
    )
  }, [])

  const topMatches = localMatches.filter(m => m.score >= 60)
  const otherMatches = localMatches.filter(m => m.score < 60)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hasPrefs ? `Your AI Matches, ${firstName}` : "All Properties"}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {hasPrefs
              ? `${localMatches.length} properties ranked by how well they match your preferences`
              : "Propiedades disponibles — complete your preferences for AI match scores"}
          </p>
        </div>
        <Link
          href="/portal/preferences"
          className="flex items-center gap-2 px-4 py-2 border border-lofty-200 rounded-xl text-sm font-medium text-lofty-700 hover:bg-lofty-50 transition-colors flex-shrink-0"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">{hasPrefs ? "Update prefs" : "Set preferences"}</span>
        </Link>
      </div>

      {/* No prefs banner */}
      {!hasPrefs && (
        <div className="bg-gradient-to-r from-purple-600 to-lofty-600 rounded-2xl p-5 text-white mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold">Unlock AI Property Match Scores</div>
              <div className="text-sm text-purple-200">Tell Sofia what you&apos;re looking for</div>
            </div>
          </div>
          <p className="text-sm text-purple-100 mb-4">
            Answer 4 quick questions and every listing will get a personalized match percentage — so you instantly know which homes are right for you.
          </p>
          <Link
            href="/portal/preferences"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-lofty-700 rounded-xl text-sm font-bold hover:bg-purple-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Get My Matches
          </Link>
        </div>
      )}

      {localMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-lofty-50 rounded-2xl flex items-center justify-center mb-4">
            <Home className="w-10 h-10 text-lofty-300" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No properties available</h3>
          <p className="text-gray-500 text-sm">Check back soon — new listings are added regularly.</p>
          <p className="text-gray-400 text-xs mt-1">Nuevas propiedades se agregan regularmente.</p>
        </div>
      ) : (
        <>
          {/* Top matches */}
          {hasPrefs && topMatches.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h2 className="font-bold text-gray-900">Top Matches</h2>
                </div>
                <span className="text-sm text-gray-400">— {topMatches.length} properties 60%+ match</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {topMatches.map(m => (
                  <MatchCard key={m.property.id} match={m} onToggleSave={toggleSave} />
                ))}
              </div>
            </div>
          )}

          {/* Other matches or all properties */}
          {(!hasPrefs || otherMatches.length > 0) && (
            <div>
              {hasPrefs && otherMatches.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-bold text-gray-900">Other Available Homes</h2>
                  <span className="text-sm text-gray-400">— {otherMatches.length} properties</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {(hasPrefs ? otherMatches : localMatches).map(m => (
                  <MatchCard key={m.property.id} match={m} onToggleSave={toggleSave} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Sofia CTA at bottom */}
      {hasPrefs && localMatches.length > 0 && (
        <div className="mt-10 bg-gradient-to-r from-purple-50 to-lofty-50 rounded-2xl p-6 border border-purple-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-lofty-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Have questions about a property?</div>
            <p className="text-sm text-gray-500">
              Ask Sofia — she can explain why a home is a great fit, compare two properties, or schedule a showing with Catherine.
            </p>
          </div>
          <Link
            href="/portal/messages"
            className="flex items-center gap-2 px-4 py-2.5 bg-lofty-600 text-white rounded-xl text-sm font-semibold hover:bg-lofty-700 flex-shrink-0"
          >
            Chat <MessageSquare className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
