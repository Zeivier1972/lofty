export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import ContactForm from "@/components/contacts/contact-form"

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
  })

  if (!contact) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <Link href={`/contacts/${params.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to contact
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Contact</h1>
        <p className="text-gray-500 text-sm mt-1">{contact.firstName} {contact.lastName}</p>
      </div>
      <ContactForm contact={JSON.parse(JSON.stringify(contact))} />
    </div>
  )
}
