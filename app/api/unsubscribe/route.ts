export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/unsubscribe?id=contactId  — one-click unsubscribe (no auth needed)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const email = searchParams.get("email")

  try {
    if (id) {
      await prisma.contact.update({ where: { id }, data: { doNotEmail: true } })
    } else if (email) {
      await prisma.contact.updateMany({ where: { email }, data: { doNotEmail: true } })
    } else {
      return new Response("Missing id or email", { status: 400 })
    }

    return new Response(
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:500px;margin:60px auto;text-align:center;color:#374151">
<h2 style="color:#4F46E5">✅ Cancelado</h2>
<p>Has sido eliminado de nuestra lista de correos.</p>
<p style="color:#9CA3AF;font-size:14px">You have been unsubscribed from our email list.</p>
</body></html>`,
      { headers: { "Content-Type": "text/html" } }
    )
  } catch {
    return new Response("Error", { status: 500 })
  }
}
