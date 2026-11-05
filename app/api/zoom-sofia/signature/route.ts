export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { auth } from "@/lib/auth"

/**
 * Meeting SDK join signature for "Sofía en Zoom" (/sofia-zoom).
 *
 * Needs a Zoom General App with the Meeting SDK enabled, in the same Zoom
 * account as Catherine's meetings: ZOOM_SDK_KEY = its Client ID,
 * ZOOM_SDK_SECRET = its Client Secret. The secret never leaves the server.
 * Logged-in CRM users only. Sofía always joins as a participant (role 0).
 */

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url")

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const sdkKey = process.env.ZOOM_SDK_KEY
  const sdkSecret = process.env.ZOOM_SDK_SECRET
  if (!sdkKey || !sdkSecret) {
    return NextResponse.json(
      { error: "Falta configurar ZOOM_SDK_KEY y ZOOM_SDK_SECRET (app de Meeting SDK de Zoom) en Railway." },
      { status: 500 },
    )
  }

  const { meetingNumber } = await req.json().catch(() => ({}))
  const mn = String(meetingNumber || "").replace(/\D/g, "")
  if (mn.length < 9) return NextResponse.json({ error: "Número de reunión inválido" }, { status: 400 })

  const iat = Math.floor(Date.now() / 1000) - 30
  const exp = iat + 60 * 60 * 4 // a presentation, with margin
  const header = { alg: "HS256", typ: "JWT" }
  const payload = { appKey: sdkKey, sdkKey, mn, role: 0, iat, exp, tokenExp: exp }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = `${unsigned}.${createHmac("sha256", sdkSecret).update(unsigned).digest("base64url")}`

  return NextResponse.json({ signature, sdkKey, meetingNumber: mn })
}
