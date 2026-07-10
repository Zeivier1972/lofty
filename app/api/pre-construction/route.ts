export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

const SETTING_KEY = "preconstruction_projects"

type Project = {
  id: string
  name: string
  developer: string
  neighborhood: string
  city: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  status: string
  description?: string
  url?: string
  investmentHighlights?: string
  estimatedROI?: string
  downPayment?: string
  units?: number
  photos?: string[]
  mlsId?: string        // agent-facing only — never sent to leads
  propertyType?: string // e.g. Single Family Residence, Condominium, Townhouse
}

async function getProjects(): Promise<Project[]> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

async function saveProjects(projects: Project[]) {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(projects) },
    create: { key: SETTING_KEY, value: JSON.stringify(projects) },
  })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getProjects())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, name, developer, neighborhood, city, zipCode, priceMin, priceMax, bedrooms,
    deliveryDate, status, description, url, investmentHighlights, estimatedROI, downPayment, units,
    photos, imageUrl, mlsId, propertyType } = body

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const projects = await getProjects()
  const existing = projects.findIndex(p => p.id === id)

  // Resolve the project photo(s): accept an explicit photos array or a single
  // imageUrl; on edit, keep the existing photo if none was provided this time.
  let resolvedPhotos: string[] | undefined
  if (Array.isArray(photos)) resolvedPhotos = photos.filter(Boolean)
  else if (typeof imageUrl === "string" && imageUrl.trim()) resolvedPhotos = [imageUrl.trim()]
  else if (existing >= 0) resolvedPhotos = projects[existing].photos

  const project: Project = {
    id: id || randomUUID(),
    name: name.trim(),
    developer: developer?.trim() || "",
    neighborhood: neighborhood?.trim() || "",
    city: city?.trim() || "Miami",
    zipCode: zipCode?.trim() || undefined,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    bedrooms: bedrooms?.trim() || undefined,
    deliveryDate: deliveryDate?.trim() || undefined,
    status: status || "pre_launch",
    description: description?.trim() || undefined,
    url: url?.trim() || undefined,
    investmentHighlights: investmentHighlights?.trim() || undefined,
    estimatedROI: estimatedROI?.trim() || undefined,
    downPayment: downPayment?.trim() || undefined,
    units: units ? Number(units) : undefined,
    photos: resolvedPhotos && resolvedPhotos.length ? resolvedPhotos : undefined,
    mlsId: mlsId?.trim() || (existing >= 0 ? projects[existing].mlsId : undefined),
    propertyType: propertyType?.trim() || (existing >= 0 ? projects[existing].propertyType : undefined),
  }

  if (existing >= 0) projects[existing] = project
  else projects.push(project)

  await saveProjects(projects)
  return NextResponse.json(project)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const projects = await getProjects()
  await saveProjects(projects.filter(p => p.id !== id))
  return NextResponse.json({ ok: true })
}
