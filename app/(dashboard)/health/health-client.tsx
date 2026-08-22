"use client"

import { useState } from "react"
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

type Row = {
  name: string
  ok: boolean
  detail: string | null
  lastCheckedAt: string | null
  lastDownAt: string | null
  consecutiveFailures: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `hace ${s}s`
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export default function HealthClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)

  const down = rows.filter(r => !r.ok)
  const allOk = rows.length > 0 && down.length === 0

  async function runNow() {
    setRunning(true)
    try {
      const res = await fetch("/api/health/run", { method: "POST" })
      const data = await res.json()
      if (data.checks) {
        setRows(data.checks.map((c: any) => ({
          name: c.name, ok: c.ok, detail: c.detail ?? null,
          lastCheckedAt: new Date().toISOString(),
          lastDownAt: c.ok ? null : new Date().toISOString(),
          consecutiveFailures: c.ok ? 0 : 1,
        })))
        setLastRun(new Date().toISOString())
      }
    } catch { /* noop */ } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Estado del sistema</h1>
            <p className="text-sm text-gray-500">Conexiones e integraciones de CASAi</p>
          </div>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {running ? "Revisando…" : "Revisar ahora"}
        </button>
      </div>

      {/* Overall banner */}
      <div className={`rounded-xl p-4 mb-5 flex items-center gap-3 border ${
        rows.length === 0 ? "bg-gray-50 border-gray-200 text-gray-600"
          : allOk ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-red-50 border-red-200 text-red-800"
      }`}>
        {rows.length === 0
          ? <><Activity className="w-5 h-5" /> <span className="text-sm font-medium">Aún no hay revisiones — toca "Revisar ahora".</span></>
          : allOk
            ? <><CheckCircle2 className="w-5 h-5" /> <span className="text-sm font-semibold">Todos los sistemas operativos</span></>
            : <><AlertTriangle className="w-5 h-5" /> <span className="text-sm font-semibold">{down.length} servicio(s) con problemas: {down.map(d => d.name).join(", ")}</span></>}
      </div>

      {/* Rows */}
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-3 px-4 py-3">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.ok ? "bg-emerald-500" : "bg-red-500"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500 truncate">{r.detail || (r.ok ? "OK" : "Sin detalle")}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${r.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {r.ok ? "OK" : "CAÍDO"}
              </span>
              <p className="text-[11px] text-gray-400 mt-1">
                {r.ok ? `revisado ${timeAgo(r.lastCheckedAt)}` : `caído desde ${timeAgo(r.lastDownAt)}`}
              </p>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Sin datos todavía.</div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        CASAi revisa estas conexiones automáticamente cada ~20 minutos y te envía un SMS y email si algo se cae o se restablece.
        {lastRun && ` · Última revisión manual: ${timeAgo(lastRun)}`}
      </p>
    </div>
  )
}
