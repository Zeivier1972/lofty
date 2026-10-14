export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerOutboundCall } from "@/lib/vapi"
import { toE164 } from "@/lib/sms"
import { isWithinCallingWindow } from "@/lib/calling-hours"

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

    const toPhone = toE164(phone)

    // Checked per lead rather than once per run: the window depends on their
    // area code, so a Miami number and a California number are not callable at
    // the same hour. Left PENDING so it retries in a later run.
    if (!isWithinCallingWindow(toPhone)) {
      results.push({ contactId: contact.id, status: "skipped_outside_calling_window" })
      continue
    }

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
