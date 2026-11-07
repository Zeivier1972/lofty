"use client"

import { useEffect, useState } from "react"
import { Film, Loader2 } from "lucide-react"
import { PROJECTS, detectProject } from "@/lib/projects"

type Video = { id: string; url: string; projectHref: string | null; status: string; error: string | null; views: number; maxPct: number; firstViewedAt: string | null; createdAt: string }

const STATUS: Record<string, string> = {
  PENDING: "Preparando…", RENDERING: "Generando video (≈5–10 min)…", READY: "Listo, enviando…", SENT: "Enviado", FAILED: "Falló",
}

/** "Video personal" on the contact page: make/send one, see if they watched, turn automatic videos on/off. */
export default function PersonalVideoButton({ contactId, tags }: { contactId: string; tags: string[] }) {
  const projects = PROJECTS.filter(p => !p.href.startsWith("/guias"))
  const guess = tags.map(t => detectProject(t)).find(Boolean)
  const [open, setOpen] = useState(false)
  const [project, setProject] = useState(guess?.href || projects[0]?.href || "")
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [auto, setAuto] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = () => fetch(`/api/contacts/${contactId}/personal-video`).then(r => r.json()).then(d => setVideos(d.videos || [])).catch(() => setVideos([]))

  useEffect(() => {
    if (!open) return
    void load()
    fetch("/api/personal-video/settings").then(r => r.json()).then(d => setAuto(!!d.auto)).catch(() => {})
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function create() {
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/contacts/${contactId}/personal-video`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectHref: project }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? "✓ En preparación. Se le envía solo por correo y texto cuando esté listo." : d.error || "No se pudo crear")
    void load()
  }

  async function toggleAuto() {
    const d = await fetch("/api/personal-video/settings", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ auto: !auto }),
    }).then(r => r.json()).catch(() => null)
    if (d) setAuto(!!d.auto)
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium text-sky-800">
        <Film className="h-4 w-4" /> Video personal {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="space-y-3 border-t border-sky-200 p-3 text-sm">
          <label className="block text-xs font-semibold text-gray-600">Proyecto
            <select value={project} onChange={e => setProject(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
              {projects.map(p => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
          </label>
          <button onClick={create} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear y enviar video
          </button>
          {msg && <p className="text-xs text-gray-700">{msg}</p>}

          {videos && videos.length > 0 && (
            <ul className="space-y-2">
              {videos.map(v => (
                <li key={v.id} className="rounded-lg bg-white p-2 text-xs ring-1 ring-gray-200">
                  <p className="font-semibold text-gray-800">{PROJECTS.find(p => p.href === v.projectHref)?.name || "Inversión en Miami"}</p>
                  <p className={v.status === "FAILED" ? "text-red-600" : "text-gray-500"}>
                    {STATUS[v.status] || v.status}{v.status === "FAILED" && v.error ? ` — ${v.error}` : ""}
                  </p>
                  {v.status === "SENT" && (
                    <p className={v.views ? "font-semibold text-emerald-700" : "text-gray-500"}>
                      {v.views ? `👀 Lo vio${v.maxPct ? ` (${v.maxPct}%)` : ""}` : "Aún no lo abre"}
                    </p>
                  )}
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">Ver su página →</a>
                </li>
              ))}
            </ul>
          )}

          {auto !== null && (
            <label className="flex items-start gap-2 border-t border-sky-200 pt-2 text-xs text-gray-600">
              <input type="checkbox" checked={auto} onChange={toggleAuto} className="mt-0.5 h-4 w-4" />
              <span>Enviar video automático a cada lead nuevo de un proyecto (máx. 15 al día)</span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
