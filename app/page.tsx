export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import SiteHome, { siteHomeMetadata } from "./(site)/site-home"

export const metadata: Metadata = siteHomeMetadata

// The bare domain always shows the public real-estate website — for everyone,
// including logged-in agents. Agents reach the CRM via /login → /dashboard.
export default function HomePage() {
  return <SiteHome />
}
