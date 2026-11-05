import { timingSafeEqual } from "crypto"

/**
 * Shared secret between the CRM and the Sofía Zoom bot service
 * (zoom-bot/, a separate Railway service). The bot sends it on its calls to
 * /api/zoom-sofia/answer and /report; the CRM sends it to the bot's control
 * server. Same SOFIA_BOT_SECRET value on both services.
 */
export const SOFIA_BOT_HEADER = "x-sofia-bot-secret"

export function isSofiaBot(req: Request): boolean {
  const secret = process.env.SOFIA_BOT_SECRET
  const got = req.headers.get(SOFIA_BOT_HEADER)
  if (!secret || !got) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Private-network URL of the bot's control server, e.g. http://sofia-zoom-bot.railway.internal:8080 */
export const SOFIA_BOT_URL = (process.env.SOFIA_BOT_URL || "").replace(/\/$/, "")
