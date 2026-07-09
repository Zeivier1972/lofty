export const dynamic = "force-dynamic"

// Twilio delivery-receipt webhook (statusCallback on every outbound SMS).
// 1. Updates the SMSMessage row to its REAL status (delivered/failed/…)
// 2. On PERMANENT failures (landline, invalid, unreachable, carrier-blocked),
//    flags every matching contact doNotText — the central guard in sendSMS
//    then blocks all future sends to that number. No more paying to text
//    numbers that can never receive messages.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Twilio error codes that mean "this number will never receive SMS"
// 21211 invalid number · 21610 unsubscribed · 21614 not SMS-capable
// 30003 unreachable · 30004 blocked · 30005 unknown number · 30006 landline
const PERMANENT_ERRORS = new Set(["21211", "21610", "21614", "30003", "30004", "30005", "30006"])

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const sid = String(form.get("MessageSid") || form.get("SmsSid") || "")
    const status = String(form.get("MessageStatus") || form.get("SmsStatus") || "").toLowerCase()
    const errorCode = String(form.get("ErrorCode") || "")
    const to = String(form.get("To") || "")

    if (sid && status) {
      await prisma.sMSMessage.updateMany({
        where: { sid },
        data: { status: status.toUpperCase() },
      }).catch(() => {})
    }

    const isFailure = status === "failed" || status === "undelivered"
    if (isFailure && PERMANENT_ERRORS.has(errorCode) && to) {
      const digits = to.replace(/\D/g, "").slice(-10)
      if (digits.length >= 7) {
        const contacts = await prisma.contact.findMany({
          where: { phone: { contains: digits }, doNotText: false },
          select: { id: true, firstName: true, lastName: true },
        })
        if (contacts.length > 0) {
          await prisma.contact.updateMany({
            where: { id: { in: contacts.map(c => c.id) } },
            data: { doNotText: true },
          })
          // Log on the contact's timeline only — NO bell notification per number.
          // (A drip batch can surface dozens of dead numbers at once and flooding
          // the bell buries the notifications that actually need action.)
          for (const c of contacts) {
            prisma.activity.create({
              data: {
                type: "NOTE_ADDED",
                title: "🚫 SMS desactivado automáticamente",
                description: `El número no puede recibir mensajes (Twilio error ${errorCode} — línea fija, inválido o bloqueado). No se enviarán más textos; usa email o llamada.`,
                contactId: c.id,
              },
            }).catch(() => {})
          }
          console.log(`[sms-status] Permanent failure ${errorCode} for ${to} — doNotText set on ${contacts.length} contact(s)`)
        }
      }
    }

    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } })
  } catch (e) {
    console.error("[sms-status] error:", e)
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "Twilio statusCallback endpoint — POST only" })
}
