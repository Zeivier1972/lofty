export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CMAClient from "./cma-client"

export default async function CMAPage() {
  const session = await auth()

  const [reports, contacts] = await Promise.all([
    prisma.cMAReport.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contact.findMany({
      where: { isArchived: false },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
      take: 200,
    }),
  ])

  return (
    <CMAClient
      reports={JSON.parse(JSON.stringify(reports))}
      contacts={JSON.parse(JSON.stringify(contacts))}
    />
  )
}
