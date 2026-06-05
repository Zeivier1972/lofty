import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await req.json()
    const lead = await prisma.pipelineLead.update({
      where: { id: params.id },
      data,
      include: { contact: true, stage: true },
    })

    if (data.stageId && lead.contactId) {
      await prisma.activity.create({
        data: {
          type: "PIPELINE_MOVED",
          title: `Moved to ${lead.stage.name}`,
          contactId: lead.contactId,
          userId: session.user!.id,
        },
      })
    }

    return NextResponse.json(lead)
  } catch {
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}
