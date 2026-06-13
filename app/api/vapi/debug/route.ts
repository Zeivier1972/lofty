export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Temporary debug endpoint — logs the raw VAPI payload so we can see the exact format.
// Set the VAPI phone number's server URL to this endpoint for one call, then switch back.
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    console.log("[VAPI DEBUG] Raw payload:", JSON.stringify(payload, null, 2))
    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error("[VAPI DEBUG] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
