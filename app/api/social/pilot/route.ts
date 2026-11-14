export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPilot, refreshPilot, startPilot, reEditPilot, uploadPilot, publishPilot, resetPilot } from "@/lib/pilot-video"
import { PILOT_SCENES, PILOT_META, pilotDescription } from "@/lib/pilot-plan"

// The 16:9 YouTube pilot (Social → Cuentas → "Video piloto 16:9").
// GET: the production plan + where the pilot is (advances it while the panel
// is open). POST {action}: approve (start), reedit, upload (unlisted), publish, reset.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const state = await refreshPilot().catch(async () => getPilot())
  return NextResponse.json({
    state,
    plan: { scenes: PILOT_SCENES, meta: PILOT_META, description: pilotDescription(state.chapters || []) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { action } = await req.json().catch(() => ({}))
  try {
    const state =
      action === "approve" ? await startPilot()
      : action === "reedit" ? await reEditPilot()
      : action === "upload" ? await uploadPilot()
      : action === "publish" ? await publishPilot()
      : action === "reset" ? await resetPilot()
      : null
    if (!state) return NextResponse.json({ error: "Acción desconocida" }, { status: 400 })
    return NextResponse.json({ state })
  } catch (e: any) {
    console.error(`[pilot] ${action} failed:`, e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}
