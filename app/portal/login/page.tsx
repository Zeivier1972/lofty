import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-auth"
import PortalLoginClient from "./login-client"

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string; error?: string }
}) {
  const session = await getPortalSession()
  if (session) redirect("/portal/dashboard")

  return <PortalLoginClient prefillToken={searchParams.token} error={searchParams.error} />
}
