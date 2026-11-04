"use client"

/**
 * "¿Cuánto podría rentar?" — an honest rental scenario for the plan's unit.
 *
 * Two starting points the visitor switches between: today's Brickell market
 * (PriceLabs data) and the projection an investor analysing Parkside shared
 * with Catherine. Costs are Parkside's (HOA US$1.70/sq ft incl. water,
 * internet, cable, master insurance and valet; 1.7% property tax; US$400
 * electricity) from Catherine's calculators, and the visitor can pay cash or
 * finance (40% down, 6.5%, 30 years) and see the cash-on-cash return.
 * Every number moves; nothing here is a promise.
 */

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { MARKET, DEFAULTS, SQFT, SCENARIOS, rentScenario, usd, type UnitType } from "./data"

const FOREST = "#1E2B23"
const GREEN = "#2E4236"
const SAND = "#B59A6A"
const LINE = "rgba(46,66,54,.22)"
const serif = "var(--font-display), Georgia, serif"

type ScenarioKey = keyof typeof SCENARIOS

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

function Toggle<T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="border px-3 py-2.5 text-sm font-medium transition"
          style={value === v
            ? { background: GREEN, borderColor: GREEN, color: "#fff" }
            : { background: "#fff", borderColor: LINE, color: FOREST }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export default function RentScenario({ price, unitType }: { price: number; unitType: UnitType }) {
  const [scenario, setScenario] = useState<ScenarioKey>("market")
  const [occupancy, setOccupancy] = useState<number>(SCENARIOS.market.occupancy)
  const [adr, setAdr] = useState<number>(SCENARIOS.market.adr)
  const [mgmtPct, setMgmtPct] = useState(DEFAULTS.mgmtPct)
  const [hoaMonthly, setHoa] = useState(Math.round(SQFT[unitType] * DEFAULTS.hoaPerSqft))
  const [taxPct, setTaxPct] = useState(DEFAULTS.taxPct)
  const [electricityMonthly, setElectricity] = useState(DEFAULTS.electricityMonthly)
  const [insuranceYear, setInsurance] = useState(DEFAULTS.insuranceYear)
  const [payment, setPayment] = useState<"cash" | "loan">("cash")
  const [downPct, setDownPct] = useState(DEFAULTS.downPct)
  const [ratePct, setRatePct] = useState(DEFAULTS.ratePct)

  const pick = (k: ScenarioKey) => {
    setScenario(k)
    setOccupancy(SCENARIOS[k].occupancy)
    setAdr(SCENARIOS[k].adr)
  }

  const r = rentScenario({
    price, occupancy, adr, mgmtPct, hoaMonthly, taxPct, insuranceYear, electricityMonthly,
    closingPct: DEFAULTS.closingPct,
    financing: payment === "loan" ? { downPct, ratePct, years: DEFAULTS.years } : null,
  })
  const pct = (v: number) => `${v.toFixed(1)}%`
  const negative = r.net < 0

  return (
    <div className="border bg-white p-5 sm:p-8" style={{ borderColor: LINE, color: FOREST }}>
      <p className="text-[11px] font-medium uppercase tracking-[0.3em]" style={{ color: SAND }}>Escenario de rentabilidad</p>
      <h3 className="mt-3 text-2xl font-light leading-snug sm:text-3xl" style={{ fontFamily: serif }}>
        ¿Cuánto podría rentar {unitType === "Estudio" ? "un estudio" : `una residencia de ${unitType}`} en Parkside?
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[#4F5A52]">
        Compare dos puntos de partida, elija si paga de contado o con financiamiento, y ajuste cada supuesto.
      </p>

      <div className="mt-5 space-y-3">
        <Toggle label="Escenario" value={scenario} onChange={pick} options={[["market", SCENARIOS.market.label], ["investor", SCENARIOS.investor.label]]} />
        <p className="text-xs leading-relaxed text-[#6B6A62]">{SCENARIOS[scenario].note}</p>
        <Toggle label="Forma de pago" value={payment} onChange={setPayment} options={[["cash", "Pago de contado"], ["loan", `Con financiamiento (${downPct}% inicial)`]]} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="p-4" style={{ background: "#F6F3EC" }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B6A62]">{payment === "loan" ? "Le queda al año" : "Ingreso neto al año"}</p>
          <p className="mt-1 text-2xl font-light tabular-nums sm:text-3xl" style={{ fontFamily: serif, color: negative ? "#9B4B3A" : FOREST }}>{usd(r.net)}</p>
          <p className="text-xs text-[#6B6A62]">≈ {usd(r.net / 12)} al mes{payment === "loan" ? ", después de la hipoteca" : ""}</p>
        </div>
        <div className="p-4" style={{ background: "#F6F3EC" }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B6A62]">Retorno sobre su capital</p>
          <p className="mt-1 text-2xl font-light tabular-nums sm:text-3xl" style={{ fontFamily: serif, color: negative ? "#9B4B3A" : FOREST }}>{pct(r.cashOnCash)}</p>
          <p className="text-xs text-[#6B6A62]">al año, sobre {usd(r.cashIn)} invertidos{payment === "loan" ? " (inicial + cierre)" : " (precio + cierre)"}</p>
        </div>
      </div>
      {negative && (
        <p className="mt-3 text-xs leading-relaxed text-[#9B4B3A]">
          Con estos supuestos el alquiler no cubre todos los costos{payment === "loan" ? " y la hipoteca" : ""}. Pruebe otra ocupación, tarifa o
          inicial — o revíselo con Catherine: por eso preferimos mostrarle los números completos.
        </p>
      )}

      <div className="mt-5">
        <Stepper label="Ocupación" hint={`Mercado de Brickell: ${MARKET.occupancy}%`} value={occupancy} onChange={setOccupancy} step={5} min={20} max={95} format={v => `${v}%`} />
        <Stepper label="Tarifa por noche" hint={`Mercado de Brickell: ${usd(MARKET.adr)}`} value={adr} onChange={setAdr} step={10} min={80} max={1500} format={v => usd(v)} />
        <Stepper label="Administración del alquiler" hint="% del ingreso — supuesto" value={mgmtPct} onChange={setMgmtPct} step={5} min={0} max={50} format={v => `${v}%`} />
        <Stepper label="Cuota de mantenimiento (HOA)" hint="US$1.70/pie² al mes: incluye agua, internet, cable, seguro del edificio y valet" value={hoaMonthly} onChange={setHoa} step={25} min={0} max={5000} format={v => usd(v)} />
        <Stepper label="Impuesto predial" hint="% del precio al año" value={taxPct} onChange={setTaxPct} step={0.1} min={0} max={4} format={v => `${v.toFixed(1)}%`} />
        <Stepper label="Electricidad" hint="Al mes" value={electricityMonthly} onChange={setElectricity} step={25} min={0} max={1500} format={v => usd(v)} />
        <Stepper label="Seguro de la unidad" hint="Al año — supuesto" value={insuranceYear} onChange={setInsurance} step={100} min={0} max={10000} format={v => usd(v)} />
        {payment === "loan" && (
          <>
            <Stepper label="Inicial" hint="En Parkside los depósitos ya suman el 40%" value={downPct} onChange={setDownPct} step={5} min={20} max={80} format={v => `${v}%`} />
            <Stepper label="Tasa del crédito" hint="30 años — supuesto, depende del banco" value={ratePct} onChange={setRatePct} step={0.25} min={3} max={12} format={v => `${v.toFixed(2)}%`} />
          </>
        )}
      </div>

      <dl className="mt-4 space-y-1 text-sm text-[#4F5A52]">
        <div className="flex justify-between"><dt>Ingreso bruto por alquiler</dt><dd className="tabular-nums">{usd(r.gross)}</dd></div>
        <div className="flex justify-between"><dt>− Administración</dt><dd className="tabular-nums">{usd(r.mgmt)}</dd></div>
        <div className="flex justify-between"><dt>− Mantenimiento (HOA)</dt><dd className="tabular-nums">{usd(r.hoa)}</dd></div>
        <div className="flex justify-between"><dt>− Impuesto predial</dt><dd className="tabular-nums">{usd(r.tax)}</dd></div>
        <div className="flex justify-between"><dt>− Electricidad</dt><dd className="tabular-nums">{usd(r.electricity)}</dd></div>
        <div className="flex justify-between"><dt>− Seguro de la unidad</dt><dd className="tabular-nums">{usd(r.insurance)}</dd></div>
        <div className="flex justify-between border-t pt-1 font-medium text-[#1E2B23]" style={{ borderColor: LINE }}><dt>Ingreso operativo</dt><dd className="tabular-nums">{usd(r.noi)}</dd></div>
        {payment === "loan" && (
          <>
            <div className="flex justify-between"><dt>− Hipoteca ({100 - downPct}% financiado, {ratePct.toFixed(2)}%, 30 años)</dt><dd className="tabular-nums">{usd(r.debt)}</dd></div>
            <div className="flex justify-between border-t pt-1 font-medium text-[#1E2B23]" style={{ borderColor: LINE }}><dt>Le queda al año</dt><dd className="tabular-nums">{usd(r.net)}</dd></div>
          </>
        )}
      </dl>

      <p className="mt-4 text-[11px] leading-relaxed text-[#8A857A]">
        Escenario ilustrativo, no una promesa ni una garantía de rentabilidad. &quot;Mercado de Brickell hoy&quot; usa datos de
        {" "}{MARKET.source} ({MARKET.asOf}); la temporada importa: {MARKET.peak}; {MARKET.low}. &quot;Escenario de un inversionista&quot;
        es una proyección de un tercero que analiza el proyecto, no del desarrollador ni nuestra. Parkside está en construcción y no
        tiene historial de alquiler. Costos de Parkside según la información del proyecto (cuota de mantenimiento de US$1.70/pie²,
        gastos de cierre estimados en {DEFAULTS.closingPct}%); confírmelos en los documentos del desarrollador. No incluye impuestos
        sobre la renta en EE. UU. o Colombia, valorización, vacancia por mantenimiento ni las condiciones finales del crédito. No somos
        asesores financieros, tributarios ni legales.
      </p>
    </div>
  )
}
