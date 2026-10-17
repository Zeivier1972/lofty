"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Dictation through the browser's own speech recognition.
 *
 * No API key and no per-use cost: Chrome, Edge, Safari (iOS included) and
 * Android Chrome all ship this. Firefox does not, which is why `supported` is
 * part of the contract — the caller renders the microphone only when it will
 * actually work, and everyone else keeps the ordinary text box rather than
 * tapping a button that does nothing.
 *
 * `supported` is resolved in an effect rather than at module scope because the
 * widget is server-rendered first, where `window` does not exist; the button
 * appears on hydration.
 */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/**
 * The audience is bilingual and the API cannot auto-detect, so it has to be
 * told. The visitor's own browser language is the best available signal: an
 * English-speaking buyer is browsing an English profile. Everyone else gets
 * Spanish, which is this site's primary language.
 */
function defaultLang(): string {
  if (typeof navigator === "undefined") return "es-US"
  return /^en\b/i.test(navigator.language || "") ? "en-US" : "es-US"
}

export type SpeechError = "denied" | "no-speech" | "audio" | "other" | null

export function useSpeechRecognition(opts: {
  /** Fires with the final transcript once the speaker stops. */
  onResult: (text: string) => void
  /** Fires with partial text while they are still talking. */
  onInterim?: (text: string) => void
  lang?: string
}) {
  const { onResult, onInterim, lang } = opts
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<SpeechError>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  // Callbacks live in refs so re-renders don't tear down a live session.
  const onResultRef = useRef(onResult)
  const onInterimRef = useRef(onInterim)
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])

  useEffect(() => { setSupported(!!getCtor()) }, [])

  // Never leave the microphone open behind a closed widget or a route change.
  useEffect(() => () => { try { recRef.current?.abort() } catch { /* noop */ } }, [])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* noop */ }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    // A second start() on a live session throws InvalidStateError.
    try { recRef.current?.abort() } catch { /* noop */ }

    const rec = new Ctor()
    recRef.current = rec
    rec.lang = lang || defaultLang()
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    setError(null)

    rec.onstart = () => setListening(true)

    rec.onresult = (e: any) => {
      let finalText = ""
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const txt = r[0]?.transcript ?? ""
        if (r.isFinal) finalText += txt
        else interim += txt
      }
      if (interim && onInterimRef.current) onInterimRef.current(interim.trim())
      if (finalText.trim()) onResultRef.current(finalText.trim())
    }

    rec.onerror = (e: any) => {
      const code = e?.error
      // Silence is not a failure worth shouting about — the user tapped the
      // mic and then said nothing, which needs no message.
      if (code === "no-speech" || code === "aborted") setError(code === "no-speech" ? "no-speech" : null)
      else if (code === "not-allowed" || code === "service-not-allowed") setError("denied")
      else if (code === "audio-capture") setError("audio")
      else setError("other")
      setListening(false)
    }

    rec.onend = () => setListening(false)

    try {
      rec.start()
    } catch {
      setError("other")
      setListening(false)
    }
  }, [lang])

  const toggle = useCallback(() => { listening ? stop() : start() }, [listening, start, stop])

  return { supported, listening, error, start, stop, toggle }
}

/** Short, human message for each failure the caller may want to show. */
export function speechErrorMessage(e: SpeechError): string | null {
  switch (e) {
    case "denied": return "Activa el micrófono en tu navegador para usar la voz."
    case "audio": return "No pude acceder al micrófono."
    case "no-speech": return "No te escuché. Intenta otra vez."
    case "other": return "El dictado no está disponible ahora."
    default: return null
  }
}
