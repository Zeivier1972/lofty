export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"
import LenderLeadClient from "./lead-client"

export default async function LenderLeadPage({ params }: { params: { id: string } }) {
  const partner = await getLoanOfficer()
  if (!partner) redirect("/lender/login")

  const share = await prisma.leadShare.findUnique({
    where: { id: params.id },
    include: {
      contact: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, email: true,
          buyerBudgetMax: true, buyerBudgetMin: true, buyerLocation: true,
          buyerPropertyType: true, buyerBedroomsMin: true, source: true, createdAt: true,
        },
      },
      notes: { orderBy: { createdAt: "desc" } },
    },
  })

  const canAccess = share &&
    share.loanOfficerId === partner.id &&
    (share.status === "PAID" || share.status === "ACTIVE")

  if (!canAccess) redirect("/lender")

  const [smsMessages, emails, crmNotes, crmActivities] = await Promise.all([
    prisma.sMSMessage.findMany({
      where: { contactId: share.contact.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.email.findMany({
      where: { contactId: share.contact.id },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, subject: true, toAddress: true, fromAddress: true, createdAt: true },
    }),
    // Catherine's notes on this lead — so the LO sees them (shared, both ways).
    prisma.note.findMany({
      where: { contactId: share.contact.id },
      orderBy: { createdAt: "desc" }, take: 25,
      select: { id: true, content: true, createdAt: true, author: { select: { name: true } } },
    }).catch(() => []),
    prisma.activity.findMany({
      where: { contactId: share.contact.id },
      orderBy: { createdAt: "desc" }, take: 40,
      select: { id: true, type: true, title: true, description: true, createdAt: true },
    }).catch(() => []),
  ])

  // Merged history the LO can see: Catherine's notes + lead activity.
  const iconFor = (t: string) => /EMAIL/i.test(t) ? "📬" : /CALL/i.test(t) ? "📞" : /SMS|TEXT|WHATSAPP/i.test(t) ? "💬" : /SAVE|PROPERTY/i.test(t) ? "💜" : /NOTE/i.test(t) ? "📝" : "•"
  const history = [
    ...(crmNotes as any[]).map(n => ({ id: `n-${n.id}`, ts: n.createdAt.toISOString(), icon: "📝", who: n.author?.name || "Catherine", text: n.content })),
    ...(crmActivities as any[]).filter(a => !(a.type === "NOTE_ADDED" && !a.description)).map(a => ({ id: `a-${a.id}`, ts: a.createdAt.toISOString(), icon: iconFor(a.type), who: "", text: [a.title, a.description].filter(Boolean).join(" — ") })),
  ].sort((x, y) => (x.ts < y.ts ? 1 : -1)).slice(0, 60)

  return (
    <LenderLeadClient
      shareId={share.id}
      loStatus={share.loStatus}
      contact={{
        firstName: share.contact.firstName,
        lastName: share.contact.lastName,
        phone: share.contact.phone,
        email: share.contact.email,
        budgetMax: share.contact.buyerBudgetMax,
        budgetMin: share.contact.buyerBudgetMin,
        location: share.contact.buyerLocation,
        propertyType: share.contact.buyerPropertyType,
        bedroomsMin: share.contact.buyerBedroomsMin,
        source: share.contact.source,
        createdAt: share.contact.createdAt.toISOString(),
      }}
      messages={smsMessages.map(m => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        createdAt: m.createdAt.toISOString(),
      }))}
      emails={emails.map(e => ({
        id: e.id,
        subject: e.subject,
        createdAt: e.createdAt.toISOString(),
      }))}
      notes={share.notes.map(n => ({
        id: n.id,
        author: n.author,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
      }))}
      history={history}
    />
  )
}
