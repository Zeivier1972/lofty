import crypto from "crypto"

/**
 * Parser for Meta's `signed_request`, the payload sent to the Data Deletion
 * Callback and to Facebook Login's deauthorize callback.
 *
 * Format is "<base64url signature>.<base64url payload>", where the signature is
 * an HMAC-SHA256 over the raw payload *segment* (the encoded text, not the
 * decoded JSON) keyed with the app secret.
 */

export interface SignedRequest {
  user_id?: string
  algorithm?: string
  issued_at?: number
  [key: string]: unknown
}

export function b64urlDecode(segment: string): Buffer {
  return Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

/**
 * Returns the decoded payload, or null if the request is malformed, uses an
 * algorithm we do not accept, or fails signature verification.
 */
export function parseSignedRequest(
  signed: string,
  appSecret: string,
): SignedRequest | null {
  if (!signed || !appSecret) return null

  const dot = signed.indexOf(".")
  if (dot <= 0 || dot === signed.length - 1) return null
  const encodedSig = signed.slice(0, dot)
  const payload = signed.slice(dot + 1)

  let data: SignedRequest
  try {
    data = JSON.parse(b64urlDecode(payload).toString("utf8"))
  } catch {
    return null
  }
  if (!data || typeof data !== "object") return null

  // Reject anything but HMAC-SHA256 — notably "none", which would otherwise
  // let an unsigned payload through.
  if (String(data.algorithm || "").toUpperCase() !== "HMAC-SHA256") {
    console.error("[FB SIGNED REQUEST] unexpected algorithm:", data.algorithm)
    return null
  }

  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest()
  const actual = b64urlDecode(encodedSig)
  if (expected.length !== actual.length) return null
  if (!crypto.timingSafeEqual(expected, actual)) {
    console.error("[FB SIGNED REQUEST] signature mismatch")
    return null
  }

  return data
}

/** Builds a signed_request the way Meta does. Used by the verification script. */
export function buildSignedRequest(
  payload: Record<string, unknown>,
  appSecret: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const sig = crypto
    .createHmac("sha256", appSecret)
    .update(encoded)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  return `${sig}.${encoded}`
}
