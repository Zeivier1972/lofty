export const dynamic = "force-dynamic"

// Send pre-construction projects to a contact — COMMISSION-PROTECTED.
// Per policy, leads NEVER see: builder/developer name, community/project name,
// or a direct URL. They only see: area, price range, beds, delivery date,
// description, photo, and a Calendly booking link.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { auth } from "@/lib/auth"
import { partnerOwnsContact } from "@/lib/partner-auth"

const SETTING_KEY = "preconstruction_projects"

interface Project {
  id: string
  neighborhood?: string
  city?: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  description?: string
  photos?: string[]
}

async function getProjects(): Promise<Project[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

// Commission-safe fields only — area, price range, beds, delivery, description, photo
function safeArea(p: Project): string {
  return [p.neighborhood, p.city].filter(Boolean).join(", ") || p.zipCode || "Miami area"
}
function priceRange(p: Project): string {
  if (p.priceMin && p.priceMax) return `$${Number(p.priceMin).toLocaleString()} – $${Number(p.priceMax).toLocaleString()}`
  if (p.priceMax) return `up to $${Number(p.priceMax).toLocaleString()}`
  if (p.priceMin) return `from $${Number(p.priceMin).toLocaleString()}`
  return ""
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session && !(await partnerOwnsContact(params.id))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { projectIds, method, note } = await req.json()
    if (!method || !["email", "sms"].includes(method)) {
      return NextResponse.json({ ok: false, error: "method must be email or sms" }, { status: 400 })
    }
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ ok: false, error: "projectIds required" }, { status: 400 })
    }

    const [contact, allProjects, cfg] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: params.id },
        select: { id: true, firstName: true, email: true, phone: true },
      }),
      getProjects(),
      prisma.aIConfig.findFirst({
        select: { realtorName: true, realtorPhone: true, realtorEmail: true, calendlyUrl: true },
      }).catch(() => null),
    ])
    if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 })

    const projects = allProjects.filter(p => projectIds.includes(p.id))
    if (projects.length === 0) return NextResponse.json({ ok: false, error: "No matching projects" }, { status: 404 })

    const agentName = cfg?.realtorName || session?.user?.name || "Catherine Gomez"
    const agentPhone = cfg?.realtorPhone || process.env.TWILIO_PHONE_NUMBER || ""
    const bookUrl = cfg?.calendlyUrl || ""

    if (method === "email") {
      if (!contact.email) return NextResponse.json({ ok: false, error: "Contact has no email address" }, { status: 400 })
      const cards = projects.map(p => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 16px">
          ${p.photos?.[0] ? `<img src="${p.photos[0]}" alt="Pre-construction home" style="width:100%;max-height:240px;object-fit:cover;display:block"/>` : ""}
          <div style="padding:14px 16px">
            <p style="font-size:16px;font-weight:800;color:#0e1f3d;margin:0 0 4px">${safeArea(p)}</p>
            ${priceRange(p) ? `<p style="color:#c9a84c;font-weight:700;margin:0 0 4px">${priceRange(p)}</p>` : ""}
            <p style="color:#6b7280;font-size:13px;margin:0 0 6px">
              ${[p.bedrooms ? `${p.bedrooms} bd` : "", p.deliveryDate ? `Delivery: ${p.deliveryDate}` : ""].filter(Boolean).join(" · ")}
            </p>
            ${p.description ? `<p style="color:#374151;font-size:13px;margin:0">${String(p.description).slice(0, 300)}</p>` : ""}
          </div>
        </div>`).join("")

      const html = wrapEmail(`
        <h2 style="color:#111827;margin:0 0 8px">Hi ${contact.firstName}! 🏗️</h2>
        <p style="color:#374151;margin:0 0 16px">I have exclusive new pre-construction opportunities I think you'll love:</p>
        ${note ? `<p style="color:#374151;margin:0 0 16px">${note}</p>` : ""}
        ${cards}
        ${bookUrl ? `<div style="text-align:center;margin:20px 0">
          <a href="${bookUrl}" style="display:inline-block;background:#0e1f3d;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700">Book a call to learn more →</a>
        </div>` : ""}
      `, { agentName, agentPhone, agentEmail: cfg?.realtorEmail || undefined })
      await sendEmail({
        to: contact.email,
        subject: `🏗️ ${projects.length} new pre-construction ${projects.length === 1 ? "opportunity" : "opportunities"} for you`,
        html,
      })
    } else {
      if (!contact.phone) return NextResponse.json({ ok: false, error: "Contact has no phone number" }, { status: 400 })
      const lines = projects.map((p, i) => {
        const parts = [
          `${i + 1}. ${safeArea(p)}`,
          priceRange(p),
          [p.bedrooms ? `${p.bedrooms} bd` : "", p.deliveryDate ? `Delivery ${p.deliveryDate}` : ""].filter(Boolean).join(" · "),
        ].filter(Boolean)
        return parts.join(" — ")
      })
      const body = [
        `Hi ${contact.firstName}! New pre-construction opportunities:`,
        ...lines,
        note ? `\n${note}` : "",
        bookUrl ? `\nBook a call: ${bookUrl}` : "",
        `\n— ${agentName}`,
      ].filter(Boolean).join("\n")
      await sendSMS(contact.phone, body)
    }

    // Log to the contact timeline (safe label — no builder/community names)
    await prisma.activity.create({
      data: {
        contactId: contact.id,
        userId: session?.user?.id,
        type: method === "email" ? "EMAIL_SENT" : "SMS_SENT",
        title: `Sent ${projects.length} pre-construction ${projects.length === 1 ? "project" : "projects"} via ${method}`,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true, sent: projects.length })
  } catch (e: any) {
    console.error("[send-preconstruction]", e?.message)
    return NextResponse.json({ ok: false, error: e.message || "Send failed" }, { status: 500 })
  }
}
