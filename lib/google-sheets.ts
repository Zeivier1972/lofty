import crypto from "crypto"
import { findEventByTag } from "@/lib/events"

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

  // Env-var fields mangle PEM line breaks in every possible way, so normalize
  // defensively: strip accidental wrapping quotes, accept a base64-encoded PEM
  // (single line — impossible to mangle), then restore literal \n to newlines.
  let privateKey = rawKey.trim()
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1).trim()
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = Buffer.from(privateKey.replace(/\s/g, ""), "base64").toString("utf8")
      if (decoded.includes("BEGIN PRIVATE KEY")) privateKey = decoded
    } catch { /* not base64 — fall through */ }
  }
  privateKey = privateKey.replace(/\\n/g, "\n")

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
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  tags?: string[]       // used to detect which event (Bogotá/Medellín) → which tab
  eventDay?: string     // the "¿Qué día quieres atender?" answer, if captured
}

// Build one sheet row in the exact column order of the existing event sheet:
// A Name | B Email | C Phone Number | D Registered At | E Attendance | F timestamp | G | H | I Contestaron
export function buildEventLeadRow(lead: Pick<SheetLeadRow, "firstName" | "lastName" | "email" | "phone" | "eventDay">): string[] {
  const timestamp = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" })
  const name = `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
  const phoneDigits = (lead.phone || "").replace(/\D/g, "")
  return [name, lead.email || "", phoneDigits, lead.eventDay || "", "", timestamp, "", "", "No contesto"]
}

// Read one column of a tab (e.g. "B" for emails) — used to dedupe on backfill.
export async function getTabColumn(tab: string, col: string): Promise<string[]> {
  const sheetId = process.env.GOOGLE_SHEETS_LEADS_ID
  if (!sheetId) return []
  const token = await getAccessToken()
  if (!token) return []
  const range = `${tab}!${col}:${col}`
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.values || []).map((r: string[]) => (r[0] || "").toString().trim())
  } catch { return [] }
}

// Append many pre-built rows to a specific tab in a single call (for backfill).
export async function appendRowsToTab(tab: string, rows: string[][]): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEETS_LEADS_ID
  if (!sheetId || rows.length === 0) return false
  const token = await getAccessToken()
  if (!token) return false
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ values: rows }) })
    if (!res.ok) { console.error("[SHEETS] batch append failed:", res.status, await res.text().catch(() => "")) ; return false }
    return true
  } catch (e) { console.error("[SHEETS] batch append error:", e); return false }
}

// Append ONE event lead to the matching city tab of the event sheet.
// Fire-and-forget: never throws, never blocks lead ingestion.
//   - No-ops when the integration isn't configured (GOOGLE_SHEETS_LEADS_ID unset).
//   - No-ops when the lead has no Bogotá/Medellín event tag — this sheet is for
//     EVENT leads only, not every lead in the CRM.
export async function appendEventLeadToSheet(lead: SheetLeadRow): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEETS_LEADS_ID
  if (!sheetId) return false

  // Event leads only — resolve the event (and its tab) from the lead's tags.
  const ev = (lead.tags || []).map(t => findEventByTag(t)).find(Boolean)
  if (!ev) return false

  const token = await getAccessToken()
  if (!token) return false

  const row = buildEventLeadRow(lead)

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(ev.sheetTab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

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
