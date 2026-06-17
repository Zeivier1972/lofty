export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ContentStudioClient from "./content-studio-client"

export default async function ContentStudioPage() {
  const session = await auth()
  if (!session) redirect("/login")
  return (
    <Suspense>
      <ContentStudioClient />
    </Suspense>
  )
}
