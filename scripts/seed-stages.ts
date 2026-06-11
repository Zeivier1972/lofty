import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DESIRED_STAGES = [
  { name: "Do Not Contact",       color: "#EF4444" },
  { name: "New",                  color: "#6366F1" },
  { name: "Contacted 1",          color: "#3B82F6" },
  { name: "Contacted 2",          color: "#2563EB" },
  { name: "Contacted 3",          color: "#1D4ED8" },
  { name: "Contacted 4",          color: "#1E40AF" },
  { name: "Nurturing/Cold",       color: "#94A3B8" },
  { name: "Warm",                 color: "#F97316" },
  { name: "Hot",                  color: "#EF4444" },
  { name: "Drip Campaign",        color: "#14B8A6" },
  { name: "Appointment Set",      color: "#10B981" },
  { name: "Showing",              color: "#059669" },
  { name: "Pending",              color: "#F59E0B" },
  { name: "Pre approval",         color: "#22C55E" },
  { name: "Pre-construction",     color: "#F59E0B" },
  { name: "Preconstruction",      color: "#D97706" },
  { name: "Resale",               color: "#8B5CF6" },
  { name: "International Invest", color: "#7C3AED" },
  { name: "Inversionista Bogota", color: "#6D28D9" },
  { name: "Realtor",              color: "#0EA5E9" },
  { name: "Quick lending Colomb", color: "#0891B2" },
  { name: "Won",                  color: "#16A34A" },
  { name: "Closed",               color: "#15803D" },
  { name: "Lost",                 color: "#DC2626" },
  { name: "Bad Leads",            color: "#6B7280" },
  { name: "Rental",               color: "#A855F7" },
  { name: "Unqualified",          color: "#9CA3AF" },
  { name: "Churned",              color: "#6B7280" },
]

async function main() {
  const pipeline = await prisma.pipeline.findFirst({ where: { isDefault: true } })
  if (!pipeline) {
    console.error("No default pipeline found. Open the Contacts page first to auto-create it.")
    return
  }
  console.log(`Found pipeline: ${pipeline.name} (${pipeline.id})`)

  const existing = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    select: { name: true, order: true },
  })
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()))
  const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), 0)

  const toCreate = DESIRED_STAGES.filter(s => !existingNames.has(s.name.toLowerCase()))
  console.log(`Existing stages: ${existing.length}`)
  console.log(`Stages to add: ${toCreate.length}`)

  let order = maxOrder + 1
  for (const stage of toCreate) {
    await prisma.pipelineStage.create({
      data: { pipelineId: pipeline.id, name: stage.name, color: stage.color, order: order++ },
    })
    console.log(`  ✓ Created: ${stage.name}`)
  }

  console.log("\nDone!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
