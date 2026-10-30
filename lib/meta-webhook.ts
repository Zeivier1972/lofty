import crypto from "crypto"
import { NextResponse } from "next/server"

/**
 * Meta (Facebook / Instagram) webhook signature check.
 *
 * Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hmac>`,
 * an HMAC-SHA256 of the raw body keyed with the app secret. Without checking
 * it, anyone who knows a webhook URL can post a fake comment or DM and the
 * CRM will create the contact and fire the welcome SMS, email and Sofía call —
 * real spend on a forged event.
 *
 * Rollout is two-step because a wrong secret would silently drop every real
 * event: by default a bad signature is only LOGGED. Once the logs show real
 * traffic verifying, set META_WEBHOOK_ENFORCE_SIGNATURE to "true" (all routes)
 * or a comma list of route labels, e.g. "facebook,instagram".
 *
 * Instagram API with Instagram Login apps sign with the *Instagram* app
 * secret, which can differ from the Facebook one — hence several candidates.
 */

function candidateSecrets(): string[] {
  return [process.env.META_APP_SECRET, process.env.FACEBOOK_APP_SECRET, process.env.INSTAGRAM_APP_SECRET]
    .filter((s): s is string => !!s && s.trim().length > 0)
}

export type SignatureResult = "valid" | "invalid" | "missing" | "unchecked"

export function checkMetaSignature(rawBody: string, header: string | null): SignatureResult {
  const secrets = candidateSecrets()
  if (!secrets.length) return "unchecked"
  if (!header || !header.startsWith("sha256=")) return "missing"
  const given = Buffer.from(header.slice("sha256=".length), "hex")
  for (const secret of secrets) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest()
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return "valid"
  }
  return "invalid"
}

function enforced(label: string): boolean {
  const v = (process.env.META_WEBHOOK_ENFORCE_SIGNATURE || "").trim().toLowerCase()
  if (!v) return false
  if (v === "true" || v === "all") return true
  return v.split(",").map(s => s.trim()).includes(label)
}

/**
 * Read and verify a Meta webhook POST. Returns the parsed body, or a response
 * to send back when the request is rejected (bad JSON, or a failed signature
 * while enforcement is on for this route).
 */
export async function readMetaWebhook(
  req: Request,
  label: string,
): Promise<{ body: any; reject?: undefined } | { body?: undefined; reject: Response }> {
  const raw = await req.text()
  const result = checkMetaSignature(raw, req.headers.get("x-hub-signature-256"))

  if (result !== "valid") {
    const on = enforced(label)
    console.warn(`[meta-webhook] ${label}: signature ${result}${on ? " — rejected" : " (report-only, accepted)"}`)
    if (on) return { reject: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) }
  } else {
    console.log(`[meta-webhook] ${label}: signature valid`)
  }

  try {
    return { body: JSON.parse(raw || "{}") }
  } catch {
    return { reject: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  }
}
