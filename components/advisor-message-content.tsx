"use client"

import React from "react"

// Renders advisor message text with inline images: markdown ![alt](url) and bare
// image URLs (.png/.jpg/.webp/.gif). Everything else stays plain, pre-wrapped text.
const IMG_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s)]*)?)/gi

export function AdvisorMessageContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let m: RegExpExecArray | null
  IMG_RE.lastIndex = 0
  while ((m = IMG_RE.exec(content)) !== null) {
    const url = m[1] || m[2]
    if (m.index > lastIndex) {
      parts.push(<span key={key++} className="whitespace-pre-wrap">{content.slice(lastIndex, m.index)}</span>)
    }
    if (url) {
      parts.push(
        <img
          key={key++}
          src={url}
          alt="Proyecto"
          loading="lazy"
          className="my-2 block rounded-lg border border-gray-200 max-w-full max-h-72 object-cover"
        />
      )
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < content.length) {
    parts.push(<span key={key++} className="whitespace-pre-wrap">{content.slice(lastIndex)}</span>)
  }
  return <>{parts}</>
}
