export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerOutboundCall } from "@/lib/vapi"

function isBusinessHours(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  const day = et.getDay()
  if (day === 0) return false // no Sunday calls
  return hour >= 8 && hour < 21  // 8 am–9 pm ET
}

// GET /api/cron/calls
// Called by Railway cron every 15 minutes.
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isBusinessHours()) {
    return NextResponse.json({ skipped: "outside business hours" })
  }

  const now = new Date()
  const expiryCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  // Expire stale pending calls (> 48h past due — missed too many windows)
  await prisma.scheduledCall.updateMany({
    where: { status: "PENDING", scheduledAt: { lte: expiryCutoff } },
    data: { status: "EXPIRED" },
  })

  const pending = await prisma.scheduledCall.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now } },
    include: { contact: true },
    take: 20, // process max 20 per run to avoid timeout
  })

  const results: { contactId: string; status: string }[] = []

  for (const sc of pending) {
    const contact = sc.contact

    // Skip if opted out
    if (contact.doNotCall) {
      await prisma.scheduledCall.update({ where: { id: sc.id }, data: { status: "CANCELLED" } })
      results.push({ contactId: contact.id, status: "cancelled_do_not_call" })
      continue
    }

    // Skip if lead already moved to Warm or beyond
    const lead = await prisma.pipelineLead.findFirst({
      where: { contactId: contact.id },
      include: { stage: true },
    })
    const stageName = lead?.stage?.name ?? ""
    const engagedStages = ["Warm", "Hot", "Appointment Set", "Showing", "Under Contract", "Closed"]
    if (engagedStages.includes(stageName)) {
      await prisma.scheduledCall.update({ where: { id: sc.id }, data: { status: "CANCELLED" } })
      results.push({ contactId: contact.id, status: "cancelled_already_engaged" })
      continue
    }

    const phone = contact.phone
    if (!phone) {
      await prisma.scheduledCall.update({ where: { id: sc.id }, data: { status: "CANCELLED" } })
      results.push({ contactId: contact.id, status: "cancelled_no_phone" })
      continue
    }

    const toPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`

    const callId = await triggerOutboundCall({
      toPhone,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
      budgetMax: contact.buyerBudgetMax ?? null,
      budgetMin: contact.buyerBudgetMin ?? null,
      location: contact.buyerLocation ?? null,
      bedrooms: contact.buyerBedroomsMin ?? null,
      propertyType: contact.buyerPropertyType ?? null,
      skipBusinessHoursCheck: true, // already checked above
    })

    if (callId) {
      await prisma.scheduledCall.update({ where: { id: sc.id }, data: { status: "FIRED" } })
      results.push({ contactId: contact.id, status: "fired" })
    } else {
      // VAPI unavailable or auto-call disabled — leave PENDING for next run
      results.push({ contactId: contact.id, status: "skipped_vapi_unavailable" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
