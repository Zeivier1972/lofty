const IG_API = "https://graph.facebook.com/v19.0"

function getToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN
}

function getAccountId() {
  return process.env.INSTAGRAM_ACCOUNT_ID
}

// Send a DM to an Instagram user
export async function sendInstagramDM(igUserId: string, text: string): Promise<boolean> {
  const token = getToken()
  const accountId = getAccountId()
  if (!token || !accountId) {
    console.warn("[INSTAGRAM] INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID not set")
    return false
  }
  try {
    const res = await fetch(
      `${IG_API}/${accountId}/messages?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: igUserId },
          message: { text },
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      console.error("[INSTAGRAM] DM error:", data)
      return false
    }
    return true
  } catch (e) {
    console.error("[INSTAGRAM] sendDM exception:", e)
    return false
  }
}

// Private reply to a comment (sends a DM to the commenter)
export async function replyToComment(commentId: string, text: string): Promise<boolean> {
  const token = getToken()
  if (!token) return false
  try {
    const res = await fetch(
      `${IG_API}/${commentId}/private_replies?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      console.error("[INSTAGRAM] private reply error:", data)
      return false
    }
    return true
  } catch (e) {
    console.error("[INSTAGRAM] replyToComment exception:", e)
    return false
  }
}

// Verify webhook signature
export function verifyWebhookToken(token: string): boolean {
  return token === (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "lofty_ig_verify")
}

// Extract email from text
export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase() : null
}

// Extract phone from text
export function extractPhone(text: string): string | null {
  const cleaned = text.replace(/[^\d+\s()-]/g, " ")
  const match = cleaned.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)
  if (!match) return null
  const digits = match[0].replace(/\D/g, "").slice(-10)
  return digits.length === 10 ? digits : null
}

// Check if message is an opt-out
export function isOptOut(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return ["stop", "unsubscribe", "no", "detener", "parar", "basta", "remove"].some(w => lower.includes(w))
}
