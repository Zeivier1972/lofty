import { WebinarsClient } from "./webinars-client"

export const dynamic = "force-dynamic"

export const metadata = { title: "Webinars | CASAi" }

export default function WebinarsPage() {
  return <WebinarsClient />
}
