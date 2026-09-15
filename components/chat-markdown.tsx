"use client"

import React from "react"

// Renders chat markdown for both Catherine-facing agents — the Investment
// Advisor and Aria: tables, headings, lists, bold, links, code,
// and inline images. Deliberately NOT innerHTML — every node is built as React,
// so model output can never inject markup.

const IMG_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s)]*)?)/i
const LINK_RE = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/
// Links the agents emit for a generated file — rendered as a button, not a link.
const DOWNLOAD_PREFIX = "/api/investment-analysis"
const BOLD_RE = /\*\*([^*]+)\*\*/
const ITALIC_RE = /(?<!\*)\*([^*]+)\*(?!\*)/
const CODE_RE = /`([^`]+)`/
const BARE_URL_RE = /(https?:\/\/[^\s)<>]+)/
const ACCENT_DEFAULT = "text-emerald-700 hover:text-emerald-800"

/** Inline formatting, applied recursively so bold-inside-a-link still works. */
function inline(text: string, keyBase = "i", accent = ACCENT_DEFAULT): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let rest = text
  let k = 0

  while (rest.length > 0) {
    const candidates: Array<{ index: number; length: number; node: React.ReactNode }> = []

    const img = IMG_RE.exec(rest)
    if (img) {
      const url = img[1] || img[2]
      candidates.push({
        index: img.index, length: img[0].length,
        node: <img key={`${keyBase}-img-${k}`} src={url} alt="Proyecto" loading="lazy"
          className="my-2 block rounded-lg border border-gray-200 max-w-full max-h-72 object-cover" />,
      })
    }
    const link = LINK_RE.exec(rest)
    if (link) {
      const href = link[2]
      const isDownload = href.startsWith(DOWNLOAD_PREFIX)
      candidates.push({
        index: link.index, length: link[0].length,
        node: isDownload ? (
          // Content-Disposition on the route makes this download rather than
          // navigate, so it deliberately has no target.
          <a key={`${keyBase}-dl-${k}`} href={href}
            className="my-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-emerald-700">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {link[1]}
          </a>
        ) : (
          <a key={`${keyBase}-a-${k}`} href={href}
            target={href.startsWith("/") ? undefined : "_blank"}
            rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
            className={`${accent} underline underline-offset-2`}>{inline(link[1], `${keyBase}-a-${k}`, accent)}</a>
        ),
      })
    }
    const bold = BOLD_RE.exec(rest)
    if (bold) {
      candidates.push({
        index: bold.index, length: bold[0].length,
        node: <strong key={`${keyBase}-b-${k}`} className="font-semibold text-gray-900">{inline(bold[1], `${keyBase}-b-${k}`, accent)}</strong>,
      })
    }
    const code = CODE_RE.exec(rest)
    if (code) {
      candidates.push({
        index: code.index, length: code[0].length,
        node: <code key={`${keyBase}-c-${k}`} className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] font-mono text-gray-800">{code[1]}</code>,
      })
    }
    const ital = ITALIC_RE.exec(rest)
    if (ital) {
      candidates.push({
        index: ital.index, length: ital[0].length,
        node: <em key={`${keyBase}-e-${k}`}>{inline(ital[1], `${keyBase}-e-${k}`, accent)}</em>,
      })
    }
    // A bare URL only counts when it is not already inside a markdown link.
    const bare = BARE_URL_RE.exec(rest)
    if (bare && !(link && bare.index >= link.index && bare.index < link.index + link[0].length)) {
      candidates.push({
        index: bare.index, length: bare[0].length,
        node: <a key={`${keyBase}-u-${k}`} href={bare[1]} target="_blank" rel="noopener noreferrer"
          className={`${accent} underline underline-offset-2 break-all`}>{bare[1]}</a>,
      })
    }

    if (candidates.length === 0) { out.push(rest); break }
    candidates.sort((a, b) => a.index - b.index || b.length - a.length)
    const hit = candidates[0]
    if (hit.index > 0) out.push(rest.slice(0, hit.index))
    out.push(hit.node)
    rest = rest.slice(hit.index + hit.length)
    k++
  }
  return out
}

const isTableRow = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|")
const isDivider = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("-")
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim())

/** Right-align a column when every value in it reads as a number, price or percent. */
function numericColumns(rows: string[][]): boolean[] {
  const width = Math.max(...rows.map(r => r.length))
  return Array.from({ length: width }, (_, c) => {
    const vals = rows.map(r => r[c]).filter(v => v && v !== "-" && v !== "—")
    return vals.length > 0 && vals.every(v => /^[-+$(]?[\d.,]+\s?%?\)?$/.test(v.replace(/\s/g, "")))
  })
}

export function ChatMarkdown({ content, accent = ACCENT_DEFAULT }: { content: string; accent?: string }) {
  const lines = content.split("\n")
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(<p key={key++} className="whitespace-pre-wrap leading-relaxed">{inline(paragraph.join("\n"), `p${key}`, accent)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? "ol" : "ul"
    blocks.push(
      React.createElement(Tag, {
        key: key++,
        className: `my-2 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-gray-400`,
      }, list.items.map((it, n) => <li key={n} className="leading-relaxed">{inline(it, `l${key}-${n}`, accent)}</li>))
    )
    list = null
  }
  const flushAll = () => { flushParagraph(); flushList() }

  while (i < lines.length) {
    const line = lines[i]

    // Table: a header row followed by a divider row.
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushAll()
      const header = cells(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) { body.push(cells(lines[i])); i++ }
      const numeric = numericColumns(body)
      blocks.push(
        <div key={key++} className="my-3 -mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                {header.map((h, c) => (
                  <th key={c} className={`border border-gray-200 px-3 py-2 font-semibold text-gray-700 ${numeric[c] ? "text-right" : "text-left"}`}>
                    {inline(h, `th${key}-${c}`, accent)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="even:bg-gray-50/60">
                  {header.map((_, c) => (
                    <td key={c} className={`border border-gray-200 px-3 py-2 align-top text-gray-700 ${numeric[c] ? "text-right tabular-nums whitespace-nowrap" : "text-left"}`}>
                      {inline(row[c] ?? "", `td${key}-${r}-${c}`, accent)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushAll()
      const level = heading[1].length
      const size = level <= 2 ? "text-base" : "text-sm"
      blocks.push(
        <div key={key++} className={`mt-4 mb-1 font-bold text-gray-900 first:mt-0 ${size}`}>
          {inline(heading[2], `h${key}`, accent)}
        </div>
      )
      i++; continue
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line) && !isTableRow(line)) {
      flushAll()
      blocks.push(<hr key={key++} className="my-4 border-gray-200" />)
      i++; continue
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = !!numbered
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push((bullet ? bullet[1] : numbered![1]))
      i++; continue
    }

    if (line.trim() === "") { flushAll(); i++; continue }

    flushList()
    paragraph.push(line)
    i++
  }
  flushAll()

  return <div className="space-y-1 text-[15px]">{blocks}</div>
}
