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
  targetLocations: string[]   // city names or "City, State"
  ageMin: number
  ageMax: number
}

export async function createFacebookAdCampaign(payload: FbAdPayload) {
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.FB_PAGE_ID
  if (!adAccountId || !pageId || !token()) {
    throw new Error("FACEBOOK_AD_ACCOUNT_ID, FACEBOOK_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be set")
  }

  const base = `${GRAPH}/${adAccountId}`

  // 1. Create campaign
  const campRes = await fetch(`${base}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.campaignName,
      objective: payload.objective,
      status: "PAUSED",
      special_ad_categories: ["HOUSING"],
      access_token: token(),
    }),
  })
  const campData = await campRes.json()
  if (campData.error) throw new Error(`Campaign: ${campData.error.message}`)
  const campaignId = campData.id

  // 2. Create ad set
  const adsetBody: any = {
    name: `${payload.campaignName} — Ad Set`,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: payload.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
    daily_budget: payload.dailyBudgetCents,
    targeting: {
      age_min: payload.ageMin,
      age_max: payload.ageMax,
      geo_locations: {
        cities: payload.targetLocations.map(name => ({ name })),
      },
    },
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
  if (adsetData.error) throw new Error(`Ad Set: ${adsetData.error.message}`)
  const adSetId = adsetData.id

  // 3. Create ad creative
  const creativeRes = await fetch(`${base}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${payload.campaignName} — Creative`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: payload.primaryText,
          link: payload.destinationUrl,
          name: payload.headline,
          description: payload.description,
          image_url: payload.imageUrl || undefined,
          call_to_action: {
            type: payload.ctaType,
            value: { link: payload.destinationUrl },
          },
        },
      },
      access_token: token(),
    }),
  })
  const creativeData = await creativeRes.json()
  if (creativeData.error) throw new Error(`Creative: ${creativeData.error.message}`)
  const creativeId = creativeData.id

  // 4. Create ad
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
  if (adData.error) throw new Error(`Ad: ${adData.error.message}`)

  return { campaignId, adSetId, creativeId, adId: adData.id }
}
