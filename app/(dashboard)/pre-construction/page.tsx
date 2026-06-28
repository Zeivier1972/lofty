export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import PreConstructionClient from "./pre-construction-client"

export default async function PreConstructionPage() {
  let projects: any[] = []
  let scrapedCount: number | undefined
  let scrapedAt: string | undefined

  const [manualRow, scrapedRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "preconstruction_projects" } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: "preconstruction_scraped" } }).catch(() => null),
  ])

  try { if (manualRow) projects = JSON.parse(manualRow.value) } catch {}
  try {
    if (scrapedRow) {
      const parsed = JSON.parse(scrapedRow.value)
      scrapedCount = parsed.count ?? (Array.isArray(parsed) ? parsed.length : 0)
      scrapedAt = parsed.scrapedAt
    }
  } catch {}

  return (
    <PreConstructionClient
      initialProjects={JSON.parse(JSON.stringify(projects))}
      scrapedCount={scrapedCount}
      scrapedAt={scrapedAt}
    />
  )
}
