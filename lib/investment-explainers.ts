// Plain-Spanish sales script for each indicator. This is the point of the
// workbook: Catherine opens it in front of a client and reads down the sheet.
// No jargon, no finance degree — an analogy and a sentence she can say out loud.

export type Explainer = {
  key: string
  title: string
  queEs: string
  comoExplicarlo: string
  porQueImporta: string
  siEsBajo?: string
  rangos?: string
}

export const EXPLAINERS: Explainer[] = [
  {
    key: "noi",
    title: "1. NOI — Ingreso Operativo Neto",
    queEs: "Lo que produce el apartamento al mes después de pagar sus gastos de operación, pero ANTES de pagarle al banco.",
    comoExplicarlo: "\"Piense en el apartamento como un negocito. El NOI es lo que ese negocio gana antes de la cuota del banco. Si el NOI es positivo, el apartamento se mantiene solo: la renta cubre la administración, los impuestos, el HOA y el seguro.\"",
    porQueImporta: "Mide la propiedad, no cómo usted la financió. Dos personas con el mismo apartamento tienen el mismo NOI, aunque una pague de contado y la otra con préstamo. Por eso es el número con el que se comparan edificios.",
    siEsBajo: "Si el NOI es negativo, el apartamento no cubre ni sus propios gastos. Ahí hay que revisar la ocupación, la tarifa por noche o el HOA antes de seguir.",
  },
  {
    key: "cashflow",
    title: "2. CASH FLOW — Flujo de caja",
    queEs: "El dinero que le queda en el bolsillo cada mes, después de TODO, incluida la cuota de la hipoteca.",
    comoExplicarlo: "\"Esto es lo que le cae a su cuenta cada mes. Si da positivo, el huésped le está pagando el apartamento a usted: usted puso la inicial y la propiedad hace el resto.\"",
    porQueImporta: "Es el número que la gente siente. El NOI es teoría hasta que se paga la deuda; el cash flow es plata real disponible.",
    siEsBajo: "Si da negativo, el cliente pone de su bolsillo cada mes. Puede tener sentido si la valorización es fuerte, pero hay que decírselo de frente y mostrarle cuánto es.",
  },
  {
    key: "cashoncash",
    title: "3. CASH ON CASH — Retorno sobre el capital invertido",
    queEs: "Cuánto le rinde al año, solo por flujo de renta, el dinero que usted REALMENTE puso de su bolsillo (el down payment).",
    comoExplicarlo: "\"Usted pone {{downPayment}} de su bolsillo. Al año le quedan libres {{cashFlowYear}}. Eso es {{cashOnCash}} sobre su plata. Compárelo con lo que le paga un CDT en Colombia o una cuenta de ahorros aquí — y esto además viene con un apartamento en Miami detrás.\"",
    porQueImporta: "Es la comparación más honesta contra cualquier otra inversión financiera, porque mide el rendimiento del dinero que salió de su cuenta, no del precio total del apartamento.",
    rangos: "Menos de 6% Bajo · 6 a 8% Aceptable · 8 a 10% Bueno · Más de 10% Muy Bueno",
  },
  {
    key: "roi",
    title: "4. ROI — Retorno sobre la inversión",
    queEs: "El retorno completo: el flujo de caja, MÁS la valorización, MÁS lo que le abonó al capital de la deuda, MENOS los gastos de cierre.",
    comoExplicarlo: "\"El cash on cash solo mira la plata que entra cada mes. El ROI mira todo lo que usted ganó en el año: la renta, lo que subió el apartamento, y lo que dejó de deberle al banco. Es la foto completa.\"",
    porQueImporta: "En preconstrucción la valorización suele ser el pedazo más grande del ROI — y el cliente la gana habiendo puesto solo el 40%. Ese es el argumento central de comprar sobre planos.",
    rangos: "Menos de 5% Bajo · 5 a 10% Aceptable · 10 a 15% Bueno · Más de 15% Muy Bueno",
  },
  {
    key: "caprate",
    title: "5. CAP RATE — Tasa de capitalización",
    queEs: "El rendimiento del inmueble sobre su propio valor, sin contar deuda. Lo que daría si lo comprara 100% de contado.",
    comoExplicarlo: "\"Es la nota del apartamento como inversión, sin importar quién lo compre ni cómo lo pague. Sirve para poner dos edificios distintos lado a lado y ver cuál trabaja mejor.\"",
    porQueImporta: "Como no depende del financiamiento, es el número que usan los inversionistas para comparar mercados enteros: Brickell contra Orlando, o Miami contra Medellín.",
    rangos: "Menos de 4% Bajo · 4 a 6% Aceptable · 6 a 8% Bueno · Más de 8% Muy Bueno",
  },
  {
    key: "valorizacion",
    title: "VALORIZACIÓN durante la obra",
    queEs: "Cuánto sube el precio de lista del proyecto entre hoy y la entrega. El desarrollador sube precios en cada nueva lista.",
    comoExplicarlo: "\"Usted firma hoy al precio de hoy y paga por cuotas mientras construyen. Cuando le entreguen, el mismo apartamento ya se vende más caro. Usted compró al precio viejo con solo una parte del dinero puesto.\"",
    porQueImporta: "Es la razón de ser de la preconstrucción. Y como el cliente solo tiene puesto el 40%, la valorización se calcula sobre el precio total pero se gana sobre una inversión mucho menor.",
  },
  {
    key: "cambio",
    title: "VENTAJA POR TASA DE CAMBIO",
    queEs: "Lo que cuesta el mismo apartamento en pesos colombianos hoy, comparado con lo que costaba cuando el dólar estaba más caro.",
    comoExplicarlo: "\"Con el dólar a {{copRateAtPurchase}}, este apartamento costaba {{copAtPurchase}} pesos. Hoy, con el dólar a {{copRateToday}}, cuesta {{copToday}}. Son {{copGain}} pesos menos por el mismo apartamento — un {{copGainPct}}. Ese descuento no se lo da el desarrollador: se lo da la tasa de cambio, y puede desaparecer.\"",
    porQueImporta: "No aparece en ningún indicador de retorno, y para un comprador colombiano suele ser el número más grande de toda la conversación. Es un argumento de urgencia real, no inventado.",
  },
]
