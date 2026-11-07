export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { recordView } from "@/lib/personal-video"

/** Public: the personal video page reports a view (pct 0) and progress (25/50/75/100). */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}))
  const pct = Number(body.pct)
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(params.token) || !Number.isFinite(pct)) return NextResponse.json({ ok: false }, { status: 400 })
  await recordView(params.token, pct).catch(e => console.error("[personal-video] view:", e))
  return NextResponse.json({ ok: true })
}
