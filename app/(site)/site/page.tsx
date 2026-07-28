export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import SiteHome, { siteHomeMetadata } from "../site-home"

export const metadata: Metadata = siteHomeMetadata

export default function SitePage() {
  return <SiteHome />
}
