"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import type { PhoneRepairCandidate } from "@/lib/phone-repair"

export default function PhoneRepairClient() {
  const [list, setList] = useState<PhoneRepairCandidate[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setList(null)
    const d = await fetch("/api/contacts-tools/phone-repair", { cache: "no-store" }).then(r => r.json()).catch(() => ({ candidates: [] }))
    const c: PhoneRepairCandidate[] = d.candidates || []
    setList(c)
    setPicked(new Set(c.filter(x => x.recommended).map(x => x.id)))
  }
  useEffect(() => { void load() }, [])

  async function apply() {
    if (!picked.size) return
    if (!confirm(`¿Cambiar ${picked.size} teléfono(s) a Colombia (+57)?`)) return
    setBusy(true); setMsg(null)
    const d = await fetch("/api/contacts-tools/phone-repair", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: Array.from(picked) }),
    }).then(r => r.json()).catch(() => ({}))
    setBusy(false)
    setMsg(d.ok ? `✓ ${d.fixed} contacto(s) corregidos.` : d.error || "No se pudo aplicar.")
    void load()
  }

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900">Corregir teléfonos de Colombia</h1>
      <p className="mt-2 text-sm text-gray-600">
        Celulares colombianos que se guardaron como números de EE. UU. (+1) porque el formulario no tenía código de país.
        El texto les falló y el SMS quedó apagado. Los marcados tienen dos señales claras; revisa los demás antes de marcarlos
        (305 también es Miami). Al corregir: el teléfono pasa a +57 y, si el sistema había apagado el SMS por el error, se vuelve a activar.
      </p>

      {msg && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {!list ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</p>
      ) : list.length === 0 ? (
        <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">No hay teléfonos por corregir. ✓</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={apply} disabled={busy || !picked.size}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy ? "Corrigiendo…" : `Corregir ${picked.size} seleccionado(s)`}
            </button>
            <span className="text-xs text-gray-500">{list.length} posibles · {list.filter(x => x.recommended).length} recomendados</span>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {list.map(c => (
              <li key={c.id} className="flex gap-3 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={picked.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Seleccionar ${c.name}`} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <a href={`/contacts/${c.id}`} className="font-semibold text-indigo-700 hover:underline">{c.name}</a>
                    <span className="text-gray-500 line-through">{c.phone}</span>
                    <span className="font-semibold text-gray-900">→ {c.proposed}</span>
                    {c.recommended && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Recomendado</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {c.email || "sin email"}{c.source ? ` · ${c.source}` : ""}{c.tags.length ? ` · ${c.tags.slice(0, 4).join(", ")}` : ""}
                  </p>
                  <ul className="mt-1 text-xs text-gray-600">
                    {c.why.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
