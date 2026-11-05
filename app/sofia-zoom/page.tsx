export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import SofiaZoomClient from "./client"

/**
 * "Sofía en Zoom": Catherine opens this page (logged in) in a second window
 * or on a tablet during a project presentation. Sofía joins the Zoom
 * meeting as a participant through the Meeting SDK, answers the chat with
 * the project's real data, hands Catherine privately what only she should
 * answer, and saves attendees + questions to the CRM at the end.
 *
 * Outside the dashboard layout on purpose: the Zoom client takes the whole
 * window. Private tool — not indexed, not in the sitemap.
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
