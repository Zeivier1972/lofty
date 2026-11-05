export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import SofiaZoomClient from "./client"

/**
 * "Sofía en Zoom": Catherine pastes her meeting link here and Sofía (the
 * native Zoom bot, zoom-bot/ on Railway) joins as a participant, answers the
 * chat with the project's real data, hands Catherine privately what only she
 * should answer, and saves attendees + questions to the CRM at the end.
 * Private tool — not indexed, not in the sitemap.
 */

export const metadata: Metadata = {
  title: "Sofía en Zoom | CASAi",
  robots: { index: false, follow: false },
}

export default async function SofiaZoomPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const projects = PROJECTS
    .filter(p => !p.href.startsWith("/guias"))
    .map(p => ({ href: p.href, name: p.name, place: p.place }))

  return <SofiaZoomClient projects={projects} hostName={session.user?.name || "Catherine"} />
}
