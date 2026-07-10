export const dynamic = "force-dynamic"
export const maxDuration = 300

// Independent verification of auto-flagged "bad" numbers, using Twilio Lookup
// (the authoritative carrier database — tells us line type: mobile, landline,
// voip, or nonexistent). This answers "was the system wrong?" with data:
//
//   GET  /api/admin/verify-flagged-numbers            → preview: who was
//        auto-flagged, grouped by error code, + estimated Lookup cost
//   GET  /api/admin/verify-flagged-numbers?verify=1   → run Lookup on each:
//        • mobile / non-fixed VoIP  → texting RESTORED (flag was wrong or stale)
//        • landline / fixed VoIP / nonexistent → confirmed bad, stays blocked
//        • unknown → left blocked, reported for manual review
//
// Contacts who opted out themselves (STOP / error 21610) are NEVER restored —
// that's consent, not deliverability. Session-protected. Lookup costs ~$0.008
// per number.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import twilio from "twilio"
import { toE164 } from "@/lib/sms"

const FLAG_NOTE = "SMS desactivado automáticamente"
const RESTORE_TYPES = new Set(["mobile", "nonFixedVoip"])

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const verify = new URL(req.url).searchParams.get("verify") === "1"

  // Auto-flagged contacts = those with the system's flag note. Parse the error
  // code out of each note so opt-outs (21610) can be excluded from restoration.
  const notes = await prisma.activity.findMany({
    where: { type: "NOTE_ADDED", title: { contains: FLAG_NOTE } },
    select: { contactId: true, description: true },
    orderBy: { createdAt: "desc" },
  })
  const codeByContact = new Map<string, string>()
  for (const n of notes) {
    if (!n.contactId || codeByContact.has(n.contactId)) continue
    const code = n.description?.match(/error\s+(\d{5})/)?.[1] || "?"
    codeByContact.set(n.contactId, code)
  }

  const flagged = await prisma.contact.findMany({
    where: { id: { in: Array.from(codeByContact.keys()) }, doNotText: true, phone: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  })

  const byCode: Record<string, number> = {}
  for (const c of flagged) {
    const code = codeByContact.get(c.id) || "?"
    byCode[code] = (byCode[code] || 0) + 1
  }
  const eligible = flagged.filter(c => codeByContact.get(c.id) !== "21610")

  if (!verify) {
    return NextResponse.json({
      preview: true,
      autoFlaggedStillBlocked: flagged.length,
      byErrorCode: byCode,
      codeMeanings: {
        "21211": "número inválido (mal formateado)",
        "21610": "el lead respondió STOP — NO se verifica ni se reactiva",
        "21614": "número sin capacidad SMS",
        "30003": "teléfono apagado/inalcanzable (puede ser temporal)",
        "30005": "el número no existe",
        "30006": "línea fija u operador inalcanzable",
      },
      willVerify: eligible.length,
      estimatedLookupCost: `$${(eligible.length * 0.008).toFixed(2)}`,
      sample: flagged.slice(0, 15).map(c => ({
        name: `${c.firstName} ${c.lastName || ""}`.trim(),
        phone: c.phone,
        errorCode: codeByContact.get(c.id),
      })),
      message: `${flagged.length} contacts were auto-flagged. Add ?verify=1 to check each against Twilio Lookup (carrier database): real mobiles get texting RESTORED automatically; landlines/nonexistent stay blocked.`,
    })
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return NextResponse.json({ error: "Twilio credentials not configured" }, { status: 500 })
  const client = twilio(sid, token)
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  let restored = 0
  let confirmedBad = 0
  let unknown = 0
  const byType: Record<string, number> = {}
  const restoredNames: string[] = []

  for (const c of eligible.slice(0, 300)) {
    const digits = (c.phone || "").replace(/\D/g, "")
    const e164 = toE164(c.phone)
    let lineType = "unknown"
    try {
      const res: any = await client.lookups.v2.phoneNumbers(e164).fetch({ fields: "line_type_intelligence" } as any)
      lineType = res?.lineTypeIntelligence?.type || "unknown"
      if (res?.valid === false) lineType = "invalid"
    } catch (e: any) {
      // Lookup 404 / 20404 = the number does not exist at all
      if (e?.status === 404 || String(e?.code) === "20404") lineType = "invalid"
      else { unknown++; byType["lookup_error"] = (byType["lookup_error"] || 0) + 1; continue }
    }
    byType[lineType] = (byType[lineType] || 0) + 1

    if (RESTORE_TYPES.has(lineType)) {
      await prisma.contact.update({ where: { id: c.id }, data: { doNotText: false } }).catch(() => {})
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          title: "✅ SMS reactivado — verificado con Twilio Lookup",
          description: `La base de datos de operadores confirma que es un móvil real (${lineType}). El fallo anterior fue temporal — los textos vuelven a funcionar.`,
          contactId: c.id,
        },
      }).catch(() => {})
      restored++
      restoredNames.push(`${c.firstName} ${c.lastName || ""}`.trim())
    } else if (lineType === "unknown") {
      unknown++
    } else {
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          title: "🚫 Confirmado por Twilio Lookup: no recibe SMS",
          description: `La base de datos de operadores lo clasifica como "${lineType}" (línea fija/VoIP fijo/inexistente). El bloqueo de textos es correcto — usa email o llamada.`,
          contactId: c.id,
        },
      }).catch(() => {})
      confirmedBad++
    }
    await sleep(120)
  }

  return NextResponse.json({
    verified: true,
    checked: restored + confirmedBad + unknown,
    textingRestored: restored,
    confirmedBad,
    unknownLeftBlocked: unknown,
    byLineType: byType,
    restoredSample: restoredNames.slice(0, 20),
    message: `Twilio Lookup verified the flags: ${restored} were real mobiles (texting restored — the failure was temporary), ${confirmedBad} confirmed landline/nonexistent (correctly blocked), ${unknown} inconclusive (left blocked for safety).`,
  })
}
