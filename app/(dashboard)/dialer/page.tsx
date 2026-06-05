import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import DialerClient from "./dialer-client"

export default async function DialerPage() {
  const session = await auth()

  const [contacts, sessions] = await Promise.all([
    prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phone2: true,
        status: true,
        leadScore: true,
      },
      where: { phone: { not: null } },
      orderBy: { leadScore: "desc" },
      take: 100,
    }),
    prisma.dialerSession.findMany({
      where: { agentId: session!.user!.id },
      include: {
        calls: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  return (
    <DialerClient
      contacts={JSON.parse(JSON.stringify(contacts))}
      sessions={JSON.parse(JSON.stringify(sessions))}
    />
  )
}
