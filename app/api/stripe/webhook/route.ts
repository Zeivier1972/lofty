export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWebhookSignature } from "@/lib/stripe"

// Stripe sends raw body — must not use bodyParser
export async function POST(req: Request) {
  const rawBody = await req.text()
  const sigHeader = req.headers.get("stripe-signature") || ""
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event: any

  if (secret) {
    try {
      event = verifyWebhookSignature(rawBody, sigHeader, secret)
    } catch (e: any) {
      console.error("[STRIPE WEBHOOK] signature verification failed:", e.message)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  } else {
    // In development without webhook secret, trust the payload
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
  }

  try {
    await handleEvent(event)
  } catch (e: any) {
    console.error("[STRIPE WEBHOOK] handler error:", e.message)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: any) {
  const obj = event.data?.object

  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription") break
      const loanOfficerId = obj.metadata?.loanOfficerId
      if (!loanOfficerId) break
      await prisma.loanOfficer.update({
        where: { id: loanOfficerId },
        data: {
          stripeCustomerId: obj.customer || undefined,
          stripeSubscriptionId: obj.subscription || undefined,
          subscriptionStatus: "active",
        },
      })
      break
    }

    case "customer.subscription.updated": {
      const loByCustomer = await prisma.loanOfficer.findFirst({
        where: { stripeCustomerId: obj.customer },
      })
      if (!loByCustomer) break
      const endDate = obj.current_period_end ? new Date(obj.current_period_end * 1000) : null
      const status = stripeStatusToCrm(obj.status)
      await prisma.loanOfficer.update({
        where: { id: loByCustomer.id },
        data: {
          subscriptionStatus: status,
          subscriptionEndDate: endDate,
          stripeSubscriptionId: obj.id,
        },
      })
      break
    }

    case "customer.subscription.deleted": {
      const loByCustomer = await prisma.loanOfficer.findFirst({
        where: { stripeCustomerId: obj.customer },
      })
      if (!loByCustomer) break
      await prisma.loanOfficer.update({
        where: { id: loByCustomer.id },
        data: {
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          subscriptionEndDate: null,
        },
      })
      break
    }

    case "invoice.payment_failed": {
      const loByCustomer = await prisma.loanOfficer.findFirst({
        where: { stripeCustomerId: obj.customer },
      })
      if (!loByCustomer) break
      await prisma.loanOfficer.update({
        where: { id: loByCustomer.id },
        data: { subscriptionStatus: "past_due" },
      })
      break
    }

    default:
      break
  }
}

function stripeStatusToCrm(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing": return "active"
    case "past_due":
    case "unpaid":   return "past_due"
    case "canceled": return "canceled"
    default:         return "inactive"
  }
}
