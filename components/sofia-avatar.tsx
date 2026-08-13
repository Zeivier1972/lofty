"use client"

import { useId } from "react"

// Original, friendly illustrated avatar for Sofía (a warm Latina assistant).
// Inline SVG so it always renders — no external image, no broken-image risk.
export default function SofiaAvatar({ size = 40, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const bg = `bg-${uid}`
  const hair = `hair-${uid}`
  const clip = `clip-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Sofía, asistente">
      <defs>
        <clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9d6" />
          <stop offset="1" stopColor="#f6cba6" />
        </linearGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2c1a" />
          <stop offset="1" stopColor="#241309" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill={`url(#${bg})`} />
        {/* back hair */}
        <path d="M18 46 Q18 8 50 8 Q82 8 82 46 L84 96 Q67 80 50 80 Q33 80 16 96 Z" fill={`url(#${hair})`} />
        {/* blazer / shoulders */}
        <path d="M20 100 Q25 79 50 79 Q75 79 80 100 Z" fill="#123a5e" />
        <path d="M45 79 L50 92 L55 79 Z" fill="#ffffff" />
        {/* neck */}
        <rect x="43" y="63" width="14" height="17" rx="7" fill="#e6ad82" />
        {/* face */}
        <ellipse cx="50" cy="47" rx="21" ry="24" fill="#f4c49e" />
        {/* fringe / front hair framing the face */}
        <path d="M28 46 Q27 19 50 19 Q73 19 72 46 Q67 33 58 31 Q54 40 44 33 Q36 33 34 44 Q31 41 28 46 Z" fill={`url(#${hair})`} />
        {/* eyebrows */}
        <path d="M37 43 Q42 40 47 43" stroke="#3b2417" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M53 43 Q58 40 63 43" stroke="#3b2417" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <ellipse cx="42" cy="48" rx="2.5" ry="3.1" fill="#2b1b12" />
        <ellipse cx="58" cy="48" rx="2.5" ry="3.1" fill="#2b1b12" />
        <circle cx="42.9" cy="47" r="0.9" fill="#fff" />
        <circle cx="58.9" cy="47" r="0.9" fill="#fff" />
        {/* nose */}
        <path d="M50 49 Q52 54 49 55" stroke="#d89a6a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* smile */}
        <path d="M43 59 Q50 65 57 59" stroke="#c05a72" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {/* blush */}
        <ellipse cx="37" cy="54" rx="3" ry="2" fill="#f2a689" opacity="0.5" />
        <ellipse cx="63" cy="54" rx="3" ry="2" fill="#f2a689" opacity="0.5" />
        {/* small gold earrings */}
        <circle cx="30" cy="55" r="1.6" fill="#e7b53c" />
        <circle cx="70" cy="55" r="1.6" fill="#e7b53c" />
      </g>
    </svg>
  )
}
