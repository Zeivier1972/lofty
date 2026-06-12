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

  if (!share || share.loanOfficerId !== partner.id || share.status !== "PAID") {
    redirect("/lender")
  }

  const [smsMessages, emails] = await Promise.all([
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
  ])

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
    />
  )
}
