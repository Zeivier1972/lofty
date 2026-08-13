"use client"

import { useId } from "react"

// Original illustrated avatar for Aria — Catherine's in-CRM copilot. Distinct
// from Sofía (sleeker dark hair, glasses, navy blazer + gold accents to match
// Aria's brand). Inline SVG so it always renders.
export default function AriaAvatar({ size = 40, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const bg = `abg-${uid}`
  const hair = `ahair-${uid}`
  const clip = `aclip-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Aria, asistente">
      <defs>
        <clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8eef6" />
          <stop offset="1" stopColor="#cdd9ea" />
        </linearGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1a10" />
          <stop offset="1" stopColor="#140a05" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill={`url(#${bg})`} />
        {/* sleek back hair */}
        <path d="M22 46 Q22 9 50 9 Q78 9 78 46 L80 96 Q65 82 50 82 Q35 82 20 96 Z" fill={`url(#${hair})`} />
        {/* navy blazer (Aria brand) */}
        <path d="M20 100 Q25 80 50 80 Q75 80 80 100 Z" fill="#1a3a5c" />
        <path d="M45 80 L50 93 L55 80 Z" fill="#f4f7fb" />
        {/* gold collar accents */}
        <path d="M46 81 L41 90 L45 82 Z" fill="#c9a84c" />
        <path d="M54 81 L59 90 L55 82 Z" fill="#c9a84c" />
        {/* neck */}
        <rect x="43" y="63" width="14" height="17" rx="7" fill="#e6ad82" />
        {/* face */}
        <ellipse cx="50" cy="47" rx="20.5" ry="23.5" fill="#f4c49e" />
        {/* center-parted fringe */}
        <path d="M29 46 Q28 20 50 20 Q72 20 71 46 Q66 30 51 30 L50 44 L49 30 Q34 30 29 46 Z" fill={`url(#${hair})`} />
        {/* glasses */}
        <circle cx="42" cy="48" r="6" fill="none" stroke="#2b2b2b" strokeWidth="1.4" />
        <circle cx="58" cy="48" r="6" fill="none" stroke="#2b2b2b" strokeWidth="1.4" />
        <path d="M48 48 Q50 46 52 48" stroke="#2b2b2b" strokeWidth="1.4" fill="none" />
        <path d="M36 47 L32 45" stroke="#2b2b2b" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M64 47 L68 45" stroke="#2b2b2b" strokeWidth="1.4" strokeLinecap="round" />
        {/* eyes */}
        <circle cx="42" cy="48" r="2.1" fill="#2b1b12" />
        <circle cx="58" cy="48" r="2.1" fill="#2b1b12" />
        {/* eyebrows */}
        <path d="M37 41 Q42 39 46 41" stroke="#2a1a10" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M54 41 Q58 39 63 41" stroke="#2a1a10" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* nose + smile */}
        <path d="M50 50 Q52 55 49 56" stroke="#d89a6a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M44 60 Q50 65 56 60" stroke="#c05a72" strokeWidth="2.1" fill="none" strokeLinecap="round" />
        {/* gold earrings */}
        <circle cx="30" cy="55" r="1.7" fill="#c9a84c" />
        <circle cx="70" cy="55" r="1.7" fill="#c9a84c" />
      </g>
    </svg>
  )
}
