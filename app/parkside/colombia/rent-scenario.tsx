"use client"

/**
 * "¿Cuánto podría rentar?" — an honest rental scenario for the plan's unit.
 *
 * Starts from real Brickell market data (MARKET) and visible assumptions,
 * and every number can be moved. Distrustful buyers believe a calculator
 * that shows its work and lets them be conservative far more than a single
 * promised yield — and a promise of returns is not ours to make anyway.
 */

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { MARKET, DEFAULTS, SQFT, rentScenario, usd, type UnitType } from "./data"

const FOREST = "#1E2B23"
const SAND = "#B59A6A"
const LINE = "rgba(46,66,54,.22)"
const serif = "var(--font-display), Georgia, serif"

function Stepper({
  label, value, onChange, step, min, max, format, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number
  format: (v: number) => string; hint?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="flex items-center justify-between gap-3 border-b py-3" style={{ borderColor: LINE }}>
      <div className="min-w-0">
        <p className="text-sm text-[#2B2A26]">{label}</p>
        {hint && <p className="text-[11px] text-[#8A857A]">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label={`Bajar ${label}`} onClick={() => onChange(clamp(value - step))} className="flex h-9 w-9 items-center justify-center border" style={{ borderColor: LINE }}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="w-[5.5rem] text-center text-sm font-medium tabular-nums">{format(value)}</span>
        <button type="button" aria-label={`Subir ${label}`} onClick={() => onChange(clamp(value + step))} className="flex h-9 w-9 items-center justify-center border" style={{ borderColor: LINE }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function RentScenario({ price, unitType }: { price: number; unitType: UnitType }) {
  const [occupancy, setOccupancy] = useState(Math.round(MARKET.occupancy))
  const [adr, setAdr] = useState(Math.round(MARKET.adr / 5) * 5)
  const [mgmtPct, setMgmtPct] = useState(DEFAULTS.mgmtPct)
  const [hoaMonthly, setHoa] = useState(Math.round((SQFT[unitType] * DEFAULTS.hoaPerSqft) / 10) * 10)
  const [taxPct, setTaxPct] = useState(DEFAULTS.taxPct)
  const [insuranceYear, setInsurance] = useState(DEFAULTS.insuranceYear)

  const r = rentScenario({ price, occupancy, adr, mgmtPct, hoaMonthly, taxPct, insuranceYear })
  const conservative = rentScenario({ price, occupancy: Math.max(30, occupancy - 10), adr: adr * 0.9, mgmtPct, hoaMonthly, taxPct, insuranceYear })
  const pct = (v: number) => `${v.toFixed(1)}%`

  return (
    <div className="border bg-white p-5 sm:p-8" style={{ borderColor: LINE, color: FOREST }}>
      <p className="text-[11px] font-medium uppercase tracking-[0.3em]" style={{ color: SAND }}>Escenario de rentabilidad</p>
      <h3 className="mt-3 text-2xl font-light leading-snug sm:text-3xl" style={{ fontFamily: serif }}>
        ¿Cuánto podría rentar {unitType === "Estudio" ? "un estudio" : `una residencia de ${unitType}`} en Brickell?
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[#4F5A52]">
        Arrancamos con datos reales del mercado de alquiler a corto plazo de Brickell ({MARKET.asOf}): ocupación promedio de{" "}
        {MARKET.occupancy}% y {usd(MARKET.adr)} por noche. Ajuste cada supuesto a su gusto.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="p-4" style={{ background: "#F6F3EC" }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B6A62]">Ingreso neto al año</p>
          <p className="mt-1 text-2xl font-light tabular-nums sm:text-3xl" style={{ fontFamily: serif }}>{usd(r.net)}</p>
          <p className="text-xs text-[#6B6A62]">≈ {usd(r.net / 12)} al mes</p>
        </div>
        <div className="p-4" style={{ background: "#F6F3EC" }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B6A62]">Rentabilidad neta</p>
          <p className="mt-1 text-2xl font-light tabular-nums sm:text-3xl" style={{ fontFamily: serif }}>{pct(r.netYield)}</p>
          <p className="text-xs text-[#6B6A62]">al año, sobre {usd(price)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#6B6A62]">
        Escenario conservador (10 puntos menos de ocupación y 10% menos por noche): {usd(conservative.net)} al año · {pct(conservative.netYield)}.
      </p>

      <div className="mt-5">
        <Stepper label="Ocupación" hint={`Mercado: ${MARKET.occupancy}%`} value={occupancy} onChange={setOccupancy} step={5} min={20} max={95} format={v => `${v}%`} />
        <Stepper label="Tarifa por noche" hint={`Mercado: ${usd(MARKET.adr)}`} value={adr} onChange={setAdr} step={10} min={80} max={600} format={v => usd(v)} />
        <Stepper label="Administración y operación" hint="% del ingreso — supuesto" value={mgmtPct} onChange={setMgmtPct} step={5} min={0} max={50} format={v => `${v}%`} />
        <Stepper label="Cuota de mantenimiento (HOA)" hint="Al mes — supuesto, sin cifra oficial aún" value={hoaMonthly} onChange={setHoa} step={25} min={0} max={3000} format={v => usd(v)} />
        <Stepper label="Impuesto predial" hint="% del precio al año — supuesto" value={taxPct} onChange={setTaxPct} step={0.1} min={0} max={4} format={v => `${v.toFixed(1)}%`} />
        <Stepper label="Seguro y otros" hint="Al año — supuesto" value={insuranceYear} onChange={setInsurance} step={250} min={0} max={10000} format={v => usd(v)} />
      </div>

      <dl className="mt-4 space-y-1 text-sm text-[#4F5A52]">
        <div className="flex justify-between"><dt>Ingreso bruto por alquiler</dt><dd className="tabular-nums">{usd(r.gross)}</dd></div>
        <div className="flex justify-between"><dt>− Administración</dt><dd className="tabular-nums">{usd(r.mgmt)}</dd></div>
        <div className="flex justify-between"><dt>− Mantenimiento (HOA)</dt><dd className="tabular-nums">{usd(r.hoa)}</dd></div>
        <div className="flex justify-between"><dt>− Impuesto predial</dt><dd className="tabular-nums">{usd(r.tax)}</dd></div>
        <div className="flex justify-between"><dt>− Seguro y otros</dt><dd className="tabular-nums">{usd(r.insurance)}</dd></div>
        <div className="flex justify-between border-t pt-1 font-medium text-[#1E2B23]" style={{ borderColor: LINE }}><dt>Ingreso neto</dt><dd className="tabular-nums">{usd(r.net)}</dd></div>
      </dl>

      <p className="mt-4 text-[11px] leading-relaxed text-[#8A857A]">
        Escenario ilustrativo, no una promesa de rentabilidad. Los datos son del mercado de Brickell ({MARKET.source}), no de
        Parkside, que aún está en construcción y no tiene historial de alquiler. La temporada importa: {MARKET.peak}; {MARKET.low}.
        No incluye financiamiento, impuestos sobre la renta en EE. UU. o en Colombia, valorización ni costos de amoblado
        adicionales. El desarrollador confirma la cuota de mantenimiento y las reglas de alquiler en sus documentos. En su
        presentación, Catherine revisa este escenario con usted unidad por unidad.
      </p>
    </div>
  )
}
