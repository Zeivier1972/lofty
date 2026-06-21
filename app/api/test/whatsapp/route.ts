export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/sms"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { phone, firstName, tag } = await req.json()
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 })

  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER
  if (!waNumber) return NextResponse.json({ error: "TWILIO_WHATSAPP_NUMBER not set in Railway" }, { status: 503 })

  const toPhone = phone.replace(/\D/g, "")
  const to = toPhone.startsWith("1") ? `+${toPhone}` : `+1${toPhone}`

  const isInvestor = tag?.toLowerCase().includes("inversionista") || tag?.toLowerCase().includes("investor")
  const templateSid = isInvestor ? process.env.TWILIO_WA_INVESTOR_TEMPLATE_SID : undefined

  const name = firstName || "there"
  const bookingUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/book` : "https://catherinegomezrealtor.com/book"
  const realtorPhone = process.env.AGENT_PHONE || "305-283-0872"

  const freeFormBody = isInvestor
    ? `🏙️ [TEST] Hola ${name}! Soy Sofía, asistente de Catherine Gómez Realtor.\n\nVi que estás interesado en inversiones inmobiliarias en Miami. Catherine es especialista en pre-construcción con retornos del 8-12% anual.\n\n📅 Agenda: ${bookingUrl}\n📞 Tel: ${realtorPhone}`
    : `🏠 [TEST] Hola ${name}! Soy Sofía, asistente de Catherine Gomez Realtor. Vi que estás interesado en propiedades en Miami. ¿Tienes un momentito? Agenda: ${bookingUrl} · Tel: ${realtorPhone}`

  try {
    const sid = templateSid
      ? await sendWhatsAppTemplate(to, templateSid, { "1": name })
      : await sendWhatsApp(to, freeFormBody)

    return NextResponse.json({
      success: true,
      sid,
      to,
      method: templateSid ? `template (${templateSid})` : "free-form",
      note: templateSid ? "Sent via approved template" : "Sent free-form — works if contact has an open session, or upgrade to template for cold outreach",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
