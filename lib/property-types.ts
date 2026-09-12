// Property-type groups shared by the public search and the CRM send panel.
//
// The MLS feed filters on RESO PropertySubType — one exact string per value —
// and Bridge ORs a list of them. Buyers do not think in those strings:
// "multifamiliar" is a single idea to them and several subtypes to the feed. A
// group maps a label people recognise onto the subtypes it actually covers, and
// selecting several groups unions their subtypes.

export interface PropertyTypeGroup {
  key: string
  label: string    // Spanish — the public search is Spanish-first
  labelEn: string  // English — the CRM side
  subTypes: string[]
  /** Set when this is one slice of a broader group, so the UI can nest it. */
  parent?: string
  /**
   * RESO PropertyType the subtypes live under. Small income property is filed
   * as "Residential Income", not "Residential", and a search pinned to the
   * latter drops every duplex before PropertySubType is even considered.
   */
  propertyTypes?: string[]
}

// Duplex, Triplex and Quadruplex are the RESO names for 2-, 3- and 4-unit
// buildings. "Multi Family" rides along because some feeds file small income
// property under that instead of the unit-count names. Listing all four costs
// nothing: they OR together, so a name this feed never uses simply matches
// nothing rather than breaking the filter.
export const MULTI_FAMILY_SUBTYPES = ["Duplex", "Triplex", "Quadruplex", "Multi Family"]

// Feeds disagree about where a duplex belongs: some file it as Residential
// Income, others leave it in Residential with a Duplex subtype. Allow both — the
// subtype filter still pins the result set, so widening the PropertyType cannot
// let a single-family house through.
export const MULTI_FAMILY_PROPERTY_TYPES = ["Residential", "Residential Income"]

export const PROPERTY_TYPE_GROUPS: PropertyTypeGroup[] = [
  { key: "single_family", label: "Casa",          labelEn: "Single Family", subTypes: ["Single Family Residence"] },
  { key: "condo",         label: "Condominio",    labelEn: "Condo",         subTypes: ["Condominium"] },
  { key: "townhouse",     label: "Townhouse",     labelEn: "Townhouse",     subTypes: ["Townhouse"] },
  { key: "coop",          label: "Cooperativa",   labelEn: "Co-op",         subTypes: ["Stock Cooperative"] },
  { key: "multi_family",  label: "Multifamiliar", labelEn: "Multi-Family",  subTypes: MULTI_FAMILY_SUBTYPES, propertyTypes: MULTI_FAMILY_PROPERTY_TYPES },
  { key: "duplex",        label: "Dúplex",        labelEn: "Duplex",        subTypes: ["Duplex"],      parent: "multi_family", propertyTypes: MULTI_FAMILY_PROPERTY_TYPES },
  { key: "triplex",       label: "Tríplex",       labelEn: "Triplex",       subTypes: ["Triplex"],     parent: "multi_family", propertyTypes: MULTI_FAMILY_PROPERTY_TYPES },
  { key: "fourplex",      label: "Fourplex",      labelEn: "Fourplex",      subTypes: ["Quadruplex"],  parent: "multi_family", propertyTypes: MULTI_FAMILY_PROPERTY_TYPES },
]

const BY_KEY = new Map(PROPERTY_TYPE_GROUPS.map(g => [g.key, g]))

/** Union of the subtypes behind the selected group keys, de-duplicated. */
export function subTypesForKeys(keys: string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    for (const t of BY_KEY.get(k)?.subTypes ?? []) if (!out.includes(t)) out.push(t)
  }
  return out
}

/** The `type=` query value: what every consumer downstream already expects. */
export function keysToParam(keys: string[]): string {
  return subTypesForKeys(keys).join(",")
}

/**
 * Best-effort reverse of keysToParam, for restoring a search from a URL or a
 * saved search. Broad groups are matched first so a complete multi-family set
 * comes back as one selection rather than four.
 */
export function paramToKeys(param: string): string[] {
  const wanted = new Set(param.split(",").map(s => s.trim()).filter(Boolean))
  if (wanted.size === 0) return []
  const keys: string[] = []
  const claim = (g: PropertyTypeGroup) => {
    if (g.subTypes.every(t => wanted.has(t))) {
      keys.push(g.key)
      g.subTypes.forEach(t => wanted.delete(t))
    }
  }
  PROPERTY_TYPE_GROUPS.filter(g => !g.parent).forEach(claim)
  PROPERTY_TYPE_GROUPS.filter(g => g.parent).forEach(claim)
  return keys
}

/** Human summary of a selection, e.g. "Condominio + Multifamiliar". */
export function labelForKeys(keys: string[], lang: "es" | "en" = "es"): string {
  return keys
    .map(k => { const g = BY_KEY.get(k); return g ? (lang === "en" ? g.labelEn : g.label) : "" })
    .filter(Boolean)
    .join(" + ")
}

/**
 * RESO PropertyType values a selection needs. Empty means "leave it to the
 * caller's default", which keeps an unfiltered search exactly as it was.
 */
export function propertyTypesForKeys(keys: string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    for (const t of BY_KEY.get(k)?.propertyTypes ?? []) if (!out.includes(t)) out.push(t)
  }
  return out
}

/**
 * Same question asked of the raw `type=` value, so the search route does not
 * have to round-trip through group keys to learn it needs Residential Income.
 */
export function propertyTypesForSubTypes(subTypes: string[]): string[] {
  const needsIncome = subTypes.some(t => MULTI_FAMILY_SUBTYPES.includes(t.trim()))
  return needsIncome ? MULTI_FAMILY_PROPERTY_TYPES : []
}
