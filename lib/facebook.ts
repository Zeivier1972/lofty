const GRAPH = "https://graph.facebook.com/v25.0"

import crypto from "crypto"

// Page Access Token — used for Messenger, lead form creation, page posts
function token() {
  return process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
}

// Send a private Messenger reply to a Facebook page post commenter
export async function privateReplyToComment(commentId: string, message: string): Promise<boolean> {
  const tok = token()
  if (!tok) return false
  try {
    const res = await fetch(`${GRAPH}/${commentId}/private_replies?access_token=${tok}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error("[FB] privateReplyToComment error:", data)
      return false
    }
    return true
  } catch (e) {
    console.error("[FB] privateReplyToComment exception:", e)
    return false
  }
}

// Post a public comment reply on a Facebook post comment
export async function postPublicCommentReply(commentId: string, message: string): Promise<boolean> {
  const tok = token()
  if (!tok) return false
  try {
    const res = await fetch(`${GRAPH}/${commentId}/comments?access_token=${tok}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error("[FB] postPublicCommentReply error:", data)
      return false
    }
    return true
  } catch (e) {
    console.error("[FB] postPublicCommentReply exception:", e)
    return false
  }
}

// Extract a valid email address from free-form text
export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase() : null
}

// Extract a phone number from text and normalise to +1XXXXXXXXXX
export function extractPhone(text: string): string | null {
  const cleaned = text.replace(/[^\d+\s()-]/g, " ")
  const match = cleaned.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)
  if (!match) return null
  const digits = match[0].replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) return null
  return `+1${digits}`
}

// Check if message is an opt-out request
export function isOptOut(text: string): boolean {
  const lower = text.toLowerCase().trim()
  if (lower === "no" || lower === "no gracias" || lower === "no, gracias") return true
  return ["stop", "unsubscribe", "detener", "parar", "basta", "remove"].some(w =>
    new RegExp(`\\b${w}\\b`).test(lower)
  )
}

// Parse buyer intent from an A/B/C qualification reply
export function parseIntent(text: string): string | null {
  const lower = text.toLowerCase().trim()
  const first = lower.charAt(0)
  if (first === "a" && lower.length <= 3) return "comprador_vivienda"
  if (first === "b" && lower.length <= 3) return "inversionista"
  if (first === "c" && lower.length <= 3) return "explorando"
  if (/vivir|comprar para|para vivir|vivienda/.test(lower)) return "comprador_vivienda"
  if (/airbnb|invertir|inversi[oó]n|renta/.test(lower)) return "inversionista"
  if (/explorando|explorar|curios|solo/.test(lower)) return "explorando"
  return null
}

// User Access Token — required for ad account operations (campaigns, ad sets, creatives, ads)
function userToken() {
  return process.env.FB_USER_ACCESS_TOKEN || token()
}

export async function sendFacebookMessage(psid: string, text: string): Promise<string | null> {
  if (!token()) { console.error("[FB] sendFacebookMessage: FB_PAGE_ACCESS_TOKEN not set"); return null }
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${token()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
        messaging_type: "RESPONSE",
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error("[FB] sendFacebookMessage error:", JSON.stringify(data))
      return null
    }
    return data.message_id || null
  } catch (e) {
    console.error("[FB] sendFacebookMessage exception:", e)
    return null
  }
}

type QuickReply = { title: string; payload: string }

export async function sendFacebookMessageWithQuickReplies(
  psid: string,
  text: string,
  quickReplies: QuickReply[],
): Promise<string | null> {
  if (!token()) return null
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${token()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: {
          text,
          quick_replies: quickReplies.map(qr => ({
            content_type: "text",
            title: qr.title,
            payload: qr.payload,
          })),
        },
        messaging_type: "RESPONSE",
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error("[FB] sendWithQuickReplies error:", data)
    return data.message_id || null
  } catch { return null }
}

export async function getFacebookUserProfile(psid: string): Promise<{ firstName: string; lastName: string } | null> {
  if (!token()) return null
  try {
    const res = await fetch(`${GRAPH}/${psid}?fields=first_name,last_name&access_token=${token()}`)
    if (!res.ok) return null
    const d = await res.json()
    return { firstName: d.first_name || "Facebook", lastName: d.last_name || "Lead" }
  } catch { return null }
}

