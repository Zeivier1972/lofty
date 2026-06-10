import { Suspense } from "react"
import IntegrationsClient from "./integrations-client"

export const metadata = { title: "Integraciones | Lofty CRM" }

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsClient />
    </Suspense>
  )
}
