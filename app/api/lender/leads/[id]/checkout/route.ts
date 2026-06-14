export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"
import { createLeadCheckoutSession, isStripeConfigured } from "@/lib/stripe"

// POST — create a Stripe Checkout session to unlock a shared lead
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const partner = await getLoanOfficer()
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Pagos no configurados. Contacta a Catherine." }, { status: 503 })
  }

  const share = await prisma.leadShare.findUnique({
    where: { id: params.id },
    include: { contact: { select: { firstName: true, buyerLocation: true } } },
  })
  if (!share || share.loanOfficerId !== partner.id) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 })
  }
  if (share.status === "PAID") return NextResponse.json({ error: "Este lead ya fue pagado" }, { status: 409 })
  if (share.status === "REVOKED") return NextResponse.json({ error: "Este lead ya no está disponible" }, { status: 410 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const leadLabel = `${share.contact.firstName} — ${share.contact.buyerLocation || "Miami"}`

  try {
    const checkout = await createLeadCheckoutSession({
      shareId: share.id,
      leadLabel,
      amountUsd: share.price,
      lenderEmail: partner.email,
      successUrl: `${appUrl}/api/lender/verify-payment?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/lender`,
    })

    await prisma.leadShare.update({
      where: { id: share.id },
      data: { stripeSessionId: checkout.id },
    })

    return NextResponse.json({ url: checkout.url })
  } catch (e: any) {
    console.error("[STRIPE] checkout error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
