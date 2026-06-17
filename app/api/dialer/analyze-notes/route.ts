export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface MLSSearch {
  minBeds?: number
  minBaths?: number
  minPrice?: number
  maxPrice?: number
  city?: string
  state?: string
  propertyType?: string // condo, single-family, townhouse
  newConstruction?: boolean
  yearBuiltMin?: number
  maxHOA?: number
  keywords?: string
}

interface ExtractedTask {
  title: string
  dueDate?: string // ISO date
  priority: "LOW" | "MEDIUM" | "HIGH"
  type: string
  description?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { callId, notes, contactId } = await req.json()
  if (!notes?.trim()) return NextResponse.json({ error: "Notes required" }, { status: 400 })

  const today = new Date().toISOString().split("T")[0]

  const prompt = `You are an AI assistant for Catherine Gomez Realtor in Miami, FL. Analyze these call notes and extract actionable data.

Today's date: ${today}

Call notes:
"${notes}"

Extract and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "mlsSearch": {
    "minBeds": <number or null>,
    "minBaths": <number or null>,
    "minPrice": <number or null>,
    "maxPrice": <number or null>,
    "city": <string or null>,
    "state": <string, default "FL">,
    "propertyType": <"condo"|"single-family"|"townhouse"|"multi-family"|null>,
    "newConstruction": <true|false>,
    "yearBuiltMin": <number or null, use ${new Date().getFullYear()} if "pre-construction" or "new construction" mentioned>,
    "maxHOA": <number or null>,
    "keywords": <additional search keywords or null>
  },
  "hasMlsCriteria": <true if any search criteria found, false if just a general call>,
  "tasks": [
    {
      "title": <task title>,
      "dueDate": <ISO date YYYY-MM-DD or null>,
      "priority": <"LOW"|"MEDIUM"|"HIGH">,
      "type": <"FOLLOW_UP"|"SEND_INFO"|"APPOINTMENT"|"OTHER">,
      "description": <short description or null>
    }
  ],
  "summary": <1-2 sentence summary of the call>
}`

  let parsed: any
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })
    const text = (response.content[0] as any).text.trim()
    // Strip markdown code blocks if present
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    parsed = JSON.parse(clean)
  } catch (e) {
    console.error("[AnalyzeNotes] AI error:", e)
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 })
  }

  // Auto-create tasks in the database
  const createdTasks: any[] = []
  if (parsed.tasks?.length) {
    for (const t of parsed.tasks) {
      try {
        const task = await prisma.task.create({
          data: {
            title: t.title,
            description: t.description || undefined,
            dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
            priority: t.priority || "MEDIUM",
            type: t.type || "FOLLOW_UP",
            status: "PENDING",
            contactId: contactId || undefined,
            assignedToId: session.user.id,
          },
        })
        createdTasks.push(task)
      } catch (err) {
        console.error("[AnalyzeNotes] Task create error:", err)
      }
    }
  }

  // Save AI summary to the call record
  if (callId) {
    await prisma.dialerCall.update({
      where: { id: callId },
      data: { aiSummary: parsed.summary, notes },
    }).catch(() => {})
  }

  // Build response message
  const mlsSearch: MLSSearch | null = parsed.hasMlsCriteria ? parsed.mlsSearch : null
  let message = parsed.summary || "Call notes analyzed."
  if (createdTasks.length > 0) {
    message += ` Created ${createdTasks.length} task${createdTasks.length > 1 ? "s" : ""} automatically.`
  }
  if (mlsSearch) {
    message += " MLS search criteria saved — will auto-search once IDX API connection is approved."
  }

  return NextResponse.json({
    summary: parsed.summary,
    mlsSearch,
    tasks: createdTasks,
    message,
    raw: parsed,
  })
}
