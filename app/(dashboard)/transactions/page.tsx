export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import TransactionsClient from "./transactions-client"

export default async function TransactionsPage() {
  let transactions: any[] = []
  let stats: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    ;[transactions, stats] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...(userId && { agentId: userId }) },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          milestones: { orderBy: { order: "asc" } },
          _count: { select: { documents: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: { ...(userId && { agentId: userId }) },
        _count: true,
        _sum: { salePrice: true },
      }),
    ])
  } catch (e) {
    console.error("Transactions page error:", e)
  }

  return (
    <TransactionsClient
      transactions={JSON.parse(JSON.stringify(transactions))}
      stats={JSON.parse(JSON.stringify(stats))}
    />
  )
}