// Fetch a submitted lead's field data from Meta
export async function getFacebookLeadData(leadgenId: string): Promise<Record<string, string> | null> {
  if (!token()) {
    console.error("[FB] getFacebookLeadData: FB_PAGE_ACCESS_TOKEN is not set")
    return null
  }
  try {
    const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data&access_token=${token()}`)
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error("[FB] getFacebookLeadData failed — likely expired token:", res.status, JSON.stringify(errData))
      return null
    }
    const d = await res.json()
    const result: Record<string, string> = {}
    for (const f of d.field_data || []) result[f.name] = f.values?.[0] || ""
    return result
  } catch (e) {
    console.error("[FB] getFacebookLeadData exception:", e)
    return null
  }
}

// ─── Meta Marketing API ───────────────────────────────────────────────────────

export interface MediaItem {
  type: "image" | "video"
  url: string        // publicly accessible URL
  thumbnail?: string // optional preview URL (for video thumbnails)
}

export interface FbAdPayload {
  campaignName: string
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS"
  primaryText: string
  headline: string
  description: string
  imageUrl: string       // legacy single-image (kept for backward compat)
  mediaItems?: MediaItem[] // multi-image / video support
  destinationUrl: string
  ctaType: string
  dailyBudgetCents: number
  startTime: string
  endTime?: string
  targetLocations: string[]
  privacyPolicyUrl?: string
  advantagePlus?: boolean
  interests?: { id: string; name: string }[]
}

async function createLeadForm(pageId: string, campaignName: string, privacyPolicyUrl: string, destinationUrl: string) {
  let privacyUrl = privacyPolicyUrl
  if (!privacyUrl || !privacyUrl.startsWith("http")) {
    privacyUrl = destinationUrl.startsWith("http") ? destinationUrl : `https://${destinationUrl}`
  }

  const res = await fetch(`${GRAPH}/${pageId}/leadgen_forms?access_token=${token()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${campaignName} — Lead Form ${Date.now()}`,
      questions: [
        { type: "FULL_NAME" },
        { type: "EMAIL" },
        { type: "PHONE" },
      ],
      privacy_policy: { url: privacyUrl },
      follow_up_action_url: destinationUrl,
      locale: "EN_US",
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error("[FB Lead Form full error]", JSON.stringify(data.error))
    const detail = data.error.error_user_msg || data.error.message || "Unknown error"
    const subcode = data.error.error_subcode ? ` (subcode ${data.error.error_subcode})` : ""
    throw new Error(`Lead Form error ${data.error.code}${subcode}: ${detail}`)
  }
  return data.id as string
}

// Upload an image URL to adimages and return the hash
async function uploadImageHash(base: string, imageUrl: string): Promise<string | null> {
  const res = await fetch(`${base}/adimages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, access_token: userToken() }),
  })
  const data = await res.json() as any
  const images = (data.images || {}) as Record<string, { hash: string }>
  return images?.bytes?.hash || Object.values(images)[0]?.hash || null
}

// Upload a video URL to advideos and return the video ID
async function uploadVideoId(base: string, videoUrl: string, name: string): Promise<string | null> {
  const res = await fetch(`${base}/advideos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, file_url: videoUrl, access_token: userToken() }),
  })
  const data = await res.json() as any
  if (data.error) {
    console.error("[FB video upload]", JSON.stringify(data.error))
    return null
  }
  return data.id as string || null
}

