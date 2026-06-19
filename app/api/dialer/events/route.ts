export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { registerSSE, unregisterSSE, sendSSE } from "@/lib/dialer-sse"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = session.user.id

  let ctrl: ReadableStreamDefaultController
  const stream = new ReadableStream({
    start(controller) {
      ctrl = controller
      registerSSE(userId, ctrl)

      // Send connected event immediately
      const msg = `event: connected\ndata: ${JSON.stringify({ userId })}\n\n`
      ctrl.enqueue(new TextEncoder().encode(msg))
    },
    cancel() {
      unregisterSSE(userId, ctrl)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
