export const dynamic = "force-dynamic"

// Open-tracking pixel. Every email sent via sendEmail embeds
// <img src="/api/email/open/{emailRowId}">. When the recipient's mail client
// loads it, we stamp openedAt on that exact email and log an EMAIL_OPENED
// activity on the contact — so "opened" in the CRM means actually opened.
// Returns a 1x1 transparent GIF either way.

import { prisma } from "@/lib/prisma"

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

function pixel(): Response {
  return new Response(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Content-Length": String(GIF.length),
    },
  })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const email = await prisma.email.findUnique({
      where: { id: params.id },
      select: { id: true, openedAt: true, subject: true, toAddress: true, contactId: true },
    })
    if (!email) return pixel()

    // Only the FIRST open is recorded (repeat opens don't spam the timeline)
    if (!email.openedAt) {
      await prisma.email.update({
        where: { id: email.id },
        data: { openedAt: new Date() },
      }).catch(() => {})

      // Link the open to the contact (by row link or by address)
      let contactId = email.contactId
      if (!contactId && email.toAddress) {
        const c = await prisma.contact.findFirst({
          where: { email: email.toAddress },
          select: { id: true },
        }).catch(() => null)
        contactId = c?.id || null
      }
      if (contactId) {
        prisma.activity.create({
          data: {
            type: "EMAIL_OPENED",
            title: `📬 Abrió el email: ${email.subject.slice(0, 80)}`,
            contactId,
          },
        }).catch(() => {})
        // Real engagement signal → nudge the lead score
        prisma.contact.update({
          where: { id: contactId },
          data: { leadScore: { increment: 3 } },
        }).catch(() => {})
      }
    }
  } catch { /* the pixel must always render */ }
  return pixel()
}
