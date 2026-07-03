// South Florida cities for SEO city landing pages + sitemap.
export interface SoflaCity {
  slug: string
  name: string // exact MLS City value
  county: string
}

export const SOFLA_CITIES: SoflaCity[] = [
  // Miami-Dade
  { slug: "miami", name: "Miami", county: "Miami-Dade" },
  { slug: "miami-beach", name: "Miami Beach", county: "Miami-Dade" },
  { slug: "coral-gables", name: "Coral Gables", county: "Miami-Dade" },
  { slug: "doral", name: "Doral", county: "Miami-Dade" },
  { slug: "aventura", name: "Aventura", county: "Miami-Dade" },
  { slug: "sunny-isles-beach", name: "Sunny Isles Beach", county: "Miami-Dade" },
  { slug: "kendall", name: "Kendall", county: "Miami-Dade" },
  { slug: "homestead", name: "Homestead", county: "Miami-Dade" },
  { slug: "palmetto-bay", name: "Palmetto Bay", county: "Miami-Dade" },
  { slug: "cutler-bay", name: "Cutler Bay", county: "Miami-Dade" },
  { slug: "pinecrest", name: "Pinecrest", county: "Miami-Dade" },
  { slug: "hialeah", name: "Hialeah", county: "Miami-Dade" },
  { slug: "miami-lakes", name: "Miami Lakes", county: "Miami-Dade" },
  { slug: "north-miami-beach", name: "North Miami Beach", county: "Miami-Dade" },
  // Broward
  { slug: "fort-lauderdale", name: "Fort Lauderdale", county: "Broward" },
  { slug: "hollywood", name: "Hollywood", county: "Broward" },
  { slug: "pembroke-pines", name: "Pembroke Pines", county: "Broward" },
  { slug: "miramar", name: "Miramar", county: "Broward" },
  { slug: "coral-springs", name: "Coral Springs", county: "Broward" },
  { slug: "weston", name: "Weston", county: "Broward" },
  { slug: "davie", name: "Davie", county: "Broward" },
  { slug: "pompano-beach", name: "Pompano Beach", county: "Broward" },
  // Palm Beach
  { slug: "west-palm-beach", name: "West Palm Beach", county: "Palm Beach" },
  { slug: "boca-raton", name: "Boca Raton", county: "Palm Beach" },
  { slug: "boynton-beach", name: "Boynton Beach", county: "Palm Beach" },
  { slug: "delray-beach", name: "Delray Beach", county: "Palm Beach" },
  { slug: "jupiter", name: "Jupiter", county: "Palm Beach" },
  { slug: "wellington", name: "Wellington", county: "Palm Beach" },
]

export function cityBySlug(slug: string): SoflaCity | undefined {
  return SOFLA_CITIES.find(c => c.slug === slug)
}
