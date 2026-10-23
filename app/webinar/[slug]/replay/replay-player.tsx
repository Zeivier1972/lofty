"use client"

import { useEffect, useRef } from "react"

/**
 * The recording, with a heartbeat.
 *
 * Only mounted when the visitor arrived from one of our own mails and carries a
 * link token. Everyone else gets the plain server-rendered iframe: the page has
 * to stay public and crawlable, and an anonymous view has nobody to attribute
 * it to, so there is nothing to gain from running a player script for them.
 *
 * A beat is sent every 15 seconds, and only while the video is actually
 * playing — a page left open in a background tab is not watching. The server
 * credits elapsed time rather than the position we report, so this component
 * being wrong, or tampered with, cannot inflate anyone's watch time.
 */

const BEAT_MS = 15000

type Props = {
  kind: "youtube" | "video"
  /** YouTube video id, or the direct media URL. */
  src: string
  slug: string
  watchToken: string
  title: string
  poster?: string
}

function loadYouTubeApi(): Promise<any> {
  const w = window as any
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT)
  return new Promise(resolve => {
    // Chain rather than replace: another embed on the page may be waiting on
    // this same global, and clobbering it would leave that player dead.
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev()
      resolve(w.YT)
    }
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script")
      s.id = "yt-iframe-api"
      s.src = "https://www.youtube.com/iframe_api"
      document.body.appendChild(s)
    }
  })
}

export function ReplayPlayer({ kind, src, slug, watchToken, title, poster }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playingRef = useRef(false)
  const durationRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let player: any = null

    const beat = () => {
      if (!playingRef.current) return
      fetch("/api/webinar-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive so the last beat still lands if they close the tab mid-flight.
        keepalive: true,
        body: JSON.stringify({ w: watchToken, slug, duration: durationRef.current }),
      }).catch(() => {})
    }
    const timer = setInterval(beat, BEAT_MS)

    if (kind === "youtube") {
      loadYouTubeApi().then(YT => {
        if (cancelled || !mountRef.current) return
        player = new YT.Player(mountRef.current, {
          videoId: src,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e: any) => { durationRef.current = e.target.getDuration() || 0 },
            onStateChange: (e: any) => {
              playingRef.current = e.data === YT.PlayerState.PLAYING
              const d = e.target.getDuration && e.target.getDuration()
              if (d) durationRef.current = d
              // Credit the moment they press play, so a short watch still
              // registers instead of being rounded away by the interval.
              if (playingRef.current) beat()
            },
          },
        })
      })
    } else {
      const v = videoRef.current
      if (v) {
        const onPlay = () => { playingRef.current = true; beat() }
        const onStop = () => { playingRef.current = false }
        const onMeta = () => { durationRef.current = v.duration || 0 }
        v.addEventListener("play", onPlay)
        v.addEventListener("pause", onStop)
        v.addEventListener("ended", onStop)
        v.addEventListener("loadedmetadata", onMeta)
        return () => {
          cancelled = true
          clearInterval(timer)
          v.removeEventListener("play", onPlay)
          v.removeEventListener("pause", onStop)
          v.removeEventListener("ended", onStop)
          v.removeEventListener("loadedmetadata", onMeta)
        }
      }
    }

    return () => {
      cancelled = true
      clearInterval(timer)
      if (player && typeof player.destroy === "function") player.destroy()
    }
  }, [kind, src, slug, watchToken])

  if (kind === "video") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        poster={poster}
        className="w-full rounded-2xl border border-slate-200 bg-black"
      />
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black pt-[56.25%]">
      {/* The API replaces this node with its own iframe. */}
      <div ref={mountRef} title={title} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
