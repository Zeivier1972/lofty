// In-memory SSE client registry for real-time dialer events.
// Keyed by agentId (user ID). Works for single-process deployments (Railway).

type SSEController = ReadableStreamDefaultController<Uint8Array>

const clients = new Map<string, Set<SSEController>>()

export function registerSSE(agentId: string, ctrl: SSEController) {
  if (!clients.has(agentId)) clients.set(agentId, new Set())
  clients.get(agentId)!.add(ctrl)
}

export function unregisterSSE(agentId: string, ctrl: SSEController) {
  clients.get(agentId)?.delete(ctrl)
  if (clients.get(agentId)?.size === 0) clients.delete(agentId)
}

export function sendSSE(agentId: string, event: string, data: object) {
  const conns = clients.get(agentId)
  if (!conns?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(msg)
  conns.forEach(ctrl => {
    try { ctrl.enqueue(encoded) } catch { /* client disconnected */ }
  })
}

// Broadcast to ALL connected agents (admin use)
export function broadcastSSE(event: string, data: object) {
  clients.forEach((_, agentId) => sendSSE(agentId, event, data))
}
