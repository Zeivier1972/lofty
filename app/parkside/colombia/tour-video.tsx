"use client"

/**
 * The vertical 3D tour of Parkside, under the quiz on /parkside/colombia.
 * Muted with controls; only metadata loads until someone presses play, so
 * it costs nothing to visitors who don't watch. The first play is logged
 * as a [parkside-funnel] "video_play" step.
 */

import { useRef } from "react"

export default function TourVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const sent = useRef(false)
  const onPlay = () => {
    if (sent.current) return
    sent.current = true
    try {
      const payload = JSON.stringify({ sid: Math.random().toString(36).slice(2, 12), event: "video_play", key: "tour3d", ad: new URLSearchParams(window.location.search).has("fbclid") })
      if (navigator.sendBeacon) navigator.sendBeacon("/api/parkside/funnel-event", payload)
      ;(window as any).fbq?.("trackCustom", "ParksideQuiz", { event: "video_play", key: "tour3d" })
    } catch { /* analytics never blocks the video */ }
  }
  return (
    <video
      className="mx-auto mt-6 aspect-[9/16] w-full max-w-[360px] bg-black"
      src={src}
      poster={poster}
      controls
      muted
      playsInline
      preload="metadata"
      onPlay={onPlay}
      aria-label={label}
    />
  )
}
