export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import PreConstructionClient from "./pre-construction-client"

export default async function PreConstructionPage() {
  let projects: any[] = []
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    if (setting) projects = JSON.parse(setting.value)
  } catch {}

  return <PreConstructionClient initialProjects={JSON.parse(JSON.stringify(projects))} />
}
