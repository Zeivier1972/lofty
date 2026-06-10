export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const STAGES = [
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

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pipeline = await prisma.pipeline.findFirst({ where: { isDefault: true } })
  if (!pipeline) return NextResponse.json({ error: "No default pipeline" }, { status: 404 })

  const existing = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    select: { name: true, order: true },
  })
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()))
  const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), 0)

  const toCreate = STAGES.filter(s => !existingNames.has(s.name.toLowerCase()))
  let order = maxOrder + 1
  const created: string[] = []

  for (const stage of toCreate) {
    await prisma.pipelineStage.create({
      data: { pipelineId: pipeline.id, name: stage.name, color: stage.color, order: order++ },
    })
    created.push(stage.name)
  }

  return NextResponse.json({ added: created.length, stages: created })
}
