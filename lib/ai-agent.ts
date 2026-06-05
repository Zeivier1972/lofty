import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { sendSMS } from "./sms"
import { sendEmail } from "./email"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

interface AgentContext {
  contact: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    status: string
    leadScore: number
    buyerBudgetMin?: number | null
    buyerBudgetMax?: number | null
    buyerLocation?: string | null
    buyerBedroomsMin?: number | null
  }
  trigger: "PROPERTY_SAVED" | "PROPERTY_VIEWED_3X" | "SEARCH_BEHAVIOR" | "NEW_LEAD" | "FOLLOW_UP"
  property?: {
    id: string
    address: string
    city: string
    state: string
    price: number
    bedrooms?: number | null
    bathrooms?: number | null
    sqft?: number | null
    images?: string
  }
  searchCriteria?: {
    minPrice?: number
    maxPrice?: number
    bedrooms?: number
    location?: string
    propertyType?: string
  }
  recentSearches?: number
}

export async function runAIAgent(context: AgentContext): Promise<void> {
  const config = await getAIConfig()
  const { contact, trigger, property } = context

  const systemPrompt = `${config.agentPersona}

You are working on behalf of ${config.realtorName}, a professional real estate agent.
Your job is to engage leads warmly, answer their questions, and schedule property showings.
Always be helpful, concise (texts under 160 chars), and professional.
When appropriate, try to get them to schedule a showing or call with ${config.realtorName}.

Contact info:
- Name: ${contact.firstName} ${contact.lastName}
- Status: ${contact.status}
- Lead Score: ${contact.leadScore}/100
- Budget: ${contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()} - $${contact.buyerBudgetMax?.toLocaleString()}` : "not specified"}
- Looking in: ${contact.buyerLocation || "not specified"}
- Min bedrooms: ${contact.buyerBedroomsMin || "not specified"}

Agent: ${config.realtorName}
Agent phone: ${config.realtorPhone || "our office"}
Agent email: ${config.realtorEmail || "our office"}`

  let userMessage = ""
  let actions: { type: "SMS" | "EMAIL" | "TASK" | "NOTIFY"; content: string; subject?: string }[] = []

  switch (trigger) {
    case "PROPERTY_SAVED":
      userMessage = `The contact just saved this property: ${property?.address}, ${property?.city}, ${property?.state} - $${property?.price.toLocaleString()}, ${property?.bedrooms} bed/${property?.bathrooms} bath, ${property?.sqft?.toLocaleString()} sqft.
Draft a short, personalized SMS (under 160 chars) to follow up and offer to schedule a showing. Also draft a follow-up email with more details.`
      break

    case "PROPERTY_VIEWED_3X":
      userMessage = `The contact has viewed this property 3+ times: ${property?.address}, ${property?.city} - $${property?.price.toLocaleString()}. They seem very interested.
Draft a short SMS to reach out personally. Also draft a task description for ${config.realtorName} to prioritize this lead.`
      break

    case "SEARCH_BEHAVIOR":
      userMessage = `The contact has been actively searching properties with criteria: ${JSON.stringify(context.searchCriteria)}. They've done ${context.recentSearches} searches recently.
