export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getLoanOfficer } from "@/lib/lender-auth"
import LenderLoginClient from "./login-client"

export default async function LenderLoginPage() {
  const partner = await getLoanOfficer()
  if (partner) redirect("/lender")
  return <LenderLoginClient />
}
