import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { pauseSofia, resumeSofia } from "@/lib/sofia-control"

// POST { action: "pause" | "resume" } — the "Pausar a Sofía" button on a contact.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { action } = await req.json().catch(() => ({}))
  const by = session.user?.name || "CRM"
  try {
    if (action === "pause") return NextResponse.json({ ok: true, paused: true, ...(await pauseSofia(params.id, by)) })
    if (action === "resume") return NextResponse.json({ ok: true, paused: false, ...(await resumeSofia(params.id, by)) })
    return NextResponse.json({ error: "action must be pause or resume" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo actualizar" }, { status: 500 })
  }
}
