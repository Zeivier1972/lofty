export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSMS } from "@/lib/sms"

export async function POST(req: Request) {
  try {
    const {
      title, type = "OTHER", startTime, endTime,
      contactId, location, description, virtualLink,
    } = await req.json()

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: "title, startTime, and endTime are required" }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
    }

    const agent = await prisma.user.findFirst({ where: { isActive: true } })

    const appointment = await prisma.appointment.create({
      data: {
        title,
        type,
        startTime: start,
        endTime: end,
        location: location || null,
        description: description || null,
        virtualLink: virtualLink || null,
        status: "SCHEDULED",
        ...(contactId ? { contactId } : {}),
        ...(agent ? { userId: agent.id } : {}),
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    })

    if (contactId) {
      await prisma.activity.create({
        data: {
          type: "APPOINTMENT_SCHEDULED",
          title: `Cita agendada: ${title}`,
          description: description || null,
          contactId,
          ...(agent ? { userId: agent.id } : {}),
        },
      }).catch(() => {})

      // Notify the CLIENT (email + SMS confirmation) — fire-and-forget.
      // The appointment lands on the CRM calendar via the row itself.
      const c = appointment.contact
      if (c) {
        const cfg = await prisma.aIConfig.findFirst({
          select: { realtorName: true, realtorPhone: true },
        }).catch(() => null)
        const agentName = cfg?.realtorName || "Catherine Gomez"
        const agentPhone = cfg?.realtorPhone || "305-283-0872"
        const when = start.toLocaleString("es-US", {
          timeZone: "America/New_York",
          weekday: "long", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit",
        })
        const whereLine = location ? `\n📍 ${location}` : virtualLink ? `\n🔗 ${virtualLink}` : ""

        const full = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { email: true, phone: true, doNotEmail: true, doNotText: true },
        }).catch(() => null)

        if (full?.email && !full.doNotEmail) {
          sendEmail({
            to: full.email,
            subject: `📅 Cita confirmada: ${title} — ${agentName}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#0a1628,#1a2f50);border-radius:14px 14px 0 0;padding:26px;text-align:center">
                <h2 style="color:white;margin:0">📅 ¡Tu cita está confirmada!</h2>
              </div>
              <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px;padding:24px">
                <p style="color:#374151">Hola ${c.firstName},</p>
                <p style="color:#374151">Tu cita con <strong>${agentName}</strong> quedó agendada:</p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:14px 0">
                  <p style="margin:0;color:#0e1f3d;font-weight:700">${title}</p>
                  <p style="margin:6px 0 0;color:#374151">🗓 ${when} (hora de Miami)</p>
                  ${location ? `<p style="margin:6px 0 0;color:#374151">📍 ${location}</p>` : ""}
                  ${virtualLink ? `<p style="margin:6px 0 0"><a href="${virtualLink}" style="color:#2563eb">🔗 Unirse a la reunión</a></p>` : ""}
                </div>
                <p style="color:#6b7280;font-size:13px">¿Necesitas cambiarla? Llámanos o escríbenos al <strong>${agentPhone}</strong>.</p>
                <p style="color:#374151">¡Nos vemos pronto! 🏡<br/>— ${agentName}</p>
              </div>
            </div>`,
          }).catch(() => {})
        }
        if (full?.phone && !full.doNotText) {
          sendSMS(full.phone, `📅 ¡Cita confirmada! ${title} — ${when} (hora de Miami).${whereLine}\n¿Cambios? Llámanos: ${agentPhone} — ${agentName}`).catch(() => {})
        }

        // Heads-up for the agent too
        prisma.aINotification.create({
          data: {
            type: "APPOINTMENT_SCHEDULED",
            title: `📅 Cita agendada con ${c.firstName} ${c.lastName || ""}`.trim(),
            body: `${title} — ${when} (hora de Miami). Ya está en tu calendario; el cliente fue notificado.`,
            priority: "HIGH",
            contactId,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json(appointment)
  } catch (e: any) {
    console.error("[appointments POST]", e)
    return NextResponse.json({ error: e?.message || "Failed to create appointment" }, { status: 500 })
  }
}
