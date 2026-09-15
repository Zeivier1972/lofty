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
  mlsId?: string
  propertyType?: string
}

const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const num = (v: any) => {
  if (v === null || v === undefined || v === "") return undefined
  const n = Number(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : undefined
}
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ")

// Merge an incoming record onto whatever we already have for that project, so a
// re-import only overwrites the fields it actually carries.
function merge(incoming: any, existing?: Project): Project {
  const photos = Array.isArray(incoming.photos)
    ? incoming.photos.filter(Boolean)
    : str(incoming.imageUrl) ? [str(incoming.imageUrl)!] : undefined

  return {
    id: existing?.id || str(incoming.id) || randomUUID(),
    name: String(incoming.name).trim(),
    developer: str(incoming.developer) ?? existing?.developer ?? "",
    neighborhood: str(incoming.neighborhood) ?? existing?.neighborhood ?? "",
    city: str(incoming.city) ?? existing?.city ?? "Miami",
    zipCode: str(incoming.zipCode) ?? existing?.zipCode,
    priceMin: num(incoming.priceMin) ?? existing?.priceMin,
    priceMax: num(incoming.priceMax) ?? existing?.priceMax,
    bedrooms: str(incoming.bedrooms) ?? existing?.bedrooms,
    deliveryDate: str(incoming.deliveryDate) ?? existing?.deliveryDate,
    status: str(incoming.status) ?? existing?.status ?? "pre_launch",
    description: str(incoming.description) ?? existing?.description,
    url: str(incoming.url) ?? existing?.url,
    investmentHighlights: str(incoming.investmentHighlights) ?? existing?.investmentHighlights,
    estimatedROI: str(incoming.estimatedROI) ?? existing?.estimatedROI,
    downPayment: str(incoming.downPayment) ?? existing?.downPayment,
    units: num(incoming.units) ?? existing?.units,
    photos: photos?.length ? photos : existing?.photos,
    mlsId: str(incoming.mlsId) ?? existing?.mlsId,
    propertyType: str(incoming.propertyType) ?? existing?.propertyType,
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const incoming: any[] = Array.isArray(body) ? body : Array.isArray(body?.projects) ? body.projects : []
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Pega un arreglo JSON de proyectos (o { projects: [...] })" }, { status: 400 })
  }

  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  let projects: Project[] = []
  try { if (row) projects = JSON.parse(row.value) } catch { projects = [] }

  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  incoming.forEach((p, i) => {
    if (!p || typeof p !== "object" || !str(p.name)) {
      skipped.push(`#${i + 1} sin nombre`)
      return
    }
    // Match on id first, then on name — importing the same deck twice updates
    // the existing projects instead of duplicating them.
    let idx = str(p.id) ? projects.findIndex(x => x.id === str(p.id)) : -1
    if (idx < 0) idx = projects.findIndex(x => key(x.name) === key(p.name))

    if (idx >= 0) {
      projects[idx] = merge(p, projects[idx])
      updated.push(projects[idx].name)
    } else {
      const project = merge(p)
      projects.push(project)
      created.push(project.name)
    }
  })

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(projects) },
    create: { key: SETTING_KEY, value: JSON.stringify(projects) },
  })

  return NextResponse.json({
    ok: true,
    created: created.length,
    updated: updated.length,
    skipped,
    names: { created, updated },
    projects,
  })
}
