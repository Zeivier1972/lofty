export const dynamic = "force-dynamic"
export const maxDuration = 120

// Repair international phone numbers stored without their "+" prefix.
// Example: Colombian lead stored as "573208932534" — every send assumed US
// and texted +1 (320) 893-2534 (Minnesota!) instead of +57 320 893 2534.
// Rule: no "+", 11+ digits, doesn't start with "1" → it already carries a
// country code → store it as +<digits>.
//   GET  /api/admin/fix-international-phones          → preview by country code
//   GET  /api/admin/fix-international-phones?apply=1  → fix them
// After applying, run /api/admin/verify-flagged-numbers?verify=1 so flagged
// contacts whose REAL number is a mobile get their texting restored.
// Session-protected.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const CC_NAMES: Record<string, string> = {
  "57": "Colombia", "52": "México", "58": "Venezuela", "54": "Argentina",
  "56": "Chile", "51": "Perú", "55": "Brasil", "34": "España",
  "593": "Ecuador", "502": "Guatemala", "503": "El Salvador", "504": "Honduras",
  "505": "Nicaragua", "506": "Costa Rica", "507": "Panamá", "809": "Rep. Dominicana",
}

function ccOf(digits: string): string {
  for (const len of [3, 2]) {
    const p = digits.slice(0, len)
    if (CC_NAMES[p]) return `${p} (${CC_NAMES[p]})`
  }
  return digits.slice(0, 2)
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"

  const candidates = await prisma.contact.findMany({
    where: { phone: { not: null }, NOT: { phone: { startsWith: "+" } } },
    select: { id: true, firstName: true, lastName: true, phone: true, doNotText: true },
  })

  const toFix = candidates.filter(c => {
    const d = (c.phone || "").replace(/\D/g, "")
    return d.length >= 11 && !d.startsWith("1")
  })

  const byCC: Record<string, number> = {}
  let flaggedAmongThem = 0
  for (const c of toFix) {
    const d = c.phone!.replace(/\D/g, "")
    const cc = ccOf(d)
    byCC[cc] = (byCC[cc] || 0) + 1
    if (c.doNotText) flaggedAmongThem++
  }

  if (!apply) {
    return NextResponse.json({
      preview: true,
      internationalNumbersMissingPlus: toFix.length,
      byCountryCode: byCC,
      currentlyBlockedAmongThem: flaggedAmongThem,
      sample: toFix.slice(0, 15).map(c => ({
        name: `${c.firstName} ${c.lastName || ""}`.trim(),
        stored: c.phone,
        willBecome: `+${c.phone!.replace(/\D/g, "")}`,
      })),
      message: `${toFix.length} contacts have international numbers stored without "+" — every text went to a WRONG US number. Add ?apply=1 to fix the format. Then run /api/admin/verify-flagged-numbers?verify=1 to restore texting on the ones that were wrongly flagged.`,
    })
  }

  let fixed = 0
  for (const c of toFix) {
    const e164 = `+${c.phone!.replace(/\D/g, "")}`
    await prisma.contact.update({ where: { id: c.id }, data: { phone: e164 } }).catch(() => { fixed-- })
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: "🌎 Número internacional corregido",
        description: `Guardado como ${c.phone} (sin +). Los mensajes iban a un número equivocado de EE.UU. Corregido a ${e164}.`,
        contactId: c.id,
      },
    }).catch(() => {})
    fixed++
  }

  return NextResponse.json({
    applied: true,
    fixed,
    byCountryCode: byCC,
    nextStep: "Run /api/admin/verify-flagged-numbers?verify=1 — flagged contacts whose real number is a mobile will get texting restored automatically.",
    message: `Fixed ${fixed} international numbers to +CC format. All texts, WhatsApp and calls now go to the REAL number.`,
  })
}
