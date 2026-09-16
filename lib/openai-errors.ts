// Clasificar el error de OpenAI que ve Catherine. Dos veces hoy el mensaje la
// mandó a arreglar lo que no estaba roto — primero la API key, después el tier
// de la cuenta — cuando la causa real era otra. Vive aparte de la ruta para
// poder probarlo con los cuerpos que OpenAI devuelve de verdad.

/** Sin saldo llega como 429 igual que un rate limit, pero con
 *  `insufficient_quota` o un mensaje de créditos. Distinguirlos es lo que
 *  decide si esperar sirve de algo. */
export function isOutOfCredit(status: number, code: string, message: string): boolean {
  if (status === 402) return true
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") return true
  return /no credits remaining|exceeded your current quota|billing/i.test(message)
}

export function parseOpenAIError(body: string): { code: string; message: string } {
  return {
    code: body.match(/"code":\s*"([^"]+)"/)?.[1] || "",
    message: body.match(/"message":\s*"([^"]+)"/)?.[1] || "",
  }
}

/** Nombrar la falla real, con la acción que de verdad la destraba. */
export function describeOpenAIError(status: number, body: string): string {
  const { code, message } = parseOpenAIError(body)
  // OpenAI devuelve 429 para dos problemas que no tienen nada que ver: pasarse
  // de tokens por minuto, y no tener plata en la cuenta. Esperar arregla el
  // primero y nunca el segundo, así que el caso de saldo va primero o el
  // mensaje la manda a subir un límite que jamás fue lo que la frenó.
  if (isOutOfCredit(status, code, message)) {
    return `La cuenta de OpenAI se quedó sin saldo, así que el asesor no puede responder hasta que se recargue. Agrega crédito en https://platform.openai.com/settings/organization/billing y vuelve a preguntar — no hay nada que esperar ni reintentar. Detalle: ${message || "sin saldo"}`
  }
  if (status === 401) {
    return "La OPENAI_API_KEY de Railway no es válida o fue revocada. Cámbiala en las variables de entorno de Railway."
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return `OpenAI limitó la petición por exceso de tokens por minuto y los reintentos no alcanzaron. Espera un minuto y vuelve a preguntar. Si pasa seguido, sube el tier de la cuenta de OpenAI: el límite actual de la organización es muy bajo para conversaciones largas. Detalle: ${message || "rate limit"}`
  }
  if (status === 404 || /model/i.test(message)) {
    return `OpenAI no reconoció el modelo solicitado. Detalle: ${message}`
  }
  return `OpenAI devolvió un error ${status}. Detalle: ${message || "sin mensaje"}`
}
