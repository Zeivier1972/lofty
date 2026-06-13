export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// POST — share a lead with a loan officer
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, loanOfficerId } = await req.json()
  if (!contactId || !loanOfficerId) {
    return NextResponse.json({ error: "contactId y loanOfficerId requeridos" }, { status: 400 })
  }

  const [contact, partner] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId } }),
    prisma.loanOfficer.findUnique({ where: { id: loanOfficerId } }),
  ])
  if (!contact) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 })
  if (!partner || !partner.isActive) return NextResponse.json({ error: "Loan officer no encontrado o inactivo" }, { status: 404 })

  const existing = await prisma.leadShare.findUnique({
    where: { contactId_loanOfficerId: { contactId, loanOfficerId } },
  })
  if (existing && existing.status !== "REVOKED") {
    return NextResponse.json({ error: "Este lead ya fue compartido con este loan officer" }, { status: 409 })
  }

  const share = existing
    ? await prisma.leadShare.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", price: 0, paidAt: null, stripeSessionId: null },
      })
    : await prisma.leadShare.create({
        data: { contactId, loanOfficerId, price: 0, status: "ACTIVE" },
      })

  await prisma.activity.create({
    data: {
      type: "NOTE",
      title: `Lead compartido con loan officer`,
      description: `Compartido con ${partner.name}${partner.company ? ` (${partner.company})` : ""}`,
      contactId,
    },
  }).catch(() => {})

  sendEmail({
    to: partner.email,
    subject: `🆕 Nuevo lead disponible — Catherine Gomez Realtor`,
    html: `<p>Hola ${partner.name},</p><p>Catherine te compartió un nuevo lead pre-calificado interesado en propiedad en Miami.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lender" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Ver lead en el portal →</a></p>`,
    text: `Hola ${partner.name}, Catherine te compartió un nuevo lead. Míralo en ${process.env.NEXT_PUBLIC_APP_URL}/lender`,
  }).catch(() => {})

  return NextResponse.json({ share: { id: share.id, status: share.status } })
}
