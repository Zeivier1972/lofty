// In-memory SSE client registry for real-time dialer events
// Keyed by agentId (user ID)

type SSEController = ReadableStreamDefaultController

const clients = new Map<string, Set<SSEController>>()

export function registerSSE(agentId: string, ctrl: SSEController) {
  if (!clients.has(agentId)) clients.set(agentId, new Set())
  clients.get(agentId)!.add(ctrl)
}

export function unregisterSSE(agentId: string, ctrl: SSEController) {
  clients.get(agentId)?.delete(ctrl)
}

export function sendSSE(agentId: string, event: string, data: object) {
  const conns = clients.get(agentId)
  if (!conns?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(msg)
  Array.from(conns).forEach(ctrl => {
    try { ctrl.enqueue(encoded) } catch {}
  })
}
