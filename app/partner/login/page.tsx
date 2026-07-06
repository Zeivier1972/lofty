export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPartnerSession } from "@/lib/partner-auth"
import PartnerLoginClient from "./login-client"

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string; preview?: string }
}) {
  const session = await getPartnerSession()
  if (session) redirect("/partner")

  return <PartnerLoginClient prefillToken={searchParams.token} error={searchParams.error} preview={searchParams.preview === "1"} />
}