export async function createFacebookAdCampaign(payload: FbAdPayload) {
  const rawAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.FB_PAGE_ID
  if (!rawAccountId || !pageId || !userToken()) {
    throw new Error("FACEBOOK_AD_ACCOUNT_ID, FACEBOOK_PAGE_ID and FB_USER_ACCESS_TOKEN (or FB_PAGE_ACCESS_TOKEN) must be set")
  }
  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`
  const base = `${GRAPH}/${adAccountId}`
  const isLeadAd = payload.objective === "OUTCOME_LEADS"

  // Build the media list — prefer mediaItems, fall back to legacy imageUrl
  const mediaList: MediaItem[] =
    payload.mediaItems?.length
      ? payload.mediaItems
      : payload.imageUrl
        ? [{ type: "image", url: payload.imageUrl }]
        : [{ type: "image", url: "" }]

  // 1. Lead form (for lead ads)
  let leadFormId: string | null = null
  if (isLeadAd) {
    const privacyUrl = payload.privacyPolicyUrl
      || `${process.env.NEXT_PUBLIC_APP_URL || payload.destinationUrl}/privacy`
    leadFormId = await createLeadForm(pageId, payload.campaignName, privacyUrl, payload.destinationUrl)
  }

  // 2. Campaign
  const campRes = await fetch(`${base}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.campaignName,
      objective: payload.objective,
      status: "PAUSED",
      special_ad_categories: ["HOUSING"],
      is_adset_budget_sharing_enabled: false,
      access_token: userToken(),
    }),
  })
  const campData = await campRes.json()
  if (campData.error) {
    console.error("[FB campaign full error]", JSON.stringify(campData.error))
    const userMsg = campData.error.error_user_msg || campData.error.message || "Unknown error"
    const code = campData.error.code
    const sub = campData.error.error_subcode ? `/${campData.error.error_subcode}` : ""
    throw new Error(`Campaign ${code}${sub}: ${userMsg}`)
  }
  const campaignId = campData.id

  // 3. Ad Set
  const adsetBody: any = {
    name: `${payload.campaignName} — Ad Set`,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: isLeadAd ? "LEAD_GENERATION" : "REACH",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    daily_budget: payload.dailyBudgetCents,
    targeting: { geo_locations: { countries: ["US"] } },
    status: "PAUSED",
    start_time: payload.startTime,
    access_token: userToken(),
  }
  if (isLeadAd) {
    adsetBody.promoted_object = { page_id: pageId }
    adsetBody.destination_type = "ON_AD"
  }
  if (payload.endTime) adsetBody.end_time = payload.endTime

  const adsetRes = await fetch(`${base}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adsetBody),
  })
  const adsetData = await adsetRes.json()
  if (adsetData.error) {
    console.error("[FB adset full error]", JSON.stringify(adsetData.error))
    const msg = adsetData.error.error_user_msg || adsetData.error.message || "Unknown"
    const sub = adsetData.error.error_subcode ? `/${adsetData.error.error_subcode}` : ""
    throw new Error(`Ad Set ${adsetData.error.code}${sub}: ${msg}`)
  }
  const adSetId = adsetData.id

  // 4 & 5. For each media item: create one creative + one ad
  const adIds: string[] = []
  const creativeIds: string[] = []

  for (let i = 0; i < mediaList.length; i++) {
    const media = mediaList[i]
    const label = `${payload.campaignName} — ${i + 1}`
    let storySpec: any

    if (media.type === "video" && media.url) {
      // ── Video creative ────────────────────────────────────────────────────
      const videoId = await uploadVideoId(base, media.url, label)
      if (!videoId) throw new Error(`Video ${i + 1}: failed to upload video`)

      const cta = isLeadAd && leadFormId
        ? { type: "SIGN_UP", value: { lead_gen_form_id: leadFormId } }
        : { type: payload.ctaType, value: { link: payload.destinationUrl } }

      storySpec = {
        page_id: pageId,
        video_data: {
          video_id: videoId,
          message: payload.primaryText,
          title: payload.headline,
          link_description: payload.description,
          call_to_action: cta,
        },
      }
    } else {
      // ── Image creative ────────────────────────────────────────────────────
      const linkData: any = {
        message: payload.primaryText,
        name: payload.headline,
        description: payload.description,
        link: payload.destinationUrl,
      }
      if (media.url) {
        const hash = await uploadImageHash(base, media.url)
        if (hash) linkData.image_hash = hash
      }
      linkData.call_to_action = isLeadAd && leadFormId
        ? { type: "SIGN_UP", value: { lead_gen_form_id: leadFormId } }
        : { type: payload.ctaType, value: { link: payload.destinationUrl } }

      storySpec = { page_id: pageId, link_data: linkData }
    }

    // Create creative
    const creativeRes = await fetch(`${base}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${label} — Creative`,
        object_story_spec: storySpec,
        access_token: userToken(),
      }),
    })
    const creativeData = await creativeRes.json()
    if (creativeData.error) {
      console.error("[FB creative full error]", JSON.stringify(creativeData.error))
      const msg = creativeData.error.error_user_msg || creativeData.error.message || "Unknown"
      const sub = creativeData.error.error_subcode ? `/${creativeData.error.error_subcode}` : ""
      throw new Error(`Creative ${i + 1} — ${creativeData.error.code}${sub}: ${msg}`)
    }
    creativeIds.push(creativeData.id)

    // Create ad
    const adRes = await fetch(`${base}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${label} — Ad`,
        adset_id: adSetId,
        creative: { creative_id: creativeData.id },
        status: "PAUSED",
        access_token: userToken(),
      }),
    })
    const adData = await adRes.json()
    if (adData.error) {
      console.error("[FB ad full error]", JSON.stringify(adData.error))
      const msg = adData.error.error_user_msg || adData.error.message || "Unknown"
      const sub = adData.error.error_subcode ? `/${adData.error.error_subcode}` : ""
      throw new Error(`Ad ${i + 1} — ${adData.error.code}${sub}: ${msg}`)
    }
    adIds.push(adData.id)
  }

  return { campaignId, adSetId, creativeIds, adIds, leadFormId }
}

// ─── Conversions API (CAPI) — server-side event reporting ────────────────────
// Sends real CRM signals to Facebook so ad campaigns optimise for quality leads
// rather than volume. All PII is SHA-256 hashed before transmission.

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

export type CapiEventName =
  | "Lead"           // new contact ingested
  | "Contact"        // contact became active / booked a call
  | "Schedule"       // appointment scheduled
  | "Purchase"       // deal closed

interface CapiUserData {
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  facebookLeadId?: string | null
  // Browser signals — improve event match quality score significantly
  clientIp?: string | null
  clientUserAgent?: string | null
  fbp?: string | null   // _fbp cookie — ties server event to browser session
  fbc?: string | null   // _fbc cookie — ties to a specific Facebook ad click
}

export async function sendCapiEvent(
  eventName: CapiEventName,
  userData: CapiUserData,
  opts: { value?: number; currency?: string; eventId?: string } = {}
): Promise<void> {
  const pixelId = process.env.FACEBOOK_PIXEL_ID
  const capiToken = process.env.FACEBOOK_CAPI_TOKEN
  if (!pixelId || !capiToken) {
    console.log(`[CAPI] Skipped ${eventName} — FACEBOOK_PIXEL_ID or FACEBOOK_CAPI_TOKEN not set`)
    return
  }

  const ud: Record<string, string | string[]> = {}
  if (userData.email)           ud.em           = [sha256(userData.email)]
  if (userData.phone)           ud.ph           = [sha256(userData.phone.replace(/\D/g, ""))]
  if (userData.firstName)       ud.fn           = [sha256(userData.firstName)]
  if (userData.lastName)        ud.ln           = [sha256(userData.lastName)]
  if (userData.facebookLeadId)  ud.lead_id      = userData.facebookLeadId
  if (userData.clientIp)        ud.client_ip_address  = userData.clientIp
  if (userData.clientUserAgent) ud.client_user_agent  = userData.clientUserAgent
  if (userData.fbp)             ud.fbp          = userData.fbp
  if (userData.fbc)             ud.fbc          = userData.fbc

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "crm",
    user_data: ud,
  }
  if (opts.value !== undefined) {
    event.custom_data = { value: opts.value, currency: opts.currency ?? "USD" }
  }
  if (opts.eventId) event.event_id = opts.eventId

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${capiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      }
    )
    const data = await res.json()
    if (data.error) {
      console.error(`[CAPI] ${eventName} error:`, data.error.message)
    } else {
      console.log(`[CAPI] ${eventName} sent — events_received: ${data.events_received}`)
    }
  } catch (err) {
    console.error(`[CAPI] ${eventName} failed:`, err)
  }
}
