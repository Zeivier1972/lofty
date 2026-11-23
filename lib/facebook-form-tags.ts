/**
 * Tags a Facebook lead-form lead must get from WHICH form or ad it came from,
 * so the right smart plan enrolls it.
 *
 * The webhook only tags from tracking parameters (utm_campaign/utm_content/tag)
 * set inside the form, and a published form can't be edited to add them. So
 * forms are also mapped here by id, and any campaign/ad/form name that says
 * "Parkside" gets the Parkside tag (the Parkside smart plan's trigger).
 */

/** Form id → tags. Add a row when a new form should feed a specific plan. */
const FORM_TAGS: Record<string, string[]> = {
  // "Proyectos 1 - Leads" (created 2026-11-23) — Parkside campaign.
  "994892339879659": ["Parkside"],
}

export function tagsForFormLead(formId?: string | null, names: (string | null | undefined)[] = []): string[] {
  const tags = new Set<string>(formId ? FORM_TAGS[String(formId)] ?? [] : [])
  if (names.some(n => n && /\bpark\s?side\b/i.test(n))) tags.add("Parkside")
  return Array.from(tags)
}
