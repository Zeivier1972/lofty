export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PROJECTS } from "@/lib/projects"
import { localZoneFor } from "@/lib/appointment-message"
import PersonalVideoClient from "./client"

/**
 * One lead's personal video page. Private by design (opaque token, noindex,
 * not in the sitemap): it carries the person's name and is prefilled with
 * their details for the calendar.
 */

export const metadata: Metadata = {
  title: "Tu video personal | Catherine Gomez Realtor",
  robots: { index: false, follow: false },
}

const SOURCE_BY_HREF: Record<string, string> = {
  "/house-of-wellness": "HOUSE_OF_WELLNESS",
  "/domus": "DOMUS",
  "/parkside": "PARKSIDE",
}

export default async function PersonalVideoPage({ params }: { params: { token: string } }) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(params.token)) notFound()
  const v = await prisma.personalVideo.findUnique({
    where: { token: params.token },
    select: {
      token: true, firstName: true, projectHref: true, status: true, videoUrl: true,
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!v) notFound()

  const project = v.projectHref ? PROJECTS.find(p => p.href === v.projectHref) || null : null
  const phone = v.contact.phone || ""
  const country = localZoneFor(phone)?.country || (phone.startsWith("+1") || /^\d{10}$/.test(phone.replace(/\D/g, "")) ? "Estados Unidos" : "Colombia")

  return (
    <PersonalVideoClient
      token={v.token}
      firstName={v.firstName}
      videoUrl={v.status === "READY" || v.status === "SENT" ? v.videoUrl : null}
      project={project ? { name: project.name, place: project.place, href: project.href, img: project.img, alt: project.alt, highlight: project.highlight, summary: project.summary } : null}
      source={(project && SOURCE_BY_HREF[project.href]) || "PERSONAL_VIDEO"}
      prefill={{
        firstName: v.contact.firstName,
        lastName: v.contact.lastName || "",
        email: v.contact.email || "",
        phone,
        country,
        summary: `Vio su video personal${project ? ` de ${project.name}` : ""}`,
      }}
    />
  )
}
