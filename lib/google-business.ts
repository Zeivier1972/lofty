/**
 * Google Business Profile — publishing Local Posts to Catherine's listing.
 *
 * Posts on the Business Profile reach people at the moment they are searching
 * for a realtor in Miami, and they feed the same local signals that decide
 * which single business a voice assistant names. The CRM already writes the
 * copy — `PLATFORM_GUIDES.GOOGLE_BUSINESS` has existed for a while — it just
 * had nowhere to send it.
 *
 * ACCESS: the Business Profile APIs are not open. Until Google approves the
 * Cloud project's access request the quota stays at 0 requests per minute and
 * every call returns 429, so none of this can run before that lands. The
 * failure is reported plainly rather than retried, because retrying a 429 that
 * means "not allowlisted" just burns the schedule.
 *
 * Two API surfaces are involved, which is easy to get wrong: accounts and
 * locations come from the newer split services, while Local Posts still live
 * on v4.
 */

const V4 = "https://mybusiness.googleapis.com/v4"
const ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1"
const BUSINESS_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1"

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage"

/**
 * OAuth client. A dedicated credential is preferred, but the YouTube one is
 * accepted as a fallback: it is the same Google Cloud project in practice, and
 * requiring a second client just to add a scope is friction for no benefit.
 * Whichever is used needs the Business Profile API enabled on that project and
 * this app's callback listed as an authorised redirect URI.
 */
export function googleOAuthClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const creds = googleOAuthClient()
  if (!creds) {
    throw new Error("Faltan GOOGLE_BUSINESS_CLIENT_ID / GOOGLE_BUSINESS_CLIENT_SECRET (o las de YouTube) en Railway")
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const detail = data.error === "invalid_grant"
      ? "el token de Google expiró o fue revocado — reconecta Google Business en Ajustes → Redes Sociales"
      : (data.error_description || data.error || `HTTP ${res.status}`)
    throw new Error(`No se pudo renovar el acceso a Google Business: ${detail}`)
  }
  return data.access_token as string
}

/* ------------------------------------------------------- content hygiene --- */

/**
 * Three things in the copy this CRM writes for Facebook and Instagram will get
 * a Google post rejected or make it read badly, so they are stripped rather
 * than left to the model to remember:
 *
 *  - PHONE NUMBERS. Google wants callers to use the Call button on the profile
 *    and removes posts that put a number in the body. The generator is told to
 *    sign off with "Catherine Gomez | Realtor · 305-283-0872", so every post
 *    would carry one.
 *  - HASHTAGS. They do nothing on a Business Profile; the Instagram guide
 *    appends twelve of them.
 *  - LENGTH. The cap is 1,500 characters and only the first ~100 show in the
 *    preview, so an over-long post is truncated at a sentence boundary instead
 *    of being cut mid-word by Google.
 */
export const GOOGLE_POST_MAX = 1500

