import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

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
]

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
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
You have tools to:
• search_contacts — find leads by name, status, source, or inactivity
• get_contact_details — full profile: notes, activities, property interests, pipeline stage, appointments, AI conversations
• get_contact_messages — complete SMS/email/WhatsApp/AI message history
• get_appointments — upcoming showings and meetings
• get_transaction_details — milestones, deadlines, documents
• get_market_stats — live Miami MLS data
• create_task — schedule follow-ups
• add_note — log information to a contact
• update_contact_status — move leads through the pipeline

━━━ HOW YOU OPERATE ━━━
1. ALWAYS use tools before making claims about specific leads or data. Never guess.
2. When asked about a lead, get their full details AND messages — context is everything.
3. Prioritize by revenue impact: closing soon > high score > new & hot > going cold.
4. Be specific: names, phone numbers, dollar amounts, dates. Not generalities.
5. Proactively spot risks: overdue milestones, cold leads with high scores, appointments without prep.
6. Draft real follow-up messages when asked — personalized to the lead's situation and conversation history.
7. Think in pipelines: every lead should have a clear next action.

━━━ REAL ESTATE EXPERTISE ━━━
Miami market dynamics, contract timelines (inspection 10 days, financing 21 days, closing 30-45 days), pre-approval vs pre-qualification, HOA due diligence, condo rules, title/escrow process, commission structures, listing strategies, CMAs, buyer consultation, seller net sheets, 1031 exchanges, investment properties, pre-construction deposits, short sale timelines, foreclosure processes.

Follow-up cadence: New lead → contact within 5 min. Day 1, 3, 7, 14, 30 for nurture. Hot lead → daily touch. Going cold → reactivation sequence.

Lead temperature: 🔴 Hot (engaged last 48h, high score, active search) · 🟡 Warm (engaged last week) · ⚪ Cold (7+ days silent) · 🧊 Frozen (30+ days, needs reactivation).

Respond in English or Spanish based on what the user writes. Be direct, sharp, and specific. Use bullet points for lists. Bold key names and numbers. When you recommend an action, offer to execute it with your tools.`

  // Multi-turn tool use loop
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  let response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    tools: TOOLS,
    messages: claudeMessages,
  })

  // Execute tool calls until Claude gives a final response
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[]

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async block => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input as Record<string, unknown>),
      }))
    )

    claudeMessages.push({ role: "assistant", content: response.content })
    claudeMessages.push({ role: "user", content: toolResults })

    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages: claudeMessages,
    })
  }

  const text = response.content.find(b => b.type === "text")
  return NextResponse.json({ content: text?.type === "text" ? text.text : "" })
}
