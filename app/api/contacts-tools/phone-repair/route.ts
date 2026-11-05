export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyPhoneRepair, findPhoneRepairCandidates } from "@/lib/phone-repair"

/** GET lists contacts whose Colombian mobile was saved as +1; POST { ids } fixes the chosen ones. */
export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ candidates: await findPhoneRepairCandidates() })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 2000) : []
  if (!ids.length) return NextResponse.json({ error: "Nada seleccionado" }, { status: 400 })
  const fixed = await applyPhoneRepair(ids, (session.user as { id?: string })?.id)
  return NextResponse.json({ ok: true, fixed })
}
