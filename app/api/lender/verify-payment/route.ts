export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCheckoutSession } from "@/lib/stripe"

// GET — Stripe success_url redirect: verify the session and unlock the lead.
// Works without webhooks, so only STRIPE_SECRET_KEY is needed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("session_id")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!sessionId) return NextResponse.redirect(`${appUrl}/lender`)

  try {
    const session = await getCheckoutSession(sessionId)
    const shareId = session.metadata?.shareId

    if (session.payment_status === "paid" && shareId) {
      const share = await prisma.leadShare.update({
        where: { id: shareId },
        data: { status: "PAID", paidAt: new Date(), stripeSessionId: sessionId },
        include: { loanOfficer: { select: { name: true, company: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
      })

      await prisma.activity.create({
        data: {
          type: "NOTE",
          title: "Lead pagado por loan officer",
          description: `${share.loanOfficer.name}${share.loanOfficer.company ? ` (${share.loanOfficer.company})` : ""} pagó $${share.price} por el lead`,
          contactId: share.contact.id,
        },
      }).catch(() => {})

      await prisma.aINotification.create({
        data: {
          type: "PAYMENT",
          title: `💰 ${share.loanOfficer.name} pagó $${share.price}`,
          body: `Lead: ${share.contact.firstName} ${share.contact.lastName || ""}`.trim(),
          priority: "MEDIUM",
          contactId: share.contact.id,
        },
      }).catch(() => {})

      return NextResponse.redirect(`${appUrl}/lender/leads/${shareId}?paid=1`)
    }
  } catch (e: any) {
    console.error("[STRIPE] verify-payment error:", e.message)
  }

  return NextResponse.redirect(`${appUrl}/lender`)
}
