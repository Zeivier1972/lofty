import { Suspense } from "react"
import IntegrationsClient from "./integrations-client"

export const metadata = { title: "Integraciones | Casai" }

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsClient />
    </Suspense>
  )
}
