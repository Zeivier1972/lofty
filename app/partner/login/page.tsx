export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPartnerSession } from "@/lib/partner-auth"
import PartnerLoginClient from "./login-client"

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string; preview?: string }
}) {
  // Only auto-redirect to an existing session when NO token is in the URL.
  // A token in the link always wins — it may be for a different partner
  // than the one currently in the cookie (e.g. admin preview, re-added partner).
  if (!searchParams.token) {
    const session = await getPartnerSession()
    if (session) redirect("/partner")
  }

  return <PartnerLoginClient prefillToken={searchParams.token} error={searchParams.error} preview={searchParams.preview === "1"} />
}
