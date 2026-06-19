export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ingestLead } from "@/lib/lead-ingest"

const GRAPH = "https://graph.facebook.com/v25.0"

function token() {
  return process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { formId, formName } = await req.json()
  if (!formId) return NextResponse.json({ error: "formId required" }, { status: 400 })

  const tok = token()
  if (!tok) return NextResponse.json({ error: "FB_PAGE_ACCESS_TOKEN not configured" }, { status: 500 })

  let imported = 0
  let skipped = 0
  let cursor: string | null = null

  // Paginate through all leads in the form
  do {
    const url = new URL(`${GRAPH}/${formId}/leads`)
    url.searchParams.set("access_token", tok)
    url.searchParams.set("fields", "field_data,created_time")
    url.searchParams.set("limit", "100")
    if (cursor) url.searchParams.set("after", cursor)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[sync-form-leads] FB API error:", res.status, JSON.stringify(err))
      return NextResponse.json({ error: "Facebook API error — token may be expired", detail: err }, { status: 502 })
    }

    const data = await res.json()
    const leads: any[] = data.data || []
    cursor = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : null

    for (const lead of leads) {
      const fields: Record<string, string> = {}
      for (const f of lead.field_data || []) fields[f.name] = f.values?.[0] || ""

      const fullName = fields["full_name"] || fields["name"] || ""
      const nameParts = fullName.trim().split(" ")
      const firstName = fields["first_name"] || nameParts[0] || "Facebook"
      const lastName = fields["last_name"] || nameParts.slice(1).join(" ") || undefined
      const email = fields["email"] || fields["email_address"] || undefined
      const phone = fields["phone_number"] || fields["phone"] || undefined

      if (!firstName && !email && !phone) { skipped++; continue }

      try {
        await ingestLead({
          firstName,
          lastName,
          email,
          phone,
          source: "FACEBOOK",
          campaign: formName || undefined,
          facebookLeadId: lead.id,
          smsConsent: !!phone,
        })
        imported++
      } catch (e: any) {
        // Duplicate leadId — already in CRM
        if (e?.code === "P2002") { skipped++; continue }
        console.error("[sync-form-leads] ingestLead error:", e)
        skipped++
      }
    }
  } while (cursor)

  return NextResponse.json({ imported, skipped })
}
