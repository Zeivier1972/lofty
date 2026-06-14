export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TransactionDetailClient from "./transaction-detail-client"

export default async function TransactionDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect("/login")

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      milestones: { orderBy: { order: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!transaction) redirect("/transactions")

  return <TransactionDetailClient transaction={JSON.parse(JSON.stringify(transaction))} />
}
