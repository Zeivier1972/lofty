import ListingClient from "./listing-client"

export const metadata = {
  title: "Detalle de propiedad — Catherine Gomez Realtor",
  description: "Detalles completos de esta propiedad en venta en South Florida, con Catherine Gomez Realtor.",
}

export default function ListingPage({ params }: { params: { key: string } }) {
  return <ListingClient listingKey={params.key} />
}
