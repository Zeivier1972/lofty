export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import PipelineClient from "./pipeline-client"

export default async function PipelinePage() {
  const [pipelines, pipeline] = await Promise.all([
    prisma.pipeline.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: {
        stages: {
          include: {
            leads: {
              include: {
                contact: {
                  include: {
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

  return (
    <PipelineClient
      pipeline={JSON.parse(JSON.stringify(pipeline))}
      allPipelines={JSON.parse(JSON.stringify(pipelines))}
    />
  )
}
