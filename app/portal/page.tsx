import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-auth"

export default async function PortalRoot() {
  const session = await getPortalSession()
  if (session) redirect("/portal/dashboard")
  redirect("/portal/login")
}
