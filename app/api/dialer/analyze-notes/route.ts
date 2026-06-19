export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const ANALYSIS_PROMPT = (notes: string) => `Analyze these call notes from a real estate agent and extract:
1. Property search criteria (beds, baths, price range, city, property type, new construction)
2. Follow-up tasks needed (call back date, documents to send, etc.)
3. Whether it's pre-construction interest

Notes: ${notes}

Return JSON only (no markdown, no explanation):
{
  "mlsSearch": {
    "minBeds": number | null,
    "minBaths": number | null,
    "minPrice": number | null,
    "maxPrice": number | null,
    "city": string | null,
    "propertyType": string | null,
    "newConstruction": boolean,
    "yearBuiltMin": number | null
  } | null,
  "tasks": [
    {
      "title": string,
      "dueDate": string | null,
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "type": "FOLLOW_UP" | "CALL" | "EMAIL" | "DOCUMENT" | "OTHER"
    }
  ],
  "summary": string,
  "canSearch": boolean
}`

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { callId, notes, contactId } = await req.json()

  if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
    return NextResponse.json({ error: "Notes are required" }, { status: 400 })
  }

  let analysisResult: {
    mlsSearch: {
      minBeds?: number | null
      minBaths?: number | null
      minPrice?: number | null
      maxPrice?: number | null
      city?: string | null
      propertyType?: string | null
      newConstruction?: boolean
      yearBuiltMin?: number | null
    } | null
    tasks: Array<{
      title: string
      dueDate: string | null
      priority: string
      type: string
    }>
    summary: string
    canSearch: boolean
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: ANALYSIS_PROMPT(notes),
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude")
    }

    // Strip any potential markdown code blocks
    const rawText = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "")
    analysisResult = JSON.parse(rawText)
  } catch (err) {
    console.error("[ANALYZE NOTES] AI analysis failed:", err)
    return NextResponse.json(
      { error: "AI analysis failed", details: String(err) },
      { status: 500 }
    )
  }

  // Auto-create tasks in DB
  const createdTasks = []
  if (analysisResult.tasks && Array.isArray(analysisResult.tasks) && contactId) {
    for (const task of analysisResult.tasks) {
      try {
        const created = await prisma.task.create({
          data: {
            title: task.title,
            priority: task.priority || "MEDIUM",
            type: task.type || "FOLLOW_UP",
            status: "PENDING",
            contactId,
            assignedToId: session.user.id,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          },
        })
        createdTasks.push(created)
      } catch (err) {
        console.error("[ANALYZE NOTES] Failed to create task:", err)
      }
    }
  }

  // Save aiSummary to DialerCall if callId provided
  if (callId) {
    try {
      await prisma.dialerCall.update({
        where: { id: callId },
        data: { aiSummary: analysisResult.summary },
      })
    } catch (err) {
      console.error("[ANALYZE NOTES] Failed to save aiSummary:", err)
    }
  }

  const message =
    analysisResult.mlsSearch && analysisResult.canSearch
      ? "MLS search criteria saved. Will auto-search when IDX connection is approved."
      : "Notes analyzed and tasks created."

  return NextResponse.json({
    tasks: createdTasks,
    mlsSearch: analysisResult.mlsSearch,
    summary: analysisResult.summary,
    message,
  })
}
