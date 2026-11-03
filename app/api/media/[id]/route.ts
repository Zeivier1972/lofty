export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"

/**
 * Public, read-only: generated voiceovers for the video renderer. Ids are
 * unguessable cuids and the content is narration that gets published anyway.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await prisma.generatedMedia.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!m) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Length": String(m.data.length),
      "Cache-Control": "public, max-age=86400",
    },
  })
}
