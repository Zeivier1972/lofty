export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"

/**
 * Public, read-only: generated voiceovers and videos (ids are unguessable
 * cuids; the content is what gets published anyway). The URL may carry an
 * extension (/api/media/<id>.mp4) so platforms recognise it as video, and
 * Range requests are answered so phones can play and seek the file.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.[a-z0-9]+$/i, "")
  const m = await prisma.generatedMedia.findUnique({ where: { id } }).catch(() => null)
  if (!m) return new Response("Not found", { status: 404 })
  const data = new Uint8Array(m.data)
  const size = data.length
  const range = req.headers.get("range")
  const match = range?.match(/bytes=(\d*)-(\d*)/)
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : 0
    let end = match[2] ? parseInt(match[2], 10) : size - 1
    if (!match[1] && match[2]) { start = Math.max(0, size - parseInt(match[2], 10)); end = size - 1 }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    end = Math.min(end, size - 1)
    return new Response(data.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": m.mimeType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    })
  }
  return new Response(data, {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
