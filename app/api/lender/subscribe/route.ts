export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"
import { createSubscriptionCheckoutSession, isStripeConfigured } from "@/lib/stripe"

// POST — create a Stripe subscription checkout session for the logged-in loan officer
export async function POST() {
  const partner = await getLoanOfficer()
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Pagos no configurados. Contacta a Catherine." }, { status: 503 })
  }

  if (partner.subscriptionStatus === "active") {
    return NextResponse.json({ error: "Ya tienes una suscripción activa." }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  try {
    const checkout = await createSubscriptionCheckoutSession({
      loanOfficerId: partner.id,
      loanOfficerEmail: partner.email,
      monthlyFeeUsd: partner.monthlyFee,
      successUrl: `${appUrl}/api/lender/verify-subscription?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/lender`,
    })

    return NextResponse.json({ url: checkout.url })
  } catch (e: any) {
    console.error("[STRIPE] subscribe error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
