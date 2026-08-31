import crypto from "crypto"

// Live lead → Google Sheets sync using a Google service account.
// No SDK/dependency: we sign a JWT with the service account's private key,
// exchange it for an access token, and append a row via the Sheets REST API.
//
// Required env vars (set in Railway):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   — e.g. casai-sheets@my-project.iam.gserviceaccount.com
//   GOOGLE_SERVICE_ACCOUNT_KEY     — the PEM private key (literal \n or real newlines both OK)
//   GOOGLE_SHEETS_LEADS_ID         — the spreadsheet ID (from its URL)
// Optional:
//   GOOGLE_SHEETS_LEADS_TAB        — worksheet/tab name (default "Leads")
//
// Setup: share the target Google Sheet with GOOGLE_SERVICE_ACCOUNT_EMAIL as Editor.

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/spreadsheets"

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

// Cache the access token in-process; Google tokens last ~1h.
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !rawKey) return null

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  // Env vars usually store the PEM with escaped "\n" — turn those back into real newlines.
  const privateKey = rawKey.replace(/\\n/g, "\n")

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const signingInput = `${header}.${claim}`

  let signature: string
  try {
    signature = base64url(crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey))
  } catch (e) {
    console.error("[SHEETS] JWT signing failed (check GOOGLE_SERVICE_ACCOUNT_KEY format):", e)
    return null
  }
  const assertion = `${signingInput}.${signature}`

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) {
      console.error("[SHEETS] token exchange failed:", data)
      return null
    }
    cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }
    return cachedToken.token
  } catch (e) {
    console.error("[SHEETS] token request error:", e)
    return null
  }
}

export interface SheetLeadRow {
  type: string          // "Nuevo" | "Volvió"
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  source: string
  campaign?: string
  tags?: string[]
  location?: string
  contactId: string
}

// Append one lead as a new row. Fire-and-forget: never throws, never blocks
// lead ingestion. No-ops (returns false) when the integration isn't configured.
export async function appendLeadToSheet(lead: SheetLeadRow): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEETS_LEADS_ID
  if (!sheetId) return false

  const token = await getAccessToken()
  if (!token) return false

  const tab = process.env.GOOGLE_SHEETS_LEADS_TAB || "Leads"
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
  const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })

  // Column order (put a matching header row in the sheet once):
  // Fecha | Tipo | Nombre | Apellido | Email | Teléfono | Fuente | Campaña | Etiquetas | Ubicación | CRM
  const row = [
    fecha,
    lead.type,
    lead.firstName || "",
    lead.lastName || "",
    lead.email || "",
    lead.phone || "",
    lead.source || "",
    lead.campaign || "",
    (lead.tags || []).join(", "),
    lead.location || "",
    `${base}/contacts/${lead.contactId}`,
  ]

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ values: [row] }),
    })
    if (!res.ok) {
      console.error("[SHEETS] append failed:", res.status, await res.text().catch(() => ""))
      return false
    }
    return true
  } catch (e) {
    console.error("[SHEETS] append error:", e)
    return false
  }
}
