"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft, Heart, Share2, MapPin, Bed, Bath, Square, Calendar,
  Home, Building2, CheckCircle2, Phone, Mail, MessageSquare, X,
  ChevronLeft, ChevronRight, DollarSign, Tag,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface Property {
  id: string
  title: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  type: string
  status: string
  images: string
  description: string | null
  yearBuilt: number | null
  lotSize: number | null
  garage: number | null
  listingDate: string | null
}

interface LeadForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
}

function getImages(raw: string): string[] {
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

export default function PropertyDetailClient({ property }: { property: Property }) {
  const [isSaved, setIsSaved] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [showContactModal, setShowContactModal] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const [leadContactId, setLeadContactId] = useState<string | null>(null)
  const [leadForm, setLeadForm] = useState<LeadForm>({
    firstName: "", lastName: "", email: "", phone: "",
    message: `I'm interested in ${property.address}. Please contact me to schedule a showing.`,
  })

  const images = getImages(property.images)

  // Track view on mount
  useEffect(() => {
    fetch("/api/properties/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id }),
    })
  }, [property.id])

  async function handleSave() {
    if (!leadContactId && !leadSaved) {
      setShowContactModal(true)
      return
    }
    setIsSaved(true)
    await fetch("/api/properties/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id, contactId: leadContactId }),
    })
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: leadForm.firstName,
        lastName: leadForm.lastName,
        email: leadForm.email,
        phone: leadForm.phone,
        source: "IDX_SEARCH",
        status: "NEW_LEAD",
      }),
    })
    const data = await res.json()
    const contactId = data.id

    setLeadContactId(contactId)
    setLeadSaved(true)
    setIsSaved(true)
    setShowContactModal(false)

    // Save property
    await fetch("/api/properties/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id, contactId }),
    })
  }

  const prevImage = () => setCurrentImage(i => (i - 1 + images.length) % images.length)
  const nextImage = () => setCurrentImage(i => (i + 1) % images.length)

  const details = [
    { label: "Bedrooms", value: property.bedrooms ? `${property.bedrooms} beds` : "—", icon: Bed },
    { label: "Bathrooms", value: property.bathrooms ? `${property.bathrooms} baths` : "—", icon: Bath },
    { label: "Square Feet", value: property.sqft ? property.sqft.toLocaleString() + " sqft" : "—", icon: Square },
    { label: "Year Built", value: property.yearBuilt ? String(property.yearBuilt) : "—", icon: Calendar },
    { label: "Lot Size", value: property.lotSize ? property.lotSize.toLocaleString() + " sqft" : "—", icon: Home },
    { label: "Garage", value: property.garage ? `${property.garage} car` : "—", icon: Building2 },
    { label: "Type", value: property.type.replace("_", " "), icon: Tag },
    { label: "Status", value: property.status, icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/search" className="flex items-center gap-2 text-gray-600 hover:text-lofty-700">
              <ArrowLeft className="w-4 h-4" /> Back to Search
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                  isSaved ? "bg-red-50 border-red-300 text-red-600" : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500"
                )}
              >
                <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <button
                onClick={() => navigator.share?.({ title: property.title, url: window.location.href })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-lofty-300 hover:text-lofty-700 text-sm font-medium"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Images + details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image gallery */}
            <div className="relative bg-gray-200 rounded-2xl overflow-hidden h-96 shadow-sm">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImage]}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentImage(i)}
                            className={cn("w-2 h-2 rounded-full transition-colors", i === currentImage ? "bg-white" : "bg-white/50")}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Home className="w-20 h-20 text-gray-400" />
                </div>
              )}
              {/* Status overlay */}
              <div className="absolute top-4 left-4">
                <span className={cn(
                  "text-sm font-bold px-3 py-1.5 rounded-lg",
                  property.status === "ACTIVE" ? "bg-green-500 text-white" :
                  property.status === "PENDING" ? "bg-amber-500 text-white" :
                  "bg-gray-500 text-white"
                )}>
                  {property.status}
                </span>
              </div>
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={cn(
                      "flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                      i === currentImage ? "border-lofty-500" : "border-transparent"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Title + price */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
              <div className="flex items-center gap-2 text-gray-500 mt-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-3xl font-bold text-lofty-700">{formatCurrency(property.price)}</span>
                {property.sqft && (
                  <span className="text-gray-500 text-sm">
                    {formatCurrency(Math.round(property.price / property.sqft))}/sqft
                  </span>
                )}
              </div>
            </div>

            {/* Property details grid */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Property Details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {details.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                    <Icon className="w-5 h-5 text-lofty-600 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {property.description && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold text-gray-900 mb-3">About This Home</h2>
                <p className="text-gray-600 leading-relaxed text-sm">{property.description}</p>
              </div>
            )}
          </div>

          {/* Right: Contact agent card */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6 sticky top-24">
              <div className="text-center mb-5">
                <div className="w-16 h-16 bg-lofty-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-lofty-700">C</span>
                </div>
                <h3 className="font-bold text-gray-900">Catherine</h3>
                <p className="text-sm text-gray-500">Licensed Real Estate Agent</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="text-amber-400 text-xs">★</span>
                  ))}
                  <span className="text-xs text-gray-500 ml-1">5.0</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full py-3 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Request a Showing
                </button>
                <a
                  href="tel:+15555555555"
                  className="w-full py-2.5 border-2 border-lofty-200 text-lofty-700 rounded-xl font-medium hover:bg-lofty-50 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Phone className="w-4 h-4" /> (555) 555-5555
                </a>
              </div>

              {leadSaved && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Our agent will reach out shortly!
                </div>
              )}

              <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Free consultation
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Typically responds within 1 hour
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  AI-powered property matching
                </div>
              </div>
            </div>

            {/* Price history placeholder */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Listed</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-lofty-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-lofty-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">{formatCurrency(property.price)}</div>
                  <div className="text-xs text-gray-500">
                    {property.listingDate
                      ? new Date(property.listingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "Active listing"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Contact / Lead modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Request a Showing</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{property.address}</p>
                </div>
                <button onClick={() => setShowContactModal(false)} className="text-gray-400 hover:text-gray-600 mt-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">First Name *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.firstName}
                      onChange={e => setLeadForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.lastName}
                      onChange={e => setLeadForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Email *</label>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone</label>
                  <input
                    type="tel"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Message</label>
                  <textarea
                    rows={3}
                    value={leadForm.message}
                    onChange={e => setLeadForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500 resize-none"
                  />
                </div>
                <div className="bg-lofty-50 rounded-lg p-3 text-xs text-lofty-700">
                  Our AI agent Alex will contact you immediately via text and email to confirm your showing request.
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors"
                >
                  Request Showing
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
