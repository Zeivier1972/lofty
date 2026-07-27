export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { extractBuyerPrefsFromNote, triggerMatchAlert } from "@/lib/trigger-match-alert"
import { sendEmail } from "@/lib/email"
import { sendSMS } from "@/lib/sms"

// Parse @mentions from note text and notify the matching referral partners by
// email + SMS, so the agent can loop a partner in on a specific lead's notes.
// Accent-aware token (À-ÿ) without needing the RegExp 'u' flag.
async function notifyMentionedPartners(content: string, contactId: string, mentionedBy: string) {
  try {
    const tokens = Array.from(new Set((content.match(/@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9._-]*)/g) || []).map(m => m.slice(1).toLowerCase())))
    if (!tokens.length) return

    const nameMatches = (name: string) => {
      const full = (name || "").toLowerCase().trim()
      const first = full.split(/\s+/)[0]
      const compact = full.replace(/\s+/g, "")
      return tokens.some(t => t === first || t === full || t === compact || (t.length >= 3 && full.startsWith(t)))
    }

    const [partners, loanOfficers] = await Promise.all([
      prisma.referralPartner.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, phone: true, token: true } }),
      prisma.loanOfficer.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true } }).catch(() => []),
    ])
    const matchedPartners = partners.filter(p => nameMatches(p.name))
    const matchedLOs = (loanOfficers as any[]).filter(lo => nameMatches(lo.name))
    if (!matchedPartners.length && !matchedLOs.length) return

    const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true } })
    const leadName = contact ? `${contact.firstName} ${contact.lastName || ""}`.trim() : "un lead"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const snippet = content.slice(0, 400)

    const notifyEmail = (email: string | null, portal: string | null) => {
      if (!email) return
      sendEmail({
        to: email,
        subject: `Nota sobre ${leadName}`,
        transactional: true,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <p><strong>${mentionedBy}</strong> te mencionó en una nota sobre <strong>${leadName}</strong>:</p>
          <blockquote style="border-left:3px solid #c9a84c;padding-left:12px;color:#374151;white-space:pre-wrap">${snippet.replace(/</g, "&lt;")}</blockquote>
          ${portal ? `<p><a href="${portal}" style="background:#0e1f3d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ver el lead →</a></p>` : ""}
        </div>`,
      }).catch(() => {})
    }

    // Referral partners (realtors): email + SMS + portal magic link.
    for (const p of matchedPartners) {
      const portal = p.token ? `${appUrl}/partner/login?token=${p.token}` : null
      notifyEmail(p.email, portal)
      if (p.phone) sendSMS(p.phone, `Nota sobre ${leadName} de ${mentionedBy}: "${content.slice(0, 200)}"${portal ? ` Ver: ${portal}` : ""}`).catch(() => {})
      prisma.activity.create({ data: { type: "NOTE_ADDED", title: `Notificado a ${p.name} sobre esta nota`, description: snippet.slice(0, 120), contactId } }).catch(() => {})
    }

    // Loan officers: email + link to their portal (they log in with their own creds).
    for (const lo of matchedLOs) {
      notifyEmail(lo.email, `${appUrl}/lender`)
      prisma.activity.create({ data: { type: "NOTE_ADDED", title: `Notificado al loan officer ${lo.name} sobre esta nota`, description: snippet.slice(0, 120), contactId } }).catch(() => {})
    }
  } catch (e) {
    console.error("[note-mentions]", e)
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { content, isPinned } = await req.json()

    const note = await prisma.note.create({
      data: {
        content,
        isPinned: isPinned || false,
        contactId: params.id,
        authorId: session?.user?.id,
      },
      include: { author: { select: { name: true } } },
    })

    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: "Note added",
        contactId: params.id,
        userId: session?.user?.id,
      },
    })

    // Notify any @mentioned referral partners (fire-and-forget)
    void notifyMentionedPartners(content, params.id, session?.user?.name || "Catherine")

    // Fire-and-forget: extract buyer prefs from note text and update contact profile
    ;(async () => {
      try {
        const prefs = await extractBuyerPrefsFromNote(content)
        if (!prefs || Object.keys(prefs).length === 0) return

        const hasPrefs = prefs.buyerBudgetMax || prefs.buyerLocation || prefs.buyerBedroomsMin

        await prisma.contact.update({
          where: { id: params.id },
          data: {
            ...prefs,
            // Set matchPrefsCompletedAt only if we extracted useful prefs and it wasn't already set
            ...(hasPrefs ? {
              matchPrefsCompletedAt: await prisma.contact.findUnique({
                where: { id: params.id },
                select: { matchPrefsCompletedAt: true },
              }).then(c => c?.matchPrefsCompletedAt ?? new Date()),
            } : {}),
          },
        })

        // Send immediate match alert if we found new prefs
        if (hasPrefs) {
          await triggerMatchAlert(params.id)
        }
      } catch (e) {
        console.error("[note-prefs-extract]", e)
      }
    })()

    return NextResponse.json(note, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 })
  }
}
