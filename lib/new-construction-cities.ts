/**
 * The cities /new-construction covers. "All Cities" on that page means these —
 * not the whole MLS. With no city at all the query came back empty (the page
 * opened on "0 new construction listings"), while any single city returned
 * hundreds, so the default search is scoped to this list instead.
 */
export const NEW_CONSTRUCTION_CITIES = [
  "Miami", "Miami Beach", "Doral", "Coral Gables",
  "Aventura", "Sunny Isles Beach", "Brickell", "Edgewater", "Wynwood",
  "Hialeah", "Kendall", "Pinecrest", "South Miami",
]
