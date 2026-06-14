const GRAPH = "https://graph.facebook.com/v19.0"

function token() {
  return process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
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
  if (!rawAccountId || !pageId || !token()) {
    throw new Error("FACEBOOK_AD_ACCOUNT_ID, FACEBOOK_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be set")
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
      special_ad_categories: ["NONE"],
      access_token: token(),
    }),
  })
  const campData = await campRes.json()
  if (campData.error) { console.error("[FB campaign]", JSON.stringify(campData.error)); throw new Error(`Campaign: ${campData.error.message} (${campData.error.error_subcode || campData.error.code})`) }
  const campaignId = campData.id

  // 3. Create ad set
  // HOUSING category: no age/gender/zip/interest targeting, no Advantage+
  const targeting: any = {
    geo_locations: {
      countries: ["US"],
      regions: payload.targetLocations.map(loc => {
        const parts = loc.split(",")
        const state = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim()
        return { name: state }
      }),
    },
  }

  const adsetBody: any = {
    name: `${payload.campaignName} — Ad Set`,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: isLeadAd ? "LEAD_GENERATION" : "REACH",
    daily_budget: payload.dailyBudgetCents,
    targeting,
    status: "PAUSED",
    start_time: payload.startTime,
    access_token: token(),
  }
  if (payload.endTime) adsetBody.end_time = payload.endTime

  const adsetRes = await fetch(`${base}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adsetBody),
  })
  const adsetData = await adsetRes.json()
  if (adsetData.error) { console.error("[FB adset]", JSON.stringify(adsetData.error)); throw new Error(`Ad Set: ${adsetData.error.message} (${adsetData.error.error_subcode || adsetData.error.code})`) }
  const adSetId = adsetData.id

  // 4. Create ad creative
  const linkData: any = {
    message: payload.primaryText,
    name: payload.headline,
    description: payload.description,
  }
  if (payload.imageUrl) linkData.image_url = payload.imageUrl

  if (isLeadAd && leadFormId) {
    // Lead Ad: CTA opens the Instant Form
    linkData.call_to_action = {
      type: "SIGN_UP",
      value: { lead_gen_form_id: leadFormId },
    }
  } else {
    // Traffic / Awareness: CTA goes to the website
    linkData.link = payload.destinationUrl
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
      access_token: token(),
    }),
  })
  const creativeData = await creativeRes.json()
  if (creativeData.error) { console.error("[FB creative]", JSON.stringify(creativeData.error)); throw new Error(`Creative: ${creativeData.error.message} (${creativeData.error.error_subcode || creativeData.error.code})`) }
  const creativeId = creativeData.id

  // 5. Create ad
  const adRes = await fetch(`${base}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.campaignName,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
      access_token: token(),
    }),
  })
  const adData = await adRes.json()
  if (adData.error) { console.error("[FB ad]", JSON.stringify(adData.error)); throw new Error(`Ad: ${adData.error.message} (${adData.error.error_subcode || adData.error.code})`) }

  return { campaignId, adSetId, creativeId, adId: adData.id, leadFormId }
}
