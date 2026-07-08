export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import PipelineClient from "./pipeline-client"

export default async function PipelinePage() {
  let pipeline = null
  let allPipelines: any[] = []

  try {
    ;[allPipelines, pipeline] = await Promise.all([
      prisma.pipeline.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.pipeline.findFirst({
        where: { isDefault: true },
        include: {
          stages: {
            include: {
              leads: {
                include: {
                  // Only the fields the kanban cards render — not the full contact record
                  contact: {
                    select: {
                      id: true, firstName: true, lastName: true, phone: true, email: true,
                      lastContacted: true, source: true, createdAt: true,
                      tags: { include: { tag: true } },
                    },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      }),
    ])
  } catch (e) {
    console.error("Pipeline page error:", e)
  }

  return (
    <PipelineClient
      pipeline={JSON.parse(JSON.stringify(pipeline))}
      allPipelines={JSON.parse(JSON.stringify(allPipelines))}
    />
  )
}
