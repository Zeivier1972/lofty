export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getOpenSlots } from "@/lib/slot-offer"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date") // "YYYY-MM-DD"
  const userId = searchParams.get("userId")

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return NextResponse.json({ error: "date required" }, { status: 400 })

  try {
    // Shared with Sofía's two-time offers, so both see the same open slots.
    const { slots, slotMinutes, message } = await getOpenSlots(dateStr, userId)
    return NextResponse.json(message ? { slots, message } : { slots, slotMinutes })
  } catch (e) {
    console.error("Slots error:", e)
    return NextResponse.json({ error: "Failed to get slots" }, { status: 500 })
  }
}
