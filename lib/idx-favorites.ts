// Client-side favorites + captured-lead state (localStorage) and the save API call.
const FAVS_KEY = "idx_favs"
const LEAD_KEY = "idx_lead"

export interface CapturedLead {
  contactId: string
  firstName?: string
}

export function getFavs(): string[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(FAVS_KEY) || "[]") } catch { return [] }
}

export function setFavs(keys: string[]) {
  if (typeof window !== "undefined") localStorage.setItem(FAVS_KEY, JSON.stringify(keys))
}

export function getLead(): CapturedLead | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(LEAD_KEY) || "null") } catch { return null }
}

export function setLead(l: CapturedLead) {
  if (typeof window !== "undefined") localStorage.setItem(LEAD_KEY, JSON.stringify(l))
}

export interface LeadFields {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

// Save or remove a favorite. Persists the captured lead on first save.
export async function saveHome(opts: { listingKey: string; lead?: LeadFields; remove?: boolean }): Promise<CapturedLead> {
  const stored = getLead()
  const res = await fetch("/api/idx/save-home", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingKey: opts.listingKey,
      contactId: stored?.contactId,
      remove: opts.remove || false,
      ...opts.lead,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "No se pudo guardar")
  const lead: CapturedLead = { contactId: data.contactId, firstName: data.firstName }
  if (lead.contactId) setLead(lead)
  return lead
}
