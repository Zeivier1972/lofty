"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AiAssistBarProps {
  contactId: string
  draft: string
  onApply: (text: string) => void
  className?: string
}

export function AiAssistBar({ contactId, draft, onApply, className }: AiAssistBarProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  async function run(action: string) {
    setLoading(true)
    setSuggestions([])
    try {
      const res = await fetch("/api/ai/compose-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, draft, action }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
          IA
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 ml-1" />
        ) : (
          <>
            <button
              type="button"
              onClick={() => run("suggest")}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-medium transition-colors"
            >
              Sugerir
            </button>
            {draft.trim() && (
              <>
                <button
                  type="button"
                  onClick={() => run("fix")}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium transition-colors"
                >
                  ✓ Corregir
                </button>
                <button
                  type="button"
                  onClick={() => run("translate_en")}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 font-medium transition-colors"
                >
                  → EN
                </button>
                <button
                  type="button"
                  onClick={() => run("translate_es")}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 font-medium transition-colors"
                >
                  → ES
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onApply(s); setSuggestions([]) }}
              className="w-full text-left text-xs px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-gray-800 border border-purple-200 transition-colors leading-relaxed"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSuggestions([])}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}
