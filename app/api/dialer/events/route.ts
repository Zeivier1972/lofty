export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { registerSSE, unregisterSSE, sendSSE } from "@/lib/dialer-sse"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const agentId = session.user.id
  let ctrl: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller
      registerSSE(agentId, ctrl)
      // Send initial connection confirmation
      const msg = `event: connected\ndata: ${JSON.stringify({ agentId })}\n\n`
      ctrl.enqueue(new TextEncoder().encode(msg))
    },
    cancel() {
      unregisterSSE(agentId, ctrl)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
