// La conversión a pesos colombianos. Es el argumento que más le importa al
// público de Catherine: el mismo apartamento vale muchísimos menos pesos hoy
// que cuando el dólar estaba en su pico, y esa diferencia no aparece en
// ninguno de los cinco indicadores.
//
// La tasa vive aquí como constante y no se consulta en vivo a propósito: el
// evento es en Medellín con público en sala, y una llamada de red que falle
// deja a Catherine sin la cifra en el peor momento. Se actualiza a mano, y
// tanto ella como el advisor la pueden sobreescribir diciendo la del día.

/** TRM de referencia. Actualizar cuando se mueva de forma notable. */
export const COP_TODAY = 3193
export const COP_TODAY_ASOF = "22 de septiembre de 2026"

/**
 * El pico histórico del dólar. Es la referencia contra la que se mide el
 * ahorro, y hay que nombrarla como pico — no como "lo que usted pagó" — salvo
 * que el cliente sí haya comprado a esa tasa.
 */
export const COP_PEAK = 4800
export const COP_PEAK_LABEL = "pico histórico del dólar (2022-2023)"

export type CopComparison = {
  usd: number
  rateHigh: number
  rateNow: number
  copAtHigh: number
  copNow: number
  saving: number
  savingPct: number
  /** Cuánto costaría en pesos si el dólar volviera a la tasa alta. */
  exposureIfBack: number
}

/**
 * Cuántos pesos cuesta una cifra en dólares a dos tasas, y la diferencia.
 * `rateHigh` es la tasa de referencia alta (el pico, o la tasa a la que el
 * cliente compró de verdad); `rateNow` la de hoy.
 */
export function compareCop(usd: number, rateHigh = COP_PEAK, rateNow = COP_TODAY): CopComparison | null {
  if (!(usd > 0) || !(rateHigh > 0) || !(rateNow > 0)) return null
  const copAtHigh = usd * rateHigh
  const copNow = usd * rateNow
  return {
    usd,
    rateHigh,
    rateNow,
    copAtHigh,
    copNow,
    saving: copAtHigh - copNow,
    savingPct: ((copAtHigh - copNow) / copAtHigh) * 100,
    // Mismo número que copAtHigh, pero con otro significado: lo que le costaría
    // si el peso se devalúa otra vez. Se nombra aparte para no confundirlos.
    exposureIfBack: copAtHigh,
  }
}

/** Pesos con separador de miles, sin decimales — así los lee un colombiano. */
export function cop(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")}`
}

/**
 * Cifras grandes dichas en voz alta: 1.388.900.000 -> "1,4 mil millones".
 * Un decimal a propósito: con tres ("1,389 mil millones") cualquiera lo lee
 * como mil trescientos ochenta y nueve.
 */
export function copShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} mil millones`
  if (abs >= 1e6) return `${Math.round(n / 1e6).toLocaleString("es-CO")} millones`
  return cop(n)
}
