import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildProjectContext, buildMarketInsightsContext, buildStrMarketContext } from "@/lib/preconstruction-context"
import Anthropic from "@anthropic-ai/sdk"
import { sendSMS } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { applyTagAndEnroll } from "@/lib/lead-ingest"
import { sendPortalInvites } from "@/lib/portal-invite"
import { pauseSofia, resumeSofia } from "@/lib/sofia-control"
import { pickTwoTimes, offerQuestion, recordOffer } from "@/lib/slot-offer"
import { PROJECTS, detectProject, projectUrl } from "@/lib/projects"
import { isWithinTextingWindow } from "@/lib/calling-hours"

const MODEL = "claude-sonnet-5"

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_contacts",
    description: "Search and filter contacts in the CRM. Use to find leads by name, status, source, or inactivity.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:         { type: "string",  description: "Name, email, or phone to search" },
        status:        { type: "string",  description: "Filter by status: NEW_LEAD, LEAD, PROSPECT, ACTIVE_BUYER, ACTIVE_SELLER, UNDER_CONTRACT, CLOSED, PAST_CLIENT, SPHERE" },
        source:        { type: "string",  description: "Filter by lead source" },
        noContactDays: { type: "number",  description: "Only contacts not reached in X days" },
        minLeadScore:  { type: "number",  description: "Minimum lead score" },
        limit:         { type: "number",  description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "get_contact_details",
    description: "Get full profile for a contact: bio, notes, recent messages (SMS/email/WhatsApp/AI), activities, tasks, appointments, property interests, and pipeline stage.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "Contact ID (use search_contacts first to find it)" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "get_contact_messages",
    description: "Get full message thread for a contact across all channels (SMS, email, WhatsApp, AI conversations).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        limit:     { type: "number", description: "Messages to return (default 30)" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "get_appointments",
    description: "Get upcoming or recent appointments and showings.",
    input_schema: {
      type: "object" as const,
      properties: {
        days:      { type: "number",  description: "Days ahead to look (default 7)" },
        pastDays:  { type: "number",  description: "Also include appointments from X days in the past" },
      },
    },
  },
  {
    name: "get_transaction_details",
    description: "Get transaction details including milestones, deadlines, and documents.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Address, title, or contact name to search" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_market_stats",
    description: "Get current Miami MLS market statistics: active listings, avg price, days on market, new listings.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "create_task",
    description: "Create a follow-up task for a contact.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string",  description: "Contact ID (optional)" },
        title:     { type: "string",  description: "Task title" },
        dueDate:   { type: "string",  description: "ISO date string (YYYY-MM-DD)" },
        priority:  { type: "string",  description: "LOW | MEDIUM | HIGH | URGENT" },
        type:      { type: "string",  description: "FOLLOW_UP | CALL | EMAIL | SHOWING | OTHER" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_note",
    description: "Add a note to a contact's profile.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        content:   { type: "string" },
      },
      required: ["contactId", "content"],
    },
  },
  {
    name: "update_contact_status",
    description: "Update a contact's status or lead score.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        status:    { type: "string", description: "NEW_LEAD | LEAD | PROSPECT | ACTIVE_BUYER | ACTIVE_SELLER | UNDER_CONTRACT | CLOSED | PAST_CLIENT | SPHERE | NURTURE | DEAD" },
        leadScore: { type: "number", description: "0-100" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "get_hot_leads",
    description: "List the leads to act on right now — highest lead score first, with phone numbers, so Catherine knows exactly who to call/text next.",
    input_schema: {
      type: "object" as const,
      properties: {
        minScore: { type: "number", description: "Minimum lead score (default 40)" },
        limit:    { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "get_my_tasks",
    description: "List Catherine's PENDING tasks due today and overdue, with the related contact — her to-do list for today.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "send_sms",
    description: "Send an SMS text to a contact NOW. Only call this when Catherine has clearly asked to send the message. Personalize it.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        message:   { type: "string", description: "The text message to send" },
      },
      required: ["contactId", "message"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a contact NOW. Only when Catherine has clearly asked to send. Body may include simple HTML.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        subject:   { type: "string" },
        body:      { type: "string", description: "Email body (HTML allowed)" },
      },
      required: ["contactId", "subject", "body"],
    },
  },
  {
    name: "enroll_in_smart_plan",
    description: "Enroll a contact into a Smart Plan (automated follow-up sequence) by plan name.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        planName:  { type: "string", description: "Plan name (partial match ok, e.g. 'Costa Rica')" },
      },
      required: ["contactId", "planName"],
    },
  },
  {
    name: "add_tag",
    description: "Add a tag to a contact (also auto-enrolls them in any Smart Plan triggered by that tag).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        tagName:   { type: "string" },
      },
      required: ["contactId", "tagName"],
    },
  },
  {
    name: "create_appointment",
    description: "Book an appointment/showing for a contact.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId:   { type: "string" },
        title:       { type: "string", description: "e.g. 'Showing – 123 Brickell Ave' or 'Buyer consultation'" },
        startTime:   { type: "string", description: "ISO datetime (e.g. 2026-08-15T15:00:00)" },
        durationMin: { type: "number", description: "Length in minutes (default 30)" },
        type:        { type: "string", description: "SHOWING | CONSULTATION | CALL | MEETING" },
        location:    { type: "string" },
      },
      required: ["title", "startTime"],
    },
  },
  {
    name: "sofia_pause",
    description: "Tell Sofía (the automatic follow-up assistant) to STOP all automatic contact with one person — texts, calls, drip emails, property alerts and Messenger/Instagram/SMS auto-replies — because Catherine is handling them personally. Catherine's own texts/emails/calls still work. Use for 'dile a Sofía que deje de llamar/escribirle a X'.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        reason:    { type: "string", description: "Short reason, e.g. 'Catherine lo atiende personalmente'" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "sofia_resume",
    description: "Let Sofía resume automatic follow-up with a person she was paused for (restarts the drips that the pause stopped).",
    input_schema: {
      type: "object" as const,
      properties: { contactId: { type: "string" } },
      required: ["contactId"],
    },
  },
  {
    name: "list_sofia_paused",
    description: "List the contacts Sofía is currently paused for.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "set_contact_preferences",
    description: "Set a person's permanent communication blocks — for when THEY asked not to be contacted a certain way. doNotText blocks every text (including Catherine's), doNotCall removes them from all calls, doNotEmail stops all marketing email. Only pass the fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId:  { type: "string" },
        doNotText:  { type: "boolean" },
        doNotCall:  { type: "boolean" },
        doNotEmail: { type: "boolean" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "sofia_offer_times",
    description: "Have Sofía text a person two real open times for a 15-minute call with Catherine (from Catherine's calendar). If they reply 1 or 2, the call books itself. Only when Catherine asks.",
    input_schema: {
      type: "object" as const,
      properties: { contactId: { type: "string" } },
      required: ["contactId"],
    },
  },
  {
    name: "sofia_send_project",
    description: `Have Sofía send a person the landing page of one of Catherine's projects (by text, or email if they have no usable phone). Projects: ${PROJECTS.map(p => p.name).join(", ")}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string" },
        project:   { type: "string", description: "Project name, e.g. 'House of Wellness' or 'Parkside'" },
      },
      required: ["contactId", "project"],
    },
  },
  {
    name: "send_portal_invites",
    description: "Send bulk CLIENT PORTAL invitations (a personalized one-click magic-link email) to contacts. Provide explicit contactIds OR a filter to select them (status/tag/source/minLeadScore). Contacts with no email or opted out are skipped automatically. Always confirm with Catherine before sending to a large group.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactIds:   { type: "array", items: { type: "string" }, description: "Explicit contact IDs to invite" },
        status:       { type: "string", description: "Filter: only contacts with this status (e.g. ACTIVE_BUYER, UNDER_CONTRACT, CLOSED)" },
        tag:          { type: "string", description: "Filter: only contacts with this tag name" },
        source:       { type: "string", description: "Filter: only contacts from this lead source" },
        minLeadScore: { type: "number", description: "Filter: only contacts at/above this score" },
      },
    },
  },
]

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>, ctx: { userId?: string }): Promise<string> {
  try {
    switch (name) {

      case "search_contacts": {
        const where: Record<string, unknown> = { isArchived: false }
        if (input.status) where.status = input.status
        if (input.source) where.source = { contains: input.source as string, mode: "insensitive" }
        if (input.minLeadScore) where.leadScore = { gte: input.minLeadScore }
        if (input.noContactDays) {
          const cutoff = new Date(Date.now() - (input.noContactDays as number) * 864e5)
          where.OR = [{ lastContacted: { lt: cutoff } }, { lastContacted: null }]
        }
        if (input.query) {
          const q = input.query as string
          where.OR = [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName:  { contains: q, mode: "insensitive" } },
            { email:     { contains: q, mode: "insensitive" } },
            { phone:     { contains: q } },
          ]
        }
        const contacts = await prisma.contact.findMany({
          where,
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true,
            status: true, leadScore: true, source: true, lastContacted: true,
            createdAt: true, buyerBudgetMin: true, buyerBudgetMax: true,
            buyerLocation: true, buyerPropertyType: true,
          },
          orderBy: { leadScore: "desc" },
          take: (input.limit as number) || 10,
        })
        return JSON.stringify(contacts)
      }

      case "get_contact_details": {
        const contact = await prisma.contact.findUnique({
          where: { id: input.contactId as string },
          include: {
            notes:       { orderBy: { createdAt: "desc" }, take: 10 },
            activities:  { orderBy: { createdAt: "desc" }, take: 15 },
            tasks:       { where: { status: "PENDING" }, orderBy: { dueDate: "asc" }, take: 10 },
            appointments: { orderBy: { startTime: "desc" }, take: 5 },
            transactions: { include: { milestones: true }, take: 3 },
            pipelineLeads: { include: { stage: { include: { pipeline: true } } } },
            propertyInterests: {
              include: { property: { select: { address: true, city: true, price: true, bedrooms: true, bathrooms: true, status: true } } },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            propertySaves: {
              include: { property: { select: { address: true, city: true, price: true, bedrooms: true } } },
              take: 5,
            },
            enrollments: { include: { plan: { select: { name: true } } } },
            aiConversations: {
              include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
              orderBy: { updatedAt: "desc" },
              take: 2,
            },
          },
        })
        if (!contact) return JSON.stringify({ error: "Contact not found" })
        return JSON.stringify(contact)
      }

      case "get_contact_messages": {
        const id = input.contactId as string
        const limit = (input.limit as number) || 30

        const [sms, emails, whatsapp, aiMsgs] = await Promise.all([
          prisma.sMSMessage.findMany({
            where: { contactId: id },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.email.findMany({
            where: { contactId: id },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.whatsAppMessage.findMany({
            where: { contactId: id },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.aIMessage.findMany({
            where: { conversation: { contactId: id } },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
        ])

        return JSON.stringify({ sms, emails, whatsapp, aiMessages: aiMsgs })
      }

      case "get_appointments": {
        const now = new Date()
        const ahead = new Date(now.getTime() + ((input.days as number) || 7) * 864e5)
        const pastFrom = input.pastDays
          ? new Date(now.getTime() - (input.pastDays as number) * 864e5)
          : now
        const appts = await prisma.appointment.findMany({
          where: { startTime: { gte: pastFrom, lte: ahead } },
          include: { contact: { select: { firstName: true, lastName: true, phone: true } } },
          orderBy: { startTime: "asc" },
          take: 20,
        })
        return JSON.stringify(appts)
      }

      case "get_transaction_details": {
        const q = input.query as string
        const txns = await prisma.transaction.findMany({
          where: {
            OR: [
              { address: { contains: q, mode: "insensitive" } },
              { title:   { contains: q, mode: "insensitive" } },
              { contact: { firstName: { contains: q, mode: "insensitive" } } },
              { contact: { lastName:  { contains: q, mode: "insensitive" } } },
            ],
          },
          include: {
            milestones: { orderBy: { order: "asc" } },
            documents:  true,
            contact:    { select: { firstName: true, lastName: true, phone: true, email: true } },
          },
          take: 5,
        })
        return JSON.stringify(txns)
      }

      case "get_market_stats": {
        const [activeCount, avgData, newThisMonth] = await Promise.all([
          prisma.property.count({ where: { status: "ACTIVE" } }),
          prisma.property.aggregate({
            where: { status: "ACTIVE" },
            _avg: { price: true, daysOnMarket: true },
            _min: { price: true },
            _max: { price: true },
          }),
          prisma.property.count({
            where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
          }),
        ])
        return JSON.stringify({
          activeListings: activeCount,
          avgPrice: avgData._avg.price,
          avgDaysOnMarket: avgData._avg.daysOnMarket,
          priceRange: { min: avgData._min.price, max: avgData._max.price },
          newListings30d: newThisMonth,
        })
      }

      case "create_task": {
        const task = await prisma.task.create({
          data: {
            title:     input.title as string,
            contactId: (input.contactId as string) || undefined,
            dueDate:   input.dueDate ? new Date(input.dueDate as string) : undefined,
            priority:  (input.priority as string) || "MEDIUM",
            type:      (input.type as string) || "FOLLOW_UP",
            status:    "PENDING",
          },
        })
        return JSON.stringify({ success: true, taskId: task.id, title: task.title })
      }

      case "add_note": {
        const note = await prisma.note.create({
          data: {
            contactId: input.contactId as string,
            content:   input.content as string,
          },
        })
        return JSON.stringify({ success: true, noteId: note.id })
      }

      case "update_contact_status": {
        const data: Record<string, unknown> = {}
        if (input.status)    data.status    = input.status
        if (input.leadScore !== undefined) data.leadScore = input.leadScore
        const contact = await prisma.contact.update({
          where: { id: input.contactId as string },
          data,
          select: { id: true, firstName: true, lastName: true, status: true, leadScore: true },
        })
        return JSON.stringify({ success: true, contact })
      }

      case "get_hot_leads": {
        const leads = await prisma.contact.findMany({
          where: {
            isArchived: false,
            leadScore: { gte: (input.minScore as number) ?? 40 },
            status: { notIn: ["CLOSED", "PAST_CLIENT", "DEAD"] },
          },
          select: {
            id: true, firstName: true, lastName: true, phone: true, email: true,
            status: true, leadScore: true, lastContacted: true, buyerLocation: true,
            buyerBudgetMin: true, buyerBudgetMax: true,
          },
          orderBy: [{ leadScore: "desc" }, { lastContacted: "asc" }],
          take: (input.limit as number) || 10,
        })
        return JSON.stringify(leads)
      }

      case "get_my_tasks": {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today.getTime() + 864e5)
        const [dueToday, overdue] = await Promise.all([
          prisma.task.findMany({
            where: { status: "PENDING", dueDate: { gte: today, lt: tomorrow } },
            include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            orderBy: { priority: "desc" }, take: 25,
          }),
          prisma.task.findMany({
            where: { status: "PENDING", dueDate: { lt: today } },
            include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            orderBy: { dueDate: "asc" }, take: 25,
          }),
        ])
        return JSON.stringify({ dueToday, overdue })
      }

      case "send_sms": {
        const c = await prisma.contact.findUnique({ where: { id: input.contactId as string }, select: { phone: true, firstName: true } })
        if (!c?.phone) return JSON.stringify({ error: "Contact has no phone number" })
        await sendSMS(c.phone, input.message as string, undefined, { contactId: input.contactId as string })
        await prisma.activity.create({ data: { type: "SMS", title: "SMS enviado por Aria", description: (input.message as string).slice(0, 200), contactId: input.contactId as string, userId: ctx.userId } }).catch(() => {})
        return JSON.stringify({ success: true, sentTo: c.firstName })
      }

      case "send_email": {
        const c = await prisma.contact.findUnique({ where: { id: input.contactId as string }, select: { email: true, firstName: true } })
        if (!c?.email) return JSON.stringify({ error: "Contact has no email" })
        const ok = await sendEmail({ to: c.email, subject: input.subject as string, html: input.body as string, transactional: true })
        await prisma.activity.create({ data: { type: "EMAIL", title: `Email enviado por Aria: ${input.subject}`, description: (input.body as string).slice(0, 200), contactId: input.contactId as string, userId: ctx.userId } }).catch(() => {})
        return JSON.stringify({ success: ok, sentTo: c.firstName })
      }

      case "enroll_in_smart_plan": {
        const plan = await prisma.smartPlan.findFirst({
          where: { name: { contains: input.planName as string, mode: "insensitive" }, isActive: true },
          include: { steps: { where: { order: 0 }, take: 1 } },
        })
        if (!plan) return JSON.stringify({ error: `No active Smart Plan matching "${input.planName}"` })
        const already = await prisma.smartPlanEnrollment.findFirst({ where: { contactId: input.contactId as string, planId: plan.id, status: "ACTIVE" } })
        if (already) return JSON.stringify({ success: true, note: "Already enrolled", plan: plan.name })
        const delay = plan.steps[0]?.delay ?? 0
        await prisma.smartPlanEnrollment.create({ data: { contactId: input.contactId as string, planId: plan.id, status: "ACTIVE", currentStep: 0, nextStepAt: new Date(Date.now() + delay * 864e5) } })
        return JSON.stringify({ success: true, plan: plan.name })
      }

      case "add_tag": {
        await applyTagAndEnroll(input.contactId as string, input.tagName as string)
        return JSON.stringify({ success: true, tag: input.tagName })
      }

      case "create_appointment": {
        const start = new Date(input.startTime as string)
        if (isNaN(start.getTime())) return JSON.stringify({ error: "Invalid startTime" })
        const end = new Date(start.getTime() + ((input.durationMin as number) || 30) * 60000)
        const appt = await prisma.appointment.create({
          data: {
            title: input.title as string,
            startTime: start, endTime: end,
            type: (input.type as string) || "SHOWING",
            location: (input.location as string) || undefined,
            contactId: (input.contactId as string) || undefined,
            userId: ctx.userId,
          },
        })
        return JSON.stringify({ success: true, appointmentId: appt.id, startTime: appt.startTime })
      }

      case "send_portal_invites": {
        let ids = Array.isArray(input.contactIds) ? (input.contactIds as string[]) : []
        if (!ids.length) {
          const where: Record<string, unknown> = { isArchived: false, email: { not: null }, doNotEmail: false }
          if (input.status) where.status = input.status
          if (input.source) where.source = { contains: input.source as string, mode: "insensitive" }
          if (input.minLeadScore) where.leadScore = { gte: input.minLeadScore }
          if (input.tag) {
            const t = await prisma.tag.findFirst({ where: { name: { equals: input.tag as string, mode: "insensitive" } }, select: { id: true } })
            if (!t) return JSON.stringify({ error: `No tag named "${input.tag}"` })
            where.tags = { some: { tagId: t.id } }
          }
          const rows = await prisma.contact.findMany({ where, select: { id: true }, take: 2000 })
          ids = rows.map(r => r.id)
        }
        if (!ids.length) return JSON.stringify({ error: "No matching contacts with a usable email" })
        const result = await sendPortalInvites(ids, ctx.userId)
        return JSON.stringify({ success: true, ...result })
      }

      case "sofia_pause": {
        const r = await pauseSofia(input.contactId as string, "Aria", (input.reason as string) || undefined)
        return JSON.stringify({ success: true, ...r, note: "Sofía no le enviará nada automático. Catherine puede seguir escribiéndole y llamándole." })
      }

      case "sofia_resume": {
        const r = await resumeSofia(input.contactId as string, "Aria")
        return JSON.stringify({ success: true, ...r })
      }

      case "list_sofia_paused": {
        const rows = await prisma.contact.findMany({
          where: { sofiaPausedAt: { not: null } },
          orderBy: { sofiaPausedAt: "desc" },
          take: 100,
          select: { id: true, firstName: true, lastName: true, phone: true, sofiaPausedAt: true },
        })
        return JSON.stringify({ count: rows.length, contacts: rows })
      }

      case "set_contact_preferences": {
        const data: Record<string, boolean> = {}
        for (const k of ["doNotText", "doNotCall", "doNotEmail"] as const) {
          if (typeof input[k] === "boolean") data[k] = input[k] as boolean
        }
        if (!Object.keys(data).length) return JSON.stringify({ error: "Nothing to change" })
        await prisma.contact.update({ where: { id: input.contactId as string }, data })
        if (data.doNotCall) {
          await prisma.scheduledCall.updateMany({ where: { contactId: input.contactId as string, status: "PENDING" }, data: { status: "CANCELLED" } })
        }
        await prisma.activity.create({
          data: { type: "NOTE", title: "Preferencias de contacto actualizadas por Aria", description: JSON.stringify(data), contactId: input.contactId as string, userId: ctx.userId },
        }).catch(() => {})
        return JSON.stringify({ success: true, ...data })
      }

      case "sofia_offer_times": {
        const c = await prisma.contact.findUnique({
          where: { id: input.contactId as string },
          select: { id: true, firstName: true, phone: true, doNotText: true, sofiaPausedAt: true },
        })
        if (!c) return JSON.stringify({ error: "Contact not found" })
        if (c.sofiaPausedAt) return JSON.stringify({ error: "Sofía está en pausa para este contacto — reactívala primero o escríbele tú." })
        if (!c.phone || c.doNotText) return JSON.stringify({ error: "No se le puede enviar texto (sin teléfono o Do Not Text)." })
        if (!isWithinTextingWindow(c.phone)) return JSON.stringify({ error: "Fuera de horario para textos (9am–8pm de su zona). Pídeselo a Sofía de nuevo en horario de día." })
        const slots = await pickTwoTimes()
        const question = offerQuestion(slots)
        if (!question) return JSON.stringify({ error: "No hay horarios libres en los próximos 7 días en el calendario de Catherine." })
        const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, calendlyUrl: true } }).catch(() => null)
        const agent = (cfg?.realtorName || "Catherine").split(" ")[0]
        const book = cfg?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book`
        const msg = `Hola ${c.firstName}, soy Sofia del equipo de ${agent} Gomez. ${agent} quiere hablar contigo 15 minutos. ${question} O elige otra hora: ${book}`
        const sid = await sendSMS(c.phone, msg, undefined, { contactId: c.id })
        if (!sid) return JSON.stringify({ error: "El texto no salió (revisa el número o el límite de textos)." })
        await recordOffer(c.id, slots)
        return JSON.stringify({ success: true, offered: slots.map(x => x.label), message: msg })
      }

      case "sofia_send_project": {
        const p = detectProject(input.project as string) || PROJECTS.find(x => x.name.toLowerCase().includes(String(input.project).toLowerCase()))
        if (!p) return JSON.stringify({ error: `No conozco ese proyecto. Proyectos: ${PROJECTS.map(x => x.name).join(", ")}` })
        const c = await prisma.contact.findUnique({
          where: { id: input.contactId as string },
          select: { id: true, firstName: true, phone: true, email: true, doNotText: true, doNotEmail: true, sofiaPausedAt: true },
        })
        if (!c) return JSON.stringify({ error: "Contact not found" })
        if (c.sofiaPausedAt) return JSON.stringify({ error: "Sofía está en pausa para este contacto — reactívala primero o envíaselo tú con send_sms." })
        const url = projectUrl(p)
        if (c.phone && !c.doNotText && isWithinTextingWindow(c.phone)) {
          const sid = await sendSMS(c.phone, `Hola ${c.firstName}, soy Sofia del equipo de Catherine Gomez. Aqui tienes toda la informacion de ${p.name}: precios, fotos y plan de pagos: ${url}`, undefined, { contactId: c.id })
          if (sid) {
            await prisma.activity.create({ data: { type: "SMS", title: `Sofía le envió ${p.name} (pedido por Aria)`, description: url, contactId: c.id, userId: ctx.userId } }).catch(() => {})
            return JSON.stringify({ success: true, channel: "SMS", project: p.name, url })
          }
        }
        if (c.email && !c.doNotEmail) {
          const ok = await sendEmail({
            to: c.email,
            subject: `${p.name} — toda la información`,
            html: wrapEmail(`<p>Hola ${c.firstName},</p><p>Aquí tienes toda la información de <strong>${p.name}</strong> (${p.place}): ${p.highlight}. ${p.summary}</p><p><a href="${url}" style="display:inline-block;background:#0e1f3d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Ver ${p.name} →</a></p>`, { agentName: "Catherine Gomez" }),
          })
          if (ok) {
            await prisma.activity.create({ data: { type: "EMAIL", title: `Sofía le envió ${p.name} por email (pedido por Aria)`, description: url, contactId: c.id, userId: ctx.userId } }).catch(() => {})
            return JSON.stringify({ success: true, channel: "EMAIL", project: p.name, url })
          }
        }
        return JSON.stringify({ error: "No se pudo enviar (sin teléfono/email utilizable, o fuera de horario para textos)." })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: unknown) {
    return JSON.stringify({ error: String(err) })
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { messages } = await req.json()

  // Build live summary for system context
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 864e5)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 864e5)

  const [contactStats, newLeads, coldLeads, tasksDueToday, tasksOverdue, activeTransactions, upcomingAppts, totalContacts] =
    await Promise.all([
      prisma.contact.groupBy({ by: ["status"], _count: true, where: { isArchived: false } }),
      prisma.contact.count({ where: { createdAt: { gte: sevenDaysAgo }, isArchived: false } }),
      prisma.contact.count({
        where: {
          isArchived: false,
          status: { in: ["NEW_LEAD", "LEAD", "PROSPECT", "ACTIVE_BUYER", "ACTIVE_SELLER"] },
          OR: [{ lastContacted: { lt: sevenDaysAgo } }, { lastContacted: null }],
        },
      }),
      prisma.task.count({ where: { status: "PENDING", dueDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { status: "PENDING", dueDate: { lt: today } } }),
      prisma.transaction.count({ where: { status: { in: ["ACTIVE_LISTING", "UNDER_CONTRACT", "IN_ESCROW"] } } }),
      prisma.appointment.count({ where: { startTime: { gte: now, lte: new Date(now.getTime() + 2 * 864e5) } } }),
      prisma.contact.count({ where: { isArchived: false } }),
    ])

  // Catherine's own pre-construction inventory and market notes. Aria is the
  // assistant she asks "what do I pitch this lead?", so she needs the same
  // authoritative project detail the Investment Advisor has — otherwise Aria
  // answers from the model's general knowledge of Miami, not from the deck.
  const [projectLines, marketInsights] = await Promise.all([
    buildProjectContext(),
    buildMarketInsightsContext(),
  ])
  // projectLines is never empty now: an empty portfolio returns an explicit notice.
  const inventoryBlock = projectLines.length > 0 || marketInsights
    ? `\n\n━━━ CARTERA Y MERCADO DE CATHERINE ━━━\n${buildStrMarketContext()}${marketInsights || ""}${projectLines.join("\n")}\n\nCuando Catherine pregunte qué ofrecerle a un lead, parte SIEMPRE de esta cartera antes de sugerir cualquier otra cosa, y cita precios, planes de pago y fechas exactamente como están aquí.`
    : ""

  const systemPrompt = `You are Aria, a world-class AI CRM assistant for Catherine Gomez — a Miami real estate agent and educator who helps Latino families buy smart in Florida. You are the top 0.1% real estate CRM assistant. You think like a seasoned real estate coach, a sharp sales manager, and a trusted advisor all in one.

Today: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

━━━ LIVE CRM SNAPSHOT ━━━
Total contacts: ${totalContacts}
Pipeline: ${contactStats.map(s => `${s.status} (${s._count})`).join(" · ")}
New leads this week: ${newLeads}
Cold leads (7+ days no contact): ${coldLeads}
Tasks due today: ${tasksDueToday} | Overdue: ${tasksOverdue}
Active transactions: ${activeTransactions}
Appointments in next 48h: ${upcomingAppts}

━━━ YOUR CAPABILITIES ━━━
READ: search_contacts · get_contact_details · get_contact_messages · get_appointments · get_transaction_details · get_market_stats · get_hot_leads (who to call now) · get_my_tasks (today + overdue)
ACT: create_task · add_note · update_contact_status · send_sms · send_email · enroll_in_smart_plan · add_tag · create_appointment · send_portal_invites (bulk client-portal invitations by list or filter)

━━━ HOW YOU OPERATE ━━━
1. ALWAYS use tools before making claims about specific leads or data. Never guess.
2. When asked about a lead, get their full details AND messages — context is everything.
3. Prioritize by revenue impact: closing soon > high score > new & hot > going cold.
4. Be specific: names, phone numbers, dollar amounts, dates. Not generalities.
5. Proactively spot risks and offer the next action — then, if Catherine says yes, DO it with your action tools.
6. You can actually send texts/emails, send bulk client-portal invites, enroll leads in Smart Plans, tag, and book appointments. When you DRAFT a message, show it and ask "¿Lo envío?" before calling send_sms/send_email — never send outbound messages without a clear go-ahead. For send_portal_invites, first tell Catherine HOW MANY contacts match and confirm before sending. Non-message actions (create_task, add_note, add_tag, create_appointment, enroll) you may do when asked.
7. Think in pipelines: every lead should have a clear next action.

━━━ REAL ESTATE EXPERTISE ━━━
Miami market dynamics, contract timelines (inspection 10 days, financing 21 days, closing 30-45 days), pre-approval vs pre-qualification, HOA due diligence, condo rules, title/escrow process, commission structures, listing strategies, CMAs, buyer consultation, seller net sheets, 1031 exchanges, investment properties, pre-construction deposits, short sale timelines, foreclosure processes.

Follow-up cadence: New lead → contact within 5 min. Day 1, 3, 7, 14, 30 for nurture. Hot lead → daily touch. Going cold → reactivation sequence.

Lead temperature: 🔴 Hot (engaged last 48h, high score, active search) · 🟡 Warm (engaged last week) · ⚪ Cold (7+ days silent) · 🧊 Frozen (30+ days, needs reactivation).

About Sofía: Sofía is the automatic follow-up assistant that texts, calls, emails and answers DMs to leads on her own. You can give her instructions: when Catherine says "dile a Sofía que deje de llamar/escribirle a X" or "yo me encargo de X", find the contact and use sofia_pause (Catherine can still contact them). "Sofía puede volver con X" → sofia_resume. If the PERSON asked not to be texted/called/emailed, use set_contact_preferences instead (a permanent block). "Que Sofía le ofrezca horarios a X" → sofia_offer_times; "que Sofía le mande el link de <proyecto> a X" → sofia_send_project. Always search_contacts first and confirm which person when the name matches more than one.

Respond in English or Spanish based on what the user writes. Be direct, sharp, and specific. Use bullet points for lists. Bold key names and numbers. When you recommend an action, offer to execute it with your tools.${inventoryBlock}`

  // Multi-turn tool use loop
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  const userId = session.user?.id as string | undefined
  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: TOOLS,
    messages: claudeMessages,
  })

  // Execute tool calls until Claude gives a final response (bounded).
  let guard = 0
  while (response.stop_reason === "tool_use" && guard++ < 12) {
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[]

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async block => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input as Record<string, unknown>, { userId }),
      }))
    )

    claudeMessages.push({ role: "assistant", content: response.content })
    claudeMessages.push({ role: "user", content: toolResults })

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages: claudeMessages,
    })
  }

  const text = response.content.find(b => b.type === "text")
  return NextResponse.json({ content: text?.type === "text" ? text.text : "" })
}
