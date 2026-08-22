"use client"

import { useCallback, useEffect, useState } from "react"
import { TrendingUp, Loader2, Users, CalendarCheck, Trophy, DollarSign } from "lucide-react"

type Row = {
  key: string
  display: string
  leads: number
  contacted: number
  appointments: number
  underContract: number
  closed: number
  revenue: number
  spend: number
  costPerLead: number | null
  roi: number | null
  leadToApptPct: number
  leadToClosedPct: number
}
type Data = {
  sources: Row[]
  campaigns: Row[]
  totals: { leads: number; appointments: number; closed: number; revenue: number; spend: number }
}

const RANGES = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "12 meses" },
  { value: "all", label: "Todo" },
]

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString()
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`

function Table({ title, rows, onSaveSpend }: { title: string; rows: Row[]; onSaveSpend: (label: string, amount: number) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50">
              <th className="text-left font-semibold px-4 py-2">{title.includes("fuente") || title.includes("Fuente") ? "Fuente" : "Campaña"}</th>
              <th className="text-right font-semibold px-3 py-2">Leads</th>
              <th className="text-right font-semibold px-3 py-2">Contactados</th>
              <th className="text-right font-semibold px-3 py-2">Citas</th>
              <th className="text-right font-semibold px-3 py-2">Bajo contrato</th>
              <th className="text-right font-semibold px-3 py-2">Cerrados</th>
              <th className="text-right font-semibold px-3 py-2">Comisión</th>
              <th className="text-right font-semibold px-3 py-2">Inversión</th>
              <th className="text-right font-semibold px-3 py-2">Costo/lead</th>
              <th className="text-right font-semibold px-3 py-2">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.display}</td>
                <td className="px-3 py-2.5 text-right text-gray-700">{r.leads}</td>
                <td className="px-3 py-2.5 text-right text-gray-500">{r.contacted}</td>
                <td className="px-3 py-2.5 text-right"><span className="text-gray-700">{r.appointments}</span> <span className="text-[11px] text-gray-400">{pct(r.leadToApptPct)}</span></td>
                <td className="px-3 py-2.5 text-right text-gray-700">{r.underContract}</td>
                <td className="px-3 py-2.5 text-right"><span className="font-semibold text-emerald-700">{r.closed}</span> <span className="text-[11px] text-gray-400">{pct(r.leadToClosedPct)}</span></td>
                <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">{r.revenue > 0 ? money(r.revenue) : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-0.5">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      defaultValue={r.spend || ""}
                      onBlur={e => {
                        const v = Number(e.target.value)
                        if (isFinite(v) && v !== r.spend) onSaveSpend(r.display, v)
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                      placeholder="0"
                      className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-700">{r.costPerLead != null ? money(r.costPerLead) : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  {r.roi != null
                    ? <span className={`font-bold ${r.roi >= 1 ? "text-emerald-700" : "text-red-600"}`}>{r.roi.toFixed(1)}x</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Sin datos en este período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AttributionClient() {
  const [range, setRange] = useState("365")
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/attribution?range=${r}`)
      const d = await res.json()
      if (d.ok) setData(d)
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const saveSpend = async (label: string, amount: number) => {
    try {
      await fetch("/api/reports/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, amount }),
      })
      load(range) // refresh so CPL/ROI recompute
    } catch { /* noop */ }
  }

  const t = data?.totals
  const blendedRoi = t && t.spend > 0 ? t.revenue / t.spend : null

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ROI y Atribución</h1>
            <p className="text-sm text-gray-500">De dónde vienen tus cierres — por fuente y campaña</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={range === r.value ? "px-3 py-1.5 bg-indigo-600 text-white font-semibold" : "px-3 py-1.5 text-gray-600 hover:bg-gray-50"}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Users, label: "Leads", value: t ? t.leads.toLocaleString() : "—", color: "text-blue-600 bg-blue-50" },
          { icon: CalendarCheck, label: "Citas", value: t ? t.appointments.toLocaleString() : "—", color: "text-violet-600 bg-violet-50" },
          { icon: Trophy, label: "Cerrados", value: t ? t.closed.toLocaleString() : "—", color: "text-emerald-600 bg-emerald-50" },
          { icon: DollarSign, label: blendedRoi != null ? `Comisión · ROI ${blendedRoi.toFixed(1)}x` : "Comisión", value: t ? money(t.revenue) : "—", color: "text-amber-600 bg-amber-50" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${k.color}`}>
              <k.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500">{k.label}</p>
          </div>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          <Table title="Por fuente" rows={data?.sources || []} onSaveSpend={saveSpend} />
          <Table title="Por campaña" rows={data?.campaigns || []} onSaveSpend={saveSpend} />
          <p className="text-xs text-gray-400">
            "Bajo contrato" y "Cerrados" se cuentan desde las transacciones ligadas al contacto; la comisión es el GCI de las transacciones cerradas.
            Escribe tu inversión publicitaria en cada fila para ver el costo por lead y el ROI (comisión ÷ inversión).
          </p>
        </div>
      )}
    </div>
  )
}
