import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import TransactionsClient from "./transactions-client"

export default async function TransactionsPage() {
  const session = await auth()
  const userId = session?.user?.id

  const [transactions, stats] = await Promise.all([
    prisma.transaction.findMany({
      where: { agentId: userId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        milestones: { orderBy: { order: "asc" } },
        _count: { select: { documents: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.transaction.groupBy({
      by: ["status"],
      where: { agentId: userId },
      _count: true,
      _sum: { salePrice: true },
    }),
  ])

  return (
    <TransactionsClient
      transactions={JSON.parse(JSON.stringify(transactions))}
      stats={JSON.parse(JSON.stringify(stats))}
    />
  )
}
