export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import SiteNav from "./site-nav"

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const agentName = config?.realtorName || "Lofty Realty"

  return (
    <div className="min-h-screen bg-white">
      <SiteNav agentName={agentName} />
      <main>{children}</main>
    </div>
  )
}
