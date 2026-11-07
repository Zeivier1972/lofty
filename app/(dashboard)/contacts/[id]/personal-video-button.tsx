"use client"

import { useEffect, useState } from "react"
import { Film, Loader2 } from "lucide-react"
import { PROJECTS, detectProject } from "@/lib/projects"

type Avatar = { avatar_id: string; avatar_name: string; preview_image_url: string | null; is_talking_photo: boolean }
type Chosen = { id: string; name: string; preview: string | null; isTalkingPhoto: boolean }

/** Catherine's known "looks" — shown first in the picker. */
const MY_LOOKS = new Set([
  "ab393d45f3044a89b92fc77d17f321b7", "28e35d5f82f64101a2584fb29e841a88", "ad3b10e46ce44ad8b9a9931f65e151cf",
  "7ec891d9cc9f43ffa0f38f67d945d38f", "0215c5d293fb4c89b42130da184ded5b", "bc75573c848f42218ee27d37e623a4e6",
  "701d93d2d1834f2589a987aaf701720d", "f2bf0415eb4f4185b37673d3c876423c", "310728040e89413aa1c5b04ebb8bb9d3",
])

type Video = { id: string; url: string; projectHref: string | null; status: string; error: string | null; views: number; maxPct: number; firstViewedAt: string | null; createdAt: string }

const STATUS: Record<string, string> = {
  PENDING: "Preparando…", RENDERING: "Generando video (≈5–15 min)…", READY: "Listo, enviando…", SENT: "Enviado", FAILED: "Falló", REPLACED: "Reemplazado",
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
  const [avatar, setAvatar] = useState<Chosen | null>(null)
  const [picking, setPicking] = useState(false)
  const [all, setAll] = useState<Avatar[] | null>(null)
  const [q, setQ] = useState("")

  const load = () => fetch(`/api/contacts/${contactId}/personal-video`).then(r => r.json()).then(d => setVideos(d.videos || [])).catch(() => setVideos([]))

  useEffect(() => {
    if (!open) return
    void load()
    fetch("/api/personal-video/settings").then(r => r.json()).then(d => { setAuto(!!d.auto); setAvatar(d.avatar || null) }).catch(() => {})
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const openFor = (href: string) => (videos || []).find(v => v.projectHref === href && !["FAILED", "REPLACED"].includes(v.status))

  async function create(replace = false, href = project) {
    if (!replace && openFor(href)) {
      setMsg("Ya hay un video de este proyecto para este contacto (abajo). Usa “Hacer de nuevo” si quieres uno nuevo.")
      return
    }
    if (replace && !confirm("¿Hacer un video nuevo con el avatar actual? El anterior deja de usarse y se usan créditos de HeyGen.")) return
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/contacts/${contactId}/personal-video`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectHref: href, replace }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? "✓ En preparación. Se le envía solo por correo y texto cuando esté listo." : d.error || "No se pudo crear")
    void load()
  }

  function openPicker() {
    setPicking(p => !p)
    if (!all) {
      fetch("/api/heygen/avatars").then(r => r.json())
        .then(d => setAll((d?.data?.avatars || []) as Avatar[]))
        .catch(() => setAll([]))
    }
  }

  async function choose(a: Avatar | null) {
    const d = await fetch("/api/personal-video/settings", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: a ? { id: a.avatar_id, name: a.avatar_name, preview: a.preview_image_url, isTalkingPhoto: a.is_talking_photo } : null }),
    }).then(r => r.json()).catch(() => null)
    if (d) setAvatar(d.avatar || null)
    setPicking(false)
  }

  // Her looks first; the search covers every avatar on the account.
  const term = q.trim().toLowerCase()
  const shown = (all || []).filter(a =>
    term ? a.avatar_name.toLowerCase().includes(term) || a.avatar_id.toLowerCase() === term : MY_LOOKS.has(a.avatar_id) || /catherine|gomez/i.test(a.avatar_name),
  ).slice(0, 30)

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
          <button onClick={() => create()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
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
                  <div className="flex items-center gap-3">
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">Ver su página →</a>
                    {v.status !== "REPLACED" && v.projectHref && (
                      <button onClick={() => create(true, v.projectHref!)} disabled={busy} className="font-semibold text-gray-600 hover:underline">Hacer de nuevo</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-sky-200 pt-2">
            <div className="flex items-center gap-2">
              {avatar?.preview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatar.preview} alt={`Avatar ${avatar.name}`} className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200" />
                : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">?</div>}
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold text-gray-700">Avatar</p>
                <p className="truncate text-gray-500">{avatar ? avatar.name || avatar.id : "Automático (cambia según el día)"}</p>
              </div>
              <button onClick={openPicker} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                {picking ? "Cerrar" : "Cambiar"}
              </button>
            </div>
            {picking && (
              <div className="mt-2 space-y-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o pegar el ID del avatar…"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                {!all ? (
                  <p className="flex items-center gap-1 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Cargando avatares…</p>
                ) : shown.length === 0 ? (
                  <p className="text-xs text-gray-500">Ningún avatar con ese nombre.</p>
                ) : (
                  <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
                    {shown.map(a => (
                      <button key={a.avatar_id} onClick={() => choose(a)} title={a.avatar_name}
                        className={`rounded-lg p-1 text-left ring-1 ${avatar?.id === a.avatar_id ? "ring-2 ring-sky-600" : "ring-gray-200 hover:ring-sky-400"}`}>
                        {a.preview_image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={a.preview_image_url} alt={a.avatar_name} className="aspect-square w-full rounded object-cover" />
                          : <div className="aspect-square w-full rounded bg-gray-100" />}
                        <p className="mt-0.5 truncate text-[10px] text-gray-600">{a.avatar_name}</p>
                      </button>
                    ))}
                  </div>
                )}
                {avatar && (
                  <button onClick={() => choose(null)} className="text-xs text-gray-500 underline">Volver a automático</button>
                )}
              </div>
            )}
          </div>

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
