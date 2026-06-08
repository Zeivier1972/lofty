export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// Runs daily — sends birthday and home anniversary emails
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  const aiConfig = await prisma.aIConfig.findFirst()
  const agentName = aiConfig?.realtorName || "Catherine"

  const contacts = await prisma.contact.findMany({
    where: { isArchived: false, doNotEmail: false, email: { not: null } },
    select: { id: true, firstName: true, lastName: true, email: true, birthday: true, homeClosedAt: true },
  })

  let birthdaysSent = 0
  let anniversariesSent = 0

  for (const c of contacts) {
    // Birthday check
    if (c.birthday) {
      const bMonth = c.birthday.getMonth() + 1
      const bDay = c.birthday.getDate()
      if (bMonth === month && bDay === day) {
        await sendEmail({
          to: c.email!,
          subject: `🎂 ¡Feliz Cumpleaños, ${c.firstName}!`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#0e8fe9">¡Feliz Cumpleaños, ${c.firstName}! 🎉</h2>
              <p>Hoy es un día especial y quería tomarte un momento para desearte un maravilloso cumpleaños.</p>
              <p>Ha sido un placer trabajar contigo y espero que este nuevo año esté lleno de alegría y nuevas oportunidades.</p>
              <p>Si en algún momento necesitas ayuda con bienes raíces — ya sea comprar, vender o simplemente preguntar — aquí estaré para ti.</p>
              <br/>
              <p>Con cariño,<br/><strong>${agentName}</strong></p>
            </div>
          `,
        })
        await prisma.activity.create({
          data: { type: "EMAIL", title: "Email de Cumpleaños", description: "Email de cumpleaños automático", contactId: c.id },
        })
        birthdaysSent++
      }
    }

    // Home anniversary check
    if (c.homeClosedAt) {
      const aMonth = c.homeClosedAt.getMonth() + 1
      const aDay = c.homeClosedAt.getDate()
      const years = today.getFullYear() - c.homeClosedAt.getFullYear()
      if (aMonth === month && aDay === day && years > 0) {
        await sendEmail({
          to: c.email!,
          subject: `🏠 ¡${years} año${years > 1 ? "s" : ""} en tu hogar, ${c.firstName}!`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#0e8fe9">¡Feliz Aniversario de Hogar, ${c.firstName}! 🏡</h2>
              <p>¡No puedo creer que ya hace ${years} año${years > 1 ? "s" : ""} que te mudaste a tu hogar!</p>
              <p>Es un momento especial para reflexionar sobre el camino recorrido. Los mercados inmobiliarios cambian constantemente — si alguna vez quieres saber cuánto vale tu propiedad hoy, con gusto te preparo un análisis gratuito.</p>
              <p>¡Gracias por confiar en mí y que disfrutes muchos años más en tu hogar!</p>
              <br/>
              <p>Con afecto,<br/><strong>${agentName}</strong></p>
            </div>
          `,
        })
        await prisma.activity.create({
          data: { type: "EMAIL", title: "Aniversario de Hogar", description: `${years} año(s) en su hogar`, contactId: c.id },
        })
        anniversariesSent++
      }
    }
  }

  return NextResponse.json({ birthdaysSent, anniversariesSent })
}
