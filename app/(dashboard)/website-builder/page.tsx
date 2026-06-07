export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import WebsiteBuilderClient from "./website-builder-client"

export default async function WebsiteBuilderPage() {
  let config = null
  try {
    config = await prisma.websiteConfig.findFirst()
  } catch (e) {
    console.error("Website builder page error:", e)
  }
  return <WebsiteBuilderClient config={config} />
}
