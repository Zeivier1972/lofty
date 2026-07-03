import type { Metadata } from "next"
import ListingClient from "./listing-client"
import { fetchListingByKey, fetchListingMedia, buildDisplayAddress } from "@/lib/bridge"

// Rich per-listing metadata → shareable previews + Google indexable.
export async function generateMetadata({ params }: { params: { key: string } }): Promise<Metadata> {
  try {
    const l = await fetchListingByKey(params.key)
    if (!l) return { title: "Propiedad — Catherine Gomez Realtor" }
    const addr = buildDisplayAddress(l)
    const price = l.ListPrice ? `$${Number(l.ListPrice).toLocaleString()}` : ""
    const beds = l.BedroomsTotal ?? "?"
    const baths = l.BathroomsTotalDecimal ?? "?"
    const sqft = l.LivingArea ? ` · ${Number(l.LivingArea).toLocaleString()} sqft` : ""
    const title = `${addr}${price ? ` — ${price}` : ""} | Catherine Gomez Realtor`
    const description = `${price ? price + " · " : ""}${beds} cuartos · ${baths} baños${sqft}. ${(l.PublicRemarks || "Propiedad en venta en South Florida.").slice(0, 140)}`
    const photos = await fetchListingMedia(params.key)
    const images = photos[0] ? [photos[0]] : []
    return {
      title,
      description,
      openGraph: { title, description, images, type: "website" },
      twitter: { card: "summary_large_image", title, description, images },
    }
  } catch {
    return { title: "Propiedad — Catherine Gomez Realtor" }
  }
}

export default function ListingPage({ params }: { params: { key: string } }) {
  return <ListingClient listingKey={params.key} />
}
