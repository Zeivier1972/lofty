import SearchClient from "./search-client"

export const metadata = {
  title: "Miami MLS Property Search — Catherine Gomez Realtor",
  description: "Search active Miami MLS listings. Find homes, condos, and investment properties in Miami, Doral, Brickell, Coral Gables, Aventura, and more.",
}

export default function SearchPage() {
  return <SearchClient />
}
