export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import SiteHome, { siteHomeMetadata } from "./(site)/site-home"

export const metadata: Metadata = siteHomeMetadata

export default async function HomePage() {
  // Logged-in agents go straight to the CRM. Everyone else (buyers, sellers,
  // the public) sees the real-estate website on the bare domain.
  const session = await auth()
  if (session) redirect("/dashboard")
  return <SiteHome />
}
