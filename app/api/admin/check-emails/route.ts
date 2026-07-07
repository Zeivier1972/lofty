import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Find all contacts that have import notes
    const importedContacts = await prisma.contact.findMany({
      where: {
        notes: {
          some: {
            content: {
              contains: "[Importado de Lofty]",
            },
          },
        },
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    })

    const withEmail = importedContacts.filter((c) => c.email)
    const withoutEmail = importedContacts.filter((c) => !c.email)

    const coverage = importedContacts.length > 0
      ? ((withEmail.length / importedContacts.length) * 100).toFixed(2)
      : "0.00"

    return NextResponse.json({
      summary: {
        totalImported: importedContacts.length,
        withEmail: withEmail.length,
        withoutEmail: withoutEmail.length,
        coveragePercent: coverage,
      },
      missingEmailSamples: withoutEmail.slice(0, 10).map(c => ({
        name: `${c.firstName} ${c.lastName}`,
        phone: c.phone || "N/A",
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
