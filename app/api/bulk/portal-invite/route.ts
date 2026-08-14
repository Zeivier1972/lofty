export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendPortalInvites } from "@/lib/portal-invite"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactIds } = await req.json()
    if (!contactIds?.length) return NextResponse.json({ error: "No contacts selected" }, { status: 400 })
    const result = await sendPortalInvites(contactIds, session.user?.id as string)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error("Bulk portal invite error:", e)
    return NextResponse.json({ error: "Failed to send portal invites" }, { status: 500 })
  }
}
