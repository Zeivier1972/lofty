import ContactForm from "@/components/contacts/contact-form"

export default function NewContactPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add New Contact</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in the contact details below</p>
      </div>
      <ContactForm />
    </div>
  )
}
