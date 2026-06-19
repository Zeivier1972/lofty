// One-time script: add 3 missed Facebook leads from Jun 18
// Run from Railway Console: node scripts/add-missed-leads.js
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const LEADS = [
  { firstName: "Susan",    lastName: "Chamizo Alfaro", phone: "+13053893888", email: "alfaroamanda@aol.com" },
  { firstName: "McArthur", lastName: "Brinson",        phone: "+17862507238", email: "mbrinson32@gmail.com" },
  { firstName: "Patrick",  lastName: "L",              phone: "+19549256095", email: "ffrogg68@comcast.net"  },
]

const CAMPAIGN = "Silver Parc - No HOA No CDD | Cutler Bay-Kendall"

// 9:00 AM EDT (UTC-4) on Jun 19 2026
const CALL_AT = new Date("2026-06-19T13:00:00.000Z")

async function main() {
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  })
  const newLeadsStage = pipeline?.stages.find(s => s.name === "New Leads") ?? pipeline?.stages[0]

  const ftboPlan = await prisma.smartPlan.findFirst({
    where: { name: { contains: "Compradores de Primera Vez" } },
  })

  for (const lead of LEADS) {
    const phoneDigits = lead.phone.replace(/\D/g, "").slice(-10)

    const existing = await prisma.contact.findFirst({
      where: {
        OR: [
          { email: lead.email },
          { phone: { contains: phoneDigits } },
        ],
      },
    })

    if (existing) {
      console.log(`✓ Already in CRM: ${lead.firstName} ${lead.lastName} (${existing.id})`)
      continue
    }

    const contact = await prisma.contact.create({
      data: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        source: "FACEBOOK",
        status: "LEAD",
        smsTCPAConsent: true,
        smsTCPAConsentDate: new Date("2026-06-18"),
        smsTCPAConsentMethod: "facebook",
      },
    })
    console.log(`+ Created: ${lead.firstName} ${lead.lastName} (${contact.id})`)

    if (newLeadsStage) {
      await prisma.pipelineLead.create({
        data: { contactId: contact.id, stageId: newLeadsStage.id },
      })
    }

    await prisma.note.create({
      data: {
        content: `[Campaña: ${CAMPAIGN}] Lead de Facebook — Jun 18, 2026. Agregado manualmente por falla de webhook.`,
        contactId: contact.id,
      },
    })

    if (ftboPlan) {
      await prisma.smartPlanEnrollment.create({
        data: {
          contactId: contact.id,
          planId: ftboPlan.id,
          status: "ACTIVE",
          currentStep: 0,
          nextStepAt: CALL_AT,
        },
      })
      console.log(`  → Enrolled in: ${ftboPlan.name}`)
    }

    await prisma.scheduledCall.create({
      data: { contactId: contact.id, scheduledAt: CALL_AT, attempt: 1, status: "PENDING" },
    })
    console.log(`  → Call scheduled for 9:00 AM ET`)

    await prisma.aINotification.create({
      data: {
        type: "NEW_LEAD",
        title: `Nuevo lead: ${lead.firstName} ${lead.lastName} — FACEBOOK`,
        body: `Campaña: ${CAMPAIGN} · Tel: ${lead.phone} · Email: ${lead.email}`,
        priority: "HIGH",
        contactId: contact.id,
      },
    })
  }

  await prisma.$disconnect()
  console.log("\nDone! All leads added. Calls scheduled for 9:00 AM ET.")
}

main().catch(e => { console.error(e); process.exit(1) })
