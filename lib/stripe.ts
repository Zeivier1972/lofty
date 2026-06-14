import { createHmac } from "crypto"

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

// ── Monthly subscription checkout ─────────────────────────────────────────────

export async function createSubscriptionCheckoutSession(opts: {
  loanOfficerId: string
  loanOfficerEmail: string
  monthlyFeeUsd: number
  successUrl: string
  cancelUrl: string
}) {
  return stripeRequest("/checkout/sessions", {
    mode: "subscription",
    customer_email: opts.loanOfficerEmail,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Portal de Leads — Acceso Mensual",
    "line_items[0][price_data][product_data][description]": "Acceso ilimitado a todos los leads compartidos por Catherine Gomez Realtor",
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.monthlyFeeUsd * 100)),
    "line_items[0][quantity]": "1",
    "metadata[loanOfficerId]": opts.loanOfficerId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  })
}

export async function getCheckoutSession(sessionId: string) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`)
}

export async function getSubscription(subscriptionId: string) {
  return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

export async function cancelSubscription(subscriptionId: string) {
  return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    cancel_at_period_end: "true",
  })
}

// ── Webhook signature verification ────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, sigHeader: string, secret: string): any {
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("=")
    if (k && v) acc[k] = v
    return acc
  }, {} as Record<string, string>)

  const timestamp = parts["t"]
  const sig = parts["v1"]
  if (!timestamp || !sig) throw new Error("Missing webhook signature parts")

  const payload = `${timestamp}.${rawBody}`
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex")
  if (expected !== sig) throw new Error("Invalid webhook signature")

  // Replay attack prevention: reject events older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("Webhook timestamp too old")
  }

  return JSON.parse(rawBody)
}

// ── Legacy per-lead checkout (kept for historical verify-payment route) ────────

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
