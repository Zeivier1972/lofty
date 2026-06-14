const GRAPH = "https://graph.facebook.com/v25.0"

// Page Access Token — used for Messenger, lead form creation, page posts
function token() {
  return process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
}

// User Access Token — required for ad account operations (campaigns, ad sets, creatives, ads)
function userToken() {
  return process.env.FB_USER_ACCESS_TOKEN || token()
}

export async function sendFacebookMessage(psid: string, text: string): Promise<string | null> {
  if (!token()) return null
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
  if (!token()) return null
  try {
    const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data&access_token=${token()}`)
    if (!res.ok) return null
    const d = await res.json()
    const result: Record<string, string> = {}
    for (const f of d.field_data || []) result[f.name] = f.values?.[0] || ""
    return result
  } catch { return null }
}

// ─── Meta Marketing API ───────────────────────────────────────────────────────

export interface FbAdPayload {
  campaignName: string
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS"
  primaryText: string
  headline: string
  description: string
  imageUrl: string
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
  // Ensure we have a valid absolute URL for privacy policy
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

export async function createFacebookAdCampaign(payload: FbAdPayload) {
  const rawAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.FB_PAGE_ID
  if (!rawAccountId || !pageId || !userToken()) {
    throw new Error("FACEBOOK_AD_ACCOUNT_ID, FACEBOOK_PAGE_ID and FB_USER_ACCESS_TOKEN (or FB_PAGE_ACCESS_TOKEN) must be set")
  }
  // Facebook API always requires act_ prefix
  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`
  const base = `${GRAPH}/${adAccountId}`
  const isLeadAd = payload.objective === "OUTCOME_LEADS"

  // 1. If Lead Ad, auto-create an Instant Form on the Page
  let leadFormId: string | null = null
  if (isLeadAd) {
    const privacyUrl = payload.privacyPolicyUrl
      || `${process.env.NEXT_PUBLIC_APP_URL || payload.destinationUrl}/privacy`
    leadFormId = await createLeadForm(pageId, payload.campaignName, privacyUrl, payload.destinationUrl)
  }

  // 2. Create campaign
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
    const hint = (campData.error.error_subcode === 4834011 || campData.error.code === 4834011)
      ? " → In Meta Business Manager go to: Ad Accounts → your account → Brand Safety & Suitability → Special Ad Categories → enable HOUSING."
      : ""
    throw new Error(`Campaign ${code}${sub}: ${userMsg}${hint}`)
  }
  const campaignId = campData.id

  // 3. Create ad set
  // HOUSING category: country-level geo only (no city/zip/age/gender/interests)
  const targeting: any = {
    geo_locations: { countries: ["US"] },
  }

  const adsetBody: any = {
    name: `${payload.campaignName} — Ad Set`,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: isLeadAd ? "LEAD_GENERATION" : "REACH",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    daily_budget: payload.dailyBudgetCents,
    targeting,
    status: "PAUSED",
    start_time: payload.startTime,
    access_token: userToken(),
  }
  if (isLeadAd) adsetBody.promoted_object = { page_id: pageId }
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

  // 4. Create ad creative
  // link is required in link_data for all ad types
  const linkData: any = {
    message: payload.primaryText,
    name: payload.headline,
    description: payload.description,
    link: payload.destinationUrl,
  }
  // image_url not supported in link_data in v25.0 — upload image separately if needed
  if (payload.imageUrl) {
    const imgRes = await fetch(`${base}/adimages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: payload.imageUrl, access_token: userToken() }),
    })
    const imgData = await imgRes.json() as any
    const images = (imgData.images || {}) as Record<string, { hash: string }>
    const hash = images?.bytes?.hash || (Object.values(images)[0]?.hash)
    if (hash) linkData.image_hash = hash
  }

  if (isLeadAd && leadFormId) {
    // Lead Ad: CTA opens the Instant Form
    linkData.call_to_action = {
      type: "SIGN_UP",
      value: { lead_gen_form_id: leadFormId },
    }
  } else {
    // Traffic / Awareness: CTA goes to the website
    linkData.call_to_action = {
      type: payload.ctaType,
      value: { link: payload.destinationUrl },
    }
  }

  const creativeRes = await fetch(`${base}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${payload.campaignName} — Creative`,
      object_story_spec: { page_id: pageId, link_data: linkData },
      access_token: userToken(),
    }),
  })
  const creativeData = await creativeRes.json()
  if (creativeData.error) {
    console.error("[FB creative full error]", JSON.stringify(creativeData.error))
    const msg = creativeData.error.error_user_msg || creativeData.error.message || "Unknown"
    const sub = creativeData.error.error_subcode ? `/${creativeData.error.error_subcode}` : ""
    throw new Error(`Creative ${creativeData.error.code}${sub}: ${msg}`)
  }
  const creativeId = creativeData.id

  // 5. Create ad
  const adBody: any = {
    name: payload.campaignName,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
    ...(isLeadAd ? { destination_type: "ON_AD" } : {}),
    access_token: userToken(),
  }
  const adRes = await fetch(`${base}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adBody),
  })
  const adData = await adRes.json()
  if (adData.error) {
    console.error("[FB ad full error]", JSON.stringify(adData.error))
    const msg = adData.error.error_user_msg || adData.error.message || "Unknown"
    const sub = adData.error.error_subcode ? `/${adData.error.error_subcode}` : ""
    throw new Error(`Ad ${adData.error.code}${sub}: ${msg}`)
  }

  return { campaignId, adSetId, creativeId, adId: adData.id, leadFormId }
}
