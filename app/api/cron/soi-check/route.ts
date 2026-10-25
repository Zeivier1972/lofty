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

  // Only people who HAVE one of the two dates. The query used to pull every
  // contact in the book to check two fields on each, which is the whole table
  // in memory for the handful whose birthday is actually today.
  const contacts = await prisma.contact.findMany({
    where: {
      isArchived: false,
      doNotEmail: false,
      email: { not: null },
      OR: [{ birthday: { not: null } }, { homeClosedAt: { not: null } }],
    },
    select: { id: true, firstName: true, lastName: true, email: true, birthday: true, homeClosedAt: true },
  })

  // Was this exact greeting already sent today?
  //
  // Nothing stopped a second send. The job is scheduled daily, but `curl -sf
  // ... || true` retries nothing while Railway restarting the service mid-run,
  // or anyone hitting the route by hand, re-sends to everyone it already
  // reached — and a duplicate "Feliz Cumpleaños" is the kind of thing a client
  // notices. The Activity row each send writes is the only record there is, so
  // it is also the guard: it carries the date, so the check is cheap and the
  // marker cannot collide with last year's.
  const stamp = `${today.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const alreadySent = async (contactId: string, kind: "bday" | "anniv") => {
    const found = await prisma.activity.findFirst({
      where: { contactId, type: "EMAIL", description: { contains: `soi:${kind}:${stamp}` } },
      select: { id: true },
    })
    return !!found
  }

  let birthdaysSent = 0
  let anniversariesSent = 0

  for (const c of contacts) {
    // Birthday check
    if (c.birthday) {
      const bMonth = c.birthday.getMonth() + 1
      const bDay = c.birthday.getDate()
      if (bMonth === month && bDay === day && !(await alreadySent(c.id, "bday"))) {
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
          data: { type: "EMAIL", title: "Email de Cumpleaños", description: `Email de cumpleaños automático · soi:bday:${stamp}`, contactId: c.id },
        })
        birthdaysSent++
      }
    }

    // Home anniversary check
    if (c.homeClosedAt) {
      const aMonth = c.homeClosedAt.getMonth() + 1
      const aDay = c.homeClosedAt.getDate()
      const years = today.getFullYear() - c.homeClosedAt.getFullYear()
      if (aMonth === month && aDay === day && years > 0 && !(await alreadySent(c.id, "anniv"))) {
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
          data: { type: "EMAIL", title: "Aniversario de Hogar", description: `${years} año(s) en su hogar · soi:anniv:${stamp}`, contactId: c.id },
        })
        anniversariesSent++
      }
    }
  }

  return NextResponse.json({ date: stamp, scanned: contacts.length, birthdaysSent, anniversariesSent })
}
