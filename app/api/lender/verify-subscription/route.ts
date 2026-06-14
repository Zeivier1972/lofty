export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCheckoutSession, getSubscription } from "@/lib/stripe"

// GET — Stripe success_url redirect after subscription checkout
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("session_id")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!sessionId) return NextResponse.redirect(`${appUrl}/lender`)

  try {
    const session = await getCheckoutSession(sessionId)
    const loanOfficerId = session.metadata?.loanOfficerId
    const subscriptionId = session.subscription

    if (session.status === "complete" && loanOfficerId && subscriptionId) {
      const sub = await getSubscription(subscriptionId)
      const endDate = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null

      await prisma.loanOfficer.update({
        where: { id: loanOfficerId },
        data: {
          stripeCustomerId: session.customer as string || undefined,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
          subscriptionEndDate: endDate,
        },
      })

      await prisma.aINotification.create({
        data: {
          type: "PAYMENT",
          title: `💳 Loan officer se suscribió`,
          body: `Suscripción mensual activada para loan officer ID: ${loanOfficerId}`,
          priority: "MEDIUM",
        },
      }).catch(() => {})
    }
  } catch (e: any) {
    console.error("[STRIPE] verify-subscription error:", e.message)
  }

  return NextResponse.redirect(`${appUrl}/lender?subscribed=1`)
}
