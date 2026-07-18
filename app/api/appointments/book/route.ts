export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const {
      date, time, slotMinutes = 30,
      firstName, lastName, email, phone,
      topic, message, type = "BUYER_CONSULTATION",
      meetingType = "PHONE",
    } = await req.json()

    if (!date || !time || !firstName || !lastName) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const startTime = new Date(`${date}T${time}:00`)
    const endTime = new Date(startTime.getTime() + slotMinutes * 60000)

    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: "Fecha/hora inválida" }, { status: 400 })
    }

    // Find or create contact
    let contact = null
    if (email) {
      contact = await prisma.contact.findFirst({ where: { email } })
    }
    if (!contact && phone) {
      contact = await prisma.contact.findFirst({ where: { phone } })
    }
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          status: "LEAD",
          source: "WEBSITE",
          leadScore: 40,
          notes: message ? {
            create: { content: `Mensaje al agendar cita: ${message}` },
          } : undefined,
        },
      })
    }

    // Get the agent user (first user or admin)
    const agent = await prisma.user.findFirst({ where: { isActive: true } })
    const aiCfg = await prisma.aIConfig.findFirst({ select: { realtorEmail: true, realtorPhone: true, realtorName: true, zoomLink: true } })
    const zoomLink = aiCfg?.zoomLink || "https://zoom.us/j/9840963033"
    const meetingLocation = meetingType === "ZOOM" ? `Zoom — ${zoomLink}` : "Teléfono"

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        title: `${topic || "Consulta"} — ${firstName} ${lastName}`,
        description: message || `Cita agendada en línea. Tema: ${topic || "General"}`,
        startTime,
        endTime,
        type,
        status: "SCHEDULED",
        location: meetingLocation,
        contactId: contact.id,
        ...(agent && { userId: agent.id }),
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "APPOINTMENT_SCHEDULED",
        title: `Cita agendada: ${topic || "Consulta general"}`,
        description: `${firstName} ${lastName} agendó una cita para el ${date} a las ${time}`,
        contactId: contact.id,
        ...(agent && { userId: agent.id }),
      },
    })

    // Create task for Catherine
    await prisma.task.create({
      data: {
        title: `Cita con ${firstName} ${lastName} — ${time}`,
        description: `Tema: ${topic || "Consulta"}\n${message ? `Mensaje: ${message}` : ""}`,
        priority: "HIGH",
        type: "APPOINTMENT",
        contactId: contact.id,
        dueDate: startTime,
        ...(agent && { assignedToId: agent.id }),
      },
    })

    // Notify Catherine by email and SMS
    const cfg = aiCfg
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"
    const formattedDateCath = new Date(startTime).toLocaleDateString("es-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })

    if (cfg?.realtorEmail) {
      const lines = [
        `Nombre: ${firstName} ${lastName}`,
        email ? `Email: ${email}` : "",
        phone ? `Tel: ${phone}` : "",
        `Tema: ${topic || "Consulta general"}`,
        `Fecha: ${formattedDateCath} a las ${time}`,
        message ? `Mensaje: ${message}` : "",
      ].filter(Boolean)

      sendEmail({
        to: cfg.realtorEmail,
        transactional: true,
        subject: `📅 Nueva cita: ${firstName} ${lastName} — ${formattedDateCath} ${time}`,
        html: `<p>Hola ${cfg.realtorName || "Catherine"},</p><p>Tienes una nueva cita agendada en línea:</p><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul><p><a href="${appUrl}/contacts/${contact.id}">Ver contacto en el CRM →</a></p>`,
        text: `Nueva cita:\n${lines.join("\n")}\n\nVer CRM: ${appUrl}/contacts/${contact.id}`,
      }).catch(e => console.error("[BOOKING] Realtor email failed:", e))
    }

    // Notify Catherine
    await prisma.aINotification.create({
      data: {
        title: `📅 Nueva cita: ${firstName} ${lastName}`,
        body: `${topic || "Consulta"} el ${new Date(startTime).toLocaleDateString("es-US", { weekday: "long", month: "long", day: "numeric" })} a las ${time}`,
        type: "APPOINTMENT_REQUEST",
        priority: "HIGH",
        contactId: contact.id,
        metadata: JSON.stringify({ date, time, topic, message }),
      },
    })

    // Send confirmation email to lead
    if (email) {
      const formattedDate = new Date(startTime).toLocaleDateString("es-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
      try {
        await sendEmail({
          to: email,
          transactional: true,
          subject: `✅ Cita Confirmada con Catherine / Your Appointment is Confirmed`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px;border-radius:16px 16px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:24px">¡Cita Confirmada! 🎉</h1>
    <p style="color:#c4b5fd;margin:8px 0 0">Appointment Confirmed</p>
  </div>
  <div style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb">
    <p style="color:#374151">Hola <strong>${firstName}</strong>,</p>
    <p style="color:#374151">Tu cita ha sido confirmada. Aquí están los detalles:</p>
    <div style="background:#F3F4F6;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#6B7280;font-size:14px">📅 Fecha / Date</p>
      <p style="margin:0 0 16px;font-weight:bold;color:#111827">${formattedDate}</p>
      <p style="margin:0 0 8px;color:#6B7280;font-size:14px">⏰ Hora / Time</p>
      <p style="margin:0 0 16px;font-weight:bold;color:#111827">${time}</p>
      <p style="margin:0 0 8px;color:#6B7280;font-size:14px">📋 Tema / Topic</p>
      <p style="margin:0;font-weight:bold;color:#111827">${topic || "Consulta general"}</p>
    </div>
    ${meetingType === "ZOOM"
      ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0 0 8px;font-weight:bold;color:#1E40AF">📹 Tu enlace de Zoom / Your Zoom Link</p>
          <a href="${zoomLink}" style="color:#2563EB;word-break:break-all">${zoomLink}</a>
          <p style="margin:8px 0 0;font-size:13px;color:#3B82F6">Guarda este enlace — lo usarás el día de la cita.</p>
        </div>`
      : `<p style="color:#374151">Catherine te llamará al número que proporcionaste el día de la cita.</p>`
    }
    <p style="color:#374151">Si necesitas cambiar o cancelar tu cita, por favor responde a este correo.</p>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0"/>
    <p style="color:#374151">Hi <strong>${firstName}</strong>, your appointment has been confirmed for ${formattedDate} at ${time}. ${meetingType === "ZOOM" ? `Join via Zoom: <a href="${zoomLink}">${zoomLink}</a>` : "Catherine will call you at the number you provided."}</p>
  </div>
</div>`,
        })
      } catch (e) {
        console.error("Confirmation email failed:", e)
      }
    }

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      message: "¡Cita confirmada! Te enviaremos un correo de confirmación.",
      ...(meetingType === "ZOOM" && { zoomLink }),
    })
  } catch (e) {
    console.error("Booking error:", e)
    return NextResponse.json({ error: "Error al agendar la cita" }, { status: 500 })
  }
}