export function sanitizeForGoogle(raw: string): string {
  let t = raw ?? ""

  // Phone numbers: +1 305-283-0872, (305) 283-0872, 305.283.0872, 3052830872.
  const PHONE = /(\+?\d{1,2}[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g
  // A trailing signature line is removed whole — dropping just the number would
  // leave "Catherine Gomez | Realtor ·" dangling.
  t = t.replace(/^.*\|\s*Realtor\s*[·|-].*$/gim, "")
  t = t.replace(PHONE, "")

  // Hashtags, inline or as a trailing block. Spanish letters are spelled out
  // rather than matched with \p{L}: the Unicode property escape needs the `u`
  // flag, which this project's TypeScript target does not allow.
  t = t.replace(/(^|\s)#[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]+/g, "$1")

  // Tidy up what the removals left behind.
  t = t
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Separators orphaned by a deleted number, e.g. "Llámame al  ·" or "— ()".
    .replace(/[ \t]*[·|]\s*$/gm, "")
    .replace(/\(\s*\)/g, "")
    .trim()

  if (t.length > GOOGLE_POST_MAX) {
    const cut = t.slice(0, GOOGLE_POST_MAX)
    // Prefer the last sentence end, then the last space, so Google does not cut
    // it mid-word. Only accept a break that keeps most of the text.
    const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("\n"))
    const space = cut.lastIndexOf(" ")
    const floor = Math.floor(GOOGLE_POST_MAX * 0.6)
    if (sentence > floor) t = cut.slice(0, sentence + 1).trim()
    else if (space > floor) t = cut.slice(0, space).trim()
    else t = cut.trim()
  }
  return t
}

/* ------------------------------------------------------------ discovery --- */

export type GoogleLocation = { name: string; title: string; accountName: string }

/**
 * Find the location to post to. A realtor normally manages exactly one, so the
 * first is used, but every one found is returned so the caller can say which it
 * picked instead of silently choosing.
 */
export async function listLocations(accessToken: string): Promise<GoogleLocation[]> {
  const accRes = await fetch(`${ACCOUNT_MGMT}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const accData: any = await accRes.json().catch(() => ({}))
  if (!accRes.ok) throw new Error(describeApiError(accRes.status, accData, "listar las cuentas"))

  const out: GoogleLocation[] = []
  for (const acc of (accData.accounts ?? []) as any[]) {
    const url = `${BUSINESS_INFO}/${acc.name}/locations?readMask=name,title&pageSize=100`
    const locRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const locData: any = await locRes.json().catch(() => ({}))
    if (!locRes.ok) continue
    for (const loc of (locData.locations ?? []) as any[]) {
      // `loc.name` is "locations/123"; Local Posts need the account-qualified
      // "accounts/456/locations/123".
      const bare = String(loc.name).replace(/^locations\//, "")
      out.push({ name: `${acc.name}/locations/${bare}`, title: loc.title ?? "Business Profile", accountName: acc.name })
    }
  }
  return out
}

/* ------------------------------------------------------------ publishing --- */

export type GooglePostInput = {
  /** "accounts/{id}/locations/{id}" */
  locationName: string
  refreshToken: string
  content: string
  /** A single photo. Google takes one image per post and no video or GIF. */
  mediaUrl?: string | null
  /** Button target. Without a URL the post gets no call to action. */
  ctaUrl?: string | null
  languageCode?: string
}

export async function publishGoogleBusinessPost(input: GooglePostInput): Promise<string> {
  const { locationName, refreshToken, mediaUrl, ctaUrl, languageCode = "es" } = input

  const summary = sanitizeForGoogle(input.content)
  if (!summary) throw new Error("Google Business: el texto quedó vacío después de quitar teléfono y hashtags")

  const accessToken = await refreshAccessToken(refreshToken)

  const body: Record<string, unknown> = { languageCode, summary, topicType: "STANDARD" }
  if (ctaUrl) body.callToAction = { actionType: "LEARN_MORE", url: ctaUrl }

  // Video and GIF are not supported; sending one fails the whole post, so a
  // non-photo media URL is dropped and the post goes out as text.
  if (mediaUrl && isPhoto(mediaUrl)) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: mediaUrl }]
  }

  const res = await fetch(`${V4}/${locationName}/localPosts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(describeApiError(res.status, data, "publicar el post"))

  return (data.name as string) ?? ""
}

function isPhoto(url: string): boolean {
  if (/\.(mp4|mov|avi|m4v|webm|gif)(\?|$)/i.test(url)) return false
  if (/heygen|creatomate/i.test(url)) return false
  return true
}

/**
 * Turn an API failure into something actionable. A 429 here almost never means
 * "slow down" — it means the Cloud project has not been allowlisted and its
 * quota is still zero, which no amount of retrying fixes.
 */
function describeApiError(status: number, data: any, action: string): string {
  const msg = data?.error?.message || data?.error_description || data?.error || `HTTP ${status}`
  if (status === 429) {
    return `Google Business: no se pudo ${action} — cuota 0. La API de Google Business Profile no está habilitada para este proyecto todavía: hay que pedir acceso a Google y esperar la aprobación (hasta ~14 días). Detalle: ${msg}`
  }
  if (status === 401 || status === 403) {
    return `Google Business: no se pudo ${action} — sin permiso (${status}). Revisa que el scope sea business.manage y que la cuenta conectada administre el perfil. Detalle: ${msg}`
  }
  return `Google Business: no se pudo ${action} — ${msg}`
}
