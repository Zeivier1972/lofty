export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-auth"
import PortalLoginClient from "./login-client"

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string; error?: string; next?: string }
}) {
  const session = await getPortalSession()
  if (session) redirect(searchParams.next || "/portal/dashboard")

  return <PortalLoginClient prefillToken={searchParams.token} error={searchParams.error} next={searchParams.next} />
}
