export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSMS, sendWhatsApp } from "@/lib/sms"

// GET /api/cron/smart-plans
// Called by Railway cron every hour.
// Fires due smart plan steps: email, SMS, or task creation.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()

  const dueEnrollments = await prisma.smartPlanEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextStepAt: { lte: now },
    },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          doNotEmail: true,
          doNotCall: true,
          doNotText: true,
        },
      },
      plan: {
        include: {
          steps: { where: { isActive: true }, orderBy: { order: "asc" } },
        },
      },
    },
    take: 50,
  })

  const aiConfig = await prisma.aIConfig.findFirst()
  const calendlyUrl = aiConfig?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL}/book`

  const results: { enrollmentId: string; contactId: string; status: string; step?: number }[] = []

  for (const enrollment of dueEnrollments) {
    const { contact, plan } = enrollment
    const steps = plan.steps
    const stepIndex = enrollment.currentStep

    if (stepIndex >= steps.length) {
      await prisma.smartPlanEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: now },
      })
      results.push({ enrollmentId: enrollment.id, contactId: contact.id, status: "completed" })
      continue
    }

    const step = steps[stepIndex]

    const fill = (text: string) =>
      text
        .replace(/\{first_name\}/gi, contact.firstName)
        .replace(/\{last_name\}/gi, contact.lastName || "")
        .replace(/\{calendly_url\}/gi, calendlyUrl)
        .replace(/\{agent_name\}/gi, aiConfig?.realtorName || "Catherine")
        .replace(/\{agent_phone\}/gi, aiConfig?.realtorPhone || "305-283-0872")

    try {
      if (step.type === "EMAIL" && step.subject && step.content) {
        if (!contact.doNotEmail && contact.email) {
          await sendEmail({
            to: contact.email,
            subject: fill(step.subject),
            html: fill(step.content),
          })
          await prisma.email.create({
            data: {
              subject: fill(step.subject),
              body: fill(step.content),
              fromAddress: process.env.RESEND_FROM || "sofia@casaicrm.com",
              toAddress: contact.email,
              status: "SENT",
              sentAt: now,
              contactId: contact.id,
            },
          })
          await prisma.activity.create({
            data: {
              type: "EMAIL_SENT",
              title: `Smart Plan: ${fill(step.subject)}`,
              contactId: contact.id,
            },
          })
        }
      } else if (step.type === "SMS" && step.content) {
        // doNotText (not doNotCall) is the correct gate for text messages
        if (!contact.doNotText && contact.phone) {
          const toPhone = contact.phone.startsWith("+")
            ? contact.phone
            : `+1${contact.phone.replace(/\D/g, "").slice(-10)}`
          await sendSMS(toPhone, fill(step.content))
          await prisma.sMSMessage.create({
            data: {
              body: fill(step.content),
              fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
              toNumber: toPhone,
              direction: "OUTBOUND",
              status: "SENT",
              contactId: contact.id,
            },
          })
          await prisma.activity.create({
            data: {
              type: "SMS",
              title: `Smart Plan SMS`,
              description: fill(step.content).slice(0, 120),
              contactId: contact.id,
            },
          })
        }
      } else if (step.type === "WHATSAPP" && step.content) {
        if (!contact.doNotText && contact.phone) {
          const toPhone = contact.phone.startsWith("+")
            ? contact.phone
            : `+1${contact.phone.replace(/\D/g, "").slice(-10)}`
          const filledContent = fill(step.content)

          // Only use free-form WhatsApp if contact sent an inbound message in the last 24h
          // (open session window). Otherwise go straight to SMS to avoid error 63016.
          const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const recentInbound = await prisma.whatsAppMessage.findFirst({
            where: {
              contactId: contact.id,
              direction: "INBOUND",
              createdAt: { gte: windowStart },
            },
          })

          let channel: "WHATSAPP" | "SMS" = "SMS"
          if (recentInbound) {
            try {
              await sendWhatsApp(toPhone, filledContent)
              channel = "WHATSAPP"
            } catch (waErr: any) {
              console.warn("[smart-plans] WhatsApp failed despite open session, falling back to SMS:", waErr?.message)
              await sendSMS(toPhone, filledContent).catch(e => console.error("[smart-plans] SMS also failed:", e))
            }
          } else {
            await sendSMS(toPhone, filledContent).catch(e => console.error("[smart-plans] SMS failed:", e))
          }

          await prisma.activity.create({
            data: {
              type: channel,
              title: channel === "WHATSAPP" ? "Smart Plan WhatsApp" : "Smart Plan SMS (no open WA session)",
              description: filledContent.slice(0, 120),
              contactId: contact.id,
            },
          })
        }
      } else if (step.type === "TASK" && step.taskTitle) {
        const user = await prisma.user.findFirst({ select: { id: true } })
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 1)
        await prisma.task.create({
          data: {
            title: fill(step.taskTitle),
            description: step.content ? fill(step.content) : undefined,
            type: (step.taskType as any) || "FOLLOW_UP",
            priority: "MEDIUM",
            status: "PENDING",
            contactId: contact.id,
            assignedToId: user?.id,
            dueDate,
          },
        })
        await prisma.activity.create({
          data: {
            type: "AI_TRIGGERED",
            title: `Smart Plan: tarea creada`,
            description: fill(step.taskTitle),
            contactId: contact.id,
          },
        })
      }

      // Advance to next step
      const nextIndex = stepIndex + 1
      const nextStep = steps[nextIndex]
      const isLast = nextIndex >= steps.length

      const nextStepAt = isLast
        ? null
        : (() => {
            const d = new Date()
            d.setDate(d.getDate() + (nextStep.delay || 1))
            return d
          })()

      await prisma.smartPlanEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: nextIndex,
          nextStepAt,
          status: isLast ? "COMPLETED" : "ACTIVE",
          completedAt: isLast ? now : undefined,
        },
      })

      results.push({
        enrollmentId: enrollment.id,
        contactId: contact.id,
        status: isLast ? "completed" : "advanced",
        step: stepIndex,
      })
    } catch (e) {
      console.error(`[SmartPlan] Error on enrollment ${enrollment.id} step ${stepIndex}:`, e)
      results.push({ enrollmentId: enrollment.id, contactId: contact.id, status: "error" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