Draft a personalized SMS alerting them to new matches and suggesting we schedule a call. Also create a task for ${config.realtorName}.`
      break

    case "NEW_LEAD":
      userMessage = `A new lead just registered: ${contact.firstName} ${contact.lastName}. Budget: ${contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()} - $${contact.buyerBudgetMax?.toLocaleString()}` : "unknown"}.
Draft a warm welcome SMS (under 160 chars) and a welcome email introducing ${config.realtorName}'s services.`
      break

    case "FOLLOW_UP":
      userMessage = `It's been a while since we contacted ${contact.firstName}. Draft a friendly check-in SMS and create a follow-up task for ${config.realtorName}.`
      break
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${userMessage}\n\nRespond with a JSON object with this structure:
{
  "sms": "SMS text (under 160 chars)",
  "emailSubject": "Email subject line",
  "emailBody": "HTML email body",
  "taskTitle": "Task title for ${config.realtorName}",
  "taskDescription": "Task description",
  "notificationTitle": "Short notification title for ${config.realtorName}",
  "notificationBody": "Notification body explaining what the AI did and why this lead matters",
  "leadScoreChange": 5
}`,
        },
      ],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""

    let parsed: any = {}
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = { sms: `Hi ${contact.firstName}! I saw you're looking at properties. I'm ${config.realtorName}'s assistant - can I help schedule a showing?` }
    }

    // Execute actions
    const executedActions: string[] = []

    // Send SMS
    if (parsed.sms && contact.phone && config.autoRespondSMS) {
      try {
        await sendSMS(contact.phone, parsed.sms)
        executedActions.push("SMS sent")

        await prisma.sMSMessage.create({
          data: {
            body: parsed.sms,
            fromNumber: process.env.TWILIO_PHONE_NUMBER || "system",
            toNumber: contact.phone,
            direction: "OUTBOUND",
            status: "SENT",
            contactId: contact.id,
          },
        })

        // Log AI message
        const conv = await prisma.aIConversation.upsert({
          where: { id: `conv-${contact.id}` },
          update: { lastMessage: parsed.sms, updatedAt: new Date() },
          create: { id: `conv-${contact.id}`, contactId: contact.id, channel: "SMS", lastMessage: parsed.sms },
        })

        await prisma.aIMessage.create({
          data: {
            conversationId: conv.id,
            role: "assistant",
            content: parsed.sms,
            channel: "SMS",
            delivered: true,
            deliveredAt: new Date(),
          },
        })
      } catch (e) {
        console.error("SMS send failed:", e)
      }
    }

    // Send Email
    if (parsed.emailSubject && parsed.emailBody && contact.email && config.autoRespondEmail) {
      try {
        await sendEmail({
          to: contact.email,
          subject: parsed.emailSubject,
          html: parsed.emailBody,
        })
        executedActions.push("Email sent")

        await prisma.email.create({
          data: {
            subject: parsed.emailSubject,
            body: parsed.emailBody,
            fromAddress: process.env.SMTP_FROM || "agent@loftycrm.com",
            toAddress: contact.email,
            status: "SENT",
            sentAt: new Date(),
            contactId: contact.id,
          },
        })
      } catch (e) {
        console.error("Email send failed:", e)
      }
    }

    // Create task for Catherine
    if (parsed.taskTitle) {
      const tomorrow = new Date()
      tomorrow.setHours(tomorrow.getHours() + (config.followUpDelayHours || 2))

      await prisma.task.create({
        data: {
          title: parsed.taskTitle,
          description: parsed.taskDescription || "",
          priority: contact.leadScore >= 70 ? "HIGH" : "MEDIUM",
          type: "FOLLOW_UP",
          contactId: contact.id,
          dueDate: tomorrow,
        },
      })
      executedActions.push("Task created for " + config.realtorName)
    }

    // Update lead score
    if (parsed.leadScoreChange && parsed.leadScoreChange > 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          leadScore: Math.min(100, contact.leadScore + parsed.leadScoreChange),
          lastContacted: new Date(),
        },
      })
    }

    // Create activity
    await prisma.activity.create({
      data: {
        type: "AI_TRIGGERED",
        title: `AI Agent: ${trigger.replace(/_/g, " ").toLowerCase()}`,
        description: executedActions.join(", "),
        contactId: contact.id,
      },
    })

    // Notify Catherine
    await prisma.aINotification.create({
      data: {
        title: parsed.notificationTitle || `AI acted on ${contact.firstName} ${contact.lastName}`,
        body: parsed.notificationBody || executedActions.join(". "),
        type: trigger,
        priority: contact.leadScore >= 70 ? "HIGH" : "MEDIUM",
        contactId: contact.id,
        metadata: JSON.stringify({ trigger, property, executedActions }),
      },
    })
  } catch (error) {
    console.error("AI Agent error:", error)
  }
}

export async function getAIConfig() {
  let config = await prisma.aIConfig.findFirst()
  if (!config) {
    config = await prisma.aIConfig.create({
      data: {
        agentName: "Alex",
        realtorName: "Catherine",
        realtorPhone: process.env.REALTOR_PHONE || "",
        realtorEmail: process.env.REALTOR_EMAIL || "",
      },
    })
  }
  return config
}

export async function chatWithAI(messages: { role: "user" | "assistant"; content: string }[], contactContext?: string): Promise<string> {
  const config = await getAIConfig()

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `${config.agentPersona}\nYou are working for ${config.realtorName}.${contactContext ? `\n\nContact context:\n${contactContext}` : ""}`,
    messages,
  })

  return response.content[0].type === "text" ? response.content[0].text : ""
}
