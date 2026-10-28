"use client"

/**
 * "¿Cuánto capital necesito en cada etapa?" — applies the developer's deposit
 * schedule to a price the visitor types (the input starts on the lowest
 * studio price, which they can overwrite).
 */

import { useState } from "react"

export type DepositStage = { pct: number; when: string }

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export default function DepositCalculator({ stages, initialPrice }: { stages: DepositStage[]; initialPrice?: number }) {
  const [raw, setRaw] = useState(initialPrice ? String(initialPrice) : "")
  const price = Number(raw.replace(/[^\d]/g, "")) || 0
  const beforeClosing = stages.slice(0, -1).reduce((s, x) => s + x.pct, 0)

  return (
    <div className="border bg-white p-6 sm:p-8" style={{ borderColor: "rgba(46,66,54,.16)" }}>
      <label className="block">
        <span className="text-sm font-medium text-[#2B2A26]">Precio de la residencia que está evaluando (USD)</span>
        <input
          inputMode="numeric"
          placeholder="Ej. 550,000"
          value={raw ? Number(raw.replace(/[^\d]/g, "") || 0).toLocaleString("en-US") : ""}
          onChange={e => setRaw(e.target.value)}
          className="mt-2 w-full border px-3.5 py-3 text-lg outline-none focus:border-[#2E4236]"
          style={{ borderColor: "rgba(46,66,54,.22)" }}
        />
      </label>
      <dl className="mt-6 divide-y" style={{ borderColor: "rgba(46,66,54,.1)" }}>
        {stages.map(s => (
          <div key={s.when} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-[#57534B]">{s.pct}% · {s.when}</dt>
            <dd className="text-lg tabular-nums text-[#1E2B23]">{price ? fmt(price * s.pct / 100) : "—"}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 py-3 font-medium">
          <dt className="text-sm text-[#1E2B23]">Capital antes del cierre ({beforeClosing}%)</dt>
          <dd className="text-lg tabular-nums text-[#1E2B23]">{price ? fmt(price * beforeClosing / 100) : "—"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-[#8A857A]">
        Cálculo ilustrativo con el calendario del desarrollador. No incluye gastos de cierre, impuestos ni
        cuotas de mantenimiento, que se confirman con la documentación vigente del desarrollador.
      </p>
    </div>
  )
}
