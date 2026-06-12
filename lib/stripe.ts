// Minimal Stripe API client via fetch — no SDK dependency needed

const STRIPE_API = "https://api.stripe.com/v1"

function getKey() {
  return process.env.STRIPE_SECRET_KEY
}

export function isStripeConfigured(): boolean {
  return !!getKey()
}

async function stripeRequest(path: string, params?: Record<string, string>) {
  const key = getKey()
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurado")
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    ...(params && { body: new URLSearchParams(params).toString() }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe error ${res.status}`)
  }
  return data
}

export async function createLeadCheckoutSession(opts: {
  shareId: string
  leadLabel: string
  amountUsd: number
  lenderEmail: string
  successUrl: string
  cancelUrl: string
}) {
  return stripeRequest("/checkout/sessions", {
    mode: "payment",
    customer_email: opts.lenderEmail,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Lead: ${opts.leadLabel}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amountUsd * 100)),
    "line_items[0][quantity]": "1",
    "metadata[shareId]": opts.shareId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  })
}

export async function getCheckoutSession(sessionId: string) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`)
}
