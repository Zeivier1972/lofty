import HomesClient from "./homes-client"

export const metadata = {
  title: "Casas en venta en Miami y South Florida — Catherine Gomez Realtor",
  description:
    "Busca casas, condos y propiedades en venta en Miami, Brickell, Doral, Coral Gables, Aventura y todo South Florida. Listados actualizados del MLS con Catherine Gomez Realtor.",
}

export default function HomesPage() {
  return <HomesClient />
}
