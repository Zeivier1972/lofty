"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Phone, Mail, Star, Facebook, Instagram, Linkedin,
  ChevronRight, MapPin, Bed, Bath, Maximize2, TrendingUp, Award, Shield, Menu, X,
} from "lucide-react"
import type { AIConfig, Property } from "@prisma/client"

// ─── Featured Areas ───────────────────────────────────────────────────────────
const FEATURED_AREAS = [
  { name: "Miami",             img: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=800&q=80" },
  { name: "Homestead",        img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80" },
  { name: "Brickell",         img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&q=80" },
  { name: "Pinecrest",        img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80" },
  { name: "Doral",            img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80" },
  { name: "Kendall",          img: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=800&q=80" },
  { name: "Cutler Bay",       img: "https://images.unsplash.com/photo-1546877625-cb8c71916608?auto=format&fit=crop&w=800&q=80" },
  { name: "Coral Gables",     img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" },
  { name: "Sunny Isles Beach",img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80" },
]

// ─── Nav links ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "HOME",             href: "/site" },
  { label: "BUY",              href: "/search" },
  { label: "SELL",             href: "/site#contact" },
  { label: "PRE-CONSTRUCTION", href: "/search" },
  { label: "ABOUT",            href: "/site#about" },
  { label: "MARKET SNAPSHOT",  href: "/site#market" },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)
}

function parseImages(images: string | null | undefined): string[] {
  if (!images) return []
  try { return JSON.parse(images) } catch { return [] }
}

function parseJSON<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) } catch { return fallback }
}

function PropertyCard({ property }: { property: Property }) {
  const images = parseImages(property.images)
  return (
    <Link href={`/site/listing/${property.id}`}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <div className="aspect-[4/3] overflow-hidden relative bg-gray-200">
        {images[0]
          ? <img src={images[0]} alt={property.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
              <MapPin className="w-10 h-10 text-gray-400" />
            </div>
        }
        <span className="absolute top-3 left-3 bg-[#c9a84c] text-white text-xs font-bold px-3 py-1 rounded-full">For Sale</span>
      </div>
      <div className="p-5">
        <p className="text-2xl font-bold text-[#c9a84c] mb-1">{formatPrice(property.price)}</p>
        <p className="text-gray-600 text-sm mb-3">{property.address}, {property.city}</p>
        <div className="flex gap-3 text-xs text-gray-500 border-t pt-3">
          {property.bedrooms  && <span className="flex items-center gap-1"><Bed className="w-3 h-3"/>{property.bedrooms} bd</span>}
          {property.bathrooms && <span className="flex items-center gap-1"><Bath className="w-3 h-3"/>{property.bathrooms} ba</span>}
          {property.sqft      && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3"/>{property.sqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </Link>
  )
}

const DEFAULT_TESTIMONIALS = [
  { id: 1, name: "Maria & Carlos R.", role: "Home Buyers", text: "Catherine nos ayudó a encontrar nuestra casa perfecta en Doral. Su conocimiento del mercado es increíble y siempre estuvo disponible para responder nuestras preguntas.", stars: 5 },
  { id: 2, name: "Jennifer M.", role: "Home Seller", text: "Vendí mi propiedad en Coral Gables por encima del precio de venta en solo 10 días. El marketing de Catherine es de primer nivel.", stars: 5 },
  { id: 3, name: "Roberto & Ana L.", role: "First-Time Buyers", text: "Como compradores por primera vez, Catherine nos educó en cada paso del proceso. Cumplió su promesa: nos enseñó a comprar inteligente.", stars: 5 },
]

interface HomeClientProps {
  config: AIConfig | null
  websiteConfig?: any
  featuredProperties: Property[]
  stats: { _count: number; _avg: { price: number | null } }
}

export default function HomeClient({ config, websiteConfig, featuredProperties }: HomeClientProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "", interest: "BUYING" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const agentName   = websiteConfig?.agentName  || config?.realtorName  || "Catherine Gomez"
  const agentBio    = websiteConfig?.agentBio   || config?.agentPersona || "Soy Catherine Gomez, Realtor y Educadora con más de 20 años de experiencia en el mercado inmobiliario de Miami. Mi misión es ayudar a familias latinas a comprar inteligente en Florida. No solo vendo casas — te enseño cómo comprar con confianza."
  const agentPhone  = websiteConfig?.agentPhone || config?.realtorPhone || "(305) 000-0000"
  const agentEmail  = websiteConfig?.agentEmail || config?.realtorEmail || "catherine@catherinegomezpa.com"
  const agentPhotoUrl = websiteConfig?.agentPhotoUrl as string | undefined
  const heroTitle   = websiteConfig?.heroTitle  || "Catherine Gomez — Realtor AND Educator\nwho helps Latino families buy smart in Florida."
  const heroSubtitle = websiteConfig?.heroSubtitle || "\"I don't just sell homes—I teach you how to buy smart.\""
  const heroBgUrl   = websiteConfig?.heroBgUrl  || "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1920&q=80"
  const testimonials = parseJSON(websiteConfig?.testimonials, DEFAULT_TESTIMONIALS)
  const customStats  = parseJSON<{ value: string; label: string }[] | null>(websiteConfig?.stats, null)
  const facebookUrl  = websiteConfig?.facebookUrl as string | undefined
  const instagramUrl = websiteConfig?.instagramUrl as string | undefined
  const linkedinUrl  = websiteConfig?.linkedinUrl as string | undefined

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = searchQuery ? `?city=${encodeURIComponent(searchQuery)}` : ""
    router.push(`/search${params}`)
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const initials = agentName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="font-sans bg-white">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/site" className="flex items-center gap-2 flex-shrink-0">
            {agentPhotoUrl
              ? <img src={agentPhotoUrl} alt={agentName} className="h-10 w-auto" />
              : (
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded bg-[#1a3a5c] flex items-center justify-center">
                    <span className="text-[#c9a84c] text-xs font-bold">CG</span>
                  </div>
                  <div className="leading-tight">
                    <p className="text-[#1a3a5c] font-bold text-sm leading-tight">Catherine</p>
                    <p className="text-[#1a3a5c] font-bold text-sm leading-tight">Gomez P.A.</p>
                  </div>
                </div>
              )
            }
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold tracking-wide">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href}
                className="text-gray-700 hover:text-[#c9a84c] transition-colors pb-0.5 border-b-2 border-transparent hover:border-[#c9a84c]">
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right: auth links */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-semibold text-gray-600">
            <Link href="/login" className="hover:text-[#c9a84c] transition-colors">SIGN IN</Link>
            <Link href="/login" className="px-4 py-1.5 border border-[#c9a84c] text-[#c9a84c] rounded hover:bg-[#c9a84c] hover:text-white transition-colors">
              REGISTER
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 py-2">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-gray-700 hover:text-[#c9a84c] hover:bg-gray-50">
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[75vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <img src={heroBgUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-16 pb-24">
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            {heroTitle.includes("\n")
              ? heroTitle.split("\n").map((line: string, i: number) => <span key={i} className={i > 0 ? "block" : ""}>{line}</span>)
              : heroTitle
            }
          </h1>
          <p className="text-gray-200 text-lg md:text-xl italic">{heroSubtitle}</p>
        </div>

        {/* Search bar — overlapping hero bottom */}
        <div className="relative z-10 w-full max-w-4xl px-4 -mb-8">
          <form onSubmit={handleSearch}
            className="bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-wrap items-center gap-0 overflow-hidden">
            <input
              type="text"
              placeholder="City, County, Subdivision, etc"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 px-5 py-4 text-sm text-gray-700 outline-none placeholder-gray-400"
            />
            <button type="submit"
              className="px-5 py-4 bg-[#c9a84c] hover:bg-[#b8963e] text-white transition-colors flex-shrink-0">
              <Search className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-gray-200 hidden sm:block" />
            <Link href="/search" className="hidden sm:flex items-center gap-1.5 px-4 py-4 text-sm text-gray-600 hover:text-[#c9a84c] border-l border-gray-200 whitespace-nowrap">
              Search <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            {["Price", "Beds", "Baths", "Property Type"].map(f => (
              <button key={f} type="button" onClick={() => router.push("/search")}
                className="hidden md:flex items-center gap-1 px-4 py-4 text-sm text-gray-600 hover:text-[#c9a84c] border-l border-gray-200 whitespace-nowrap">
                {f}
              </button>
            ))}
            <button type="button" onClick={() => router.push("/search")}
              className="hidden md:flex items-center gap-1 px-4 py-4 text-sm font-semibold text-gray-700 hover:text-[#c9a84c] border-l border-gray-200">
              Filters
            </button>
          </form>
        </div>
      </section>

      {/* Spacer for search bar overlap */}
      <div className="h-12 bg-white" />

      {/* ── FEATURED AREAS ─────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <h2 className="text-2xl font-light tracking-widest text-gray-700 uppercase mb-10">
            FEATURED AREAS
          </h2>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {FEATURED_AREAS.map((area, idx) => (
              <Link key={area.name} href={`/search?city=${encodeURIComponent(area.name)}`}
                className={`relative overflow-hidden rounded-lg block group ${
                  idx === 0 || idx === 4 ? "break-inside-avoid" : "break-inside-avoid"
                }`}
                style={{ height: idx % 3 === 1 ? "280px" : "220px" }}>
                <img
                  src={area.img}
                  alt={area.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-semibold text-lg drop-shadow">{area.name}</p>
                  <div className="w-8 h-0.5 bg-[#c9a84c] mt-1 group-hover:w-16 transition-all duration-300" />
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/search"
              className="inline-flex items-center gap-2 px-8 py-3 border-2 border-[#c9a84c] text-[#c9a84c] rounded-full font-semibold hover:bg-[#c9a84c] hover:text-white transition-colors">
              View All Listings <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED PROPERTIES ────────────────────────────────────────────── */}
      {featuredProperties.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-screen-xl mx-auto px-4">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-2">Active Listings</p>
              <h2 className="font-serif text-4xl font-bold text-gray-900">Featured Properties</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProperties.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
            <div className="text-center mt-10">
              <Link href="/search"
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#c9a84c] text-white rounded-full font-semibold hover:bg-[#b8963e] transition-colors">
                View All Properties <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-[#1a3a5c] text-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {(customStats || [
              { value: "500+", label: "Homes Sold" },
              { value: "$200M+", label: "In Sales" },
              { value: "20+ Years", label: "Experience" },
              { value: "5★", label: "Rated" },
            ]).map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-[#c9a84c]">{s.value}</p>
                <p className="text-gray-300 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ME ─────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-2">Why Work With Me</p>
            <h2 className="font-serif text-4xl font-bold text-gray-900">The Catherine Gomez Difference</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: TrendingUp, title: "Miami Market Expert", desc: "20+ years specializing in Miami-Dade. I know every neighborhood, price trend, and hidden opportunity in this market." },
              { icon: Award,      title: "Educator First",      desc: "I teach you how to buy smart — from pre-approval to closing, you'll understand every step before you sign anything." },
              { icon: Shield,     title: "Bilingual Service",   desc: "Fluent in English and Spanish. I bridge cultural and language barriers so Latino families feel confident and informed." },
            ].map(item => (
              <div key={item.title} className="p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-[#c9a84c]/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7 text-[#c9a84c]" />
                </div>
                <h3 className="font-serif text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ──────────────────────────────────────────────────────────── */}
      <section id="about" className="py-16 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#0a1f35]">
                {agentPhotoUrl
                  ? <img src={agentPhotoUrl} alt={agentName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-[#c9a84c] flex items-center justify-center text-4xl font-bold text-[#1a3a5c]">
                        {initials}
                      </div>
                    </div>
                }
              </div>
              <div className="absolute -bottom-3 -right-3 w-full h-full rounded-3xl border-2 border-[#c9a84c]/30 -z-10" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-3">About Me</p>
              <h2 className="font-serif text-4xl font-bold text-gray-900 mb-6">{agentName}</h2>
              <p className="text-gray-600 leading-relaxed text-lg mb-6">{agentBio}</p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-gray-700">
                  <Phone className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />{agentPhone}
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Mail className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />{agentEmail}
                </div>
              </div>
              <a href="#contact"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white bg-[#c9a84c] hover:bg-[#b8963e] transition-colors">
                Schedule a Consultation <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-2">Client Stories</p>
            <h2 className="font-serif text-4xl font-bold text-gray-900">What Clients Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t: any) => (
              <div key={t.id} className="p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_,i) => (
                    <Star key={i} className="w-4 h-4 fill-[#c9a84c] text-[#c9a84c]" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#c9a84c] flex items-center justify-center text-sm font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 bg-[#1a3a5c]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-2">Get In Touch</p>
            <h2 className="font-serif text-4xl font-bold text-white mb-3">Let&apos;s Find Your Dream Home</h2>
            <p className="text-gray-400">Ready to take the next step? I&apos;d love to hear from you.</p>
          </div>

          {submitted ? (
            <div className="text-center py-16 rounded-3xl bg-white/10 border border-[#c9a84c]/30">
              <p className="text-3xl font-serif font-bold text-white mb-3">¡Message Received!</p>
              <p className="text-gray-300">Catherine will be in touch within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "firstName", label: "First Name", required: true, type: "text" },
                { key: "lastName",  label: "Last Name",  required: true, type: "text" },
                { key: "email",     label: "Email",      required: true, type: "email" },
                { key: "phone",     label: "Phone",      required: false, type: "tel" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">{f.label}{f.required && " *"}</label>
                  <input required={f.required} type={f.type}
                    value={(contactForm as any)[f.key]}
                    onChange={e => setContactForm({ ...contactForm, [f.key]: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                <textarea rows={4} value={contactForm.message}
                  onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Tell me about your real estate goals..."
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={submitting}
                  className="w-full py-4 rounded-xl font-semibold text-lg text-[#1a3a5c] bg-[#c9a84c] hover:bg-[#e8c97a] transition-colors disabled:opacity-50">
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0f2236] py-12 border-t border-white/10">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <p className="font-serif text-xl font-bold text-white mb-3">{agentName}</p>
              <p className="text-gray-400 text-sm leading-relaxed">Miami Real Estate · Realtor & Educator · Helping Latino families buy smart in Florida.</p>
              <div className="flex gap-3 mt-5">
                {[{ icon: Facebook, url: facebookUrl }, { icon: Instagram, url: instagramUrl }, { icon: Linkedin, url: linkedinUrl }].map(({ icon: Icon, url }, i) => (
                  <a key={i} href={url || "#"} target={url ? "_blank" : undefined} rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-[#c9a84c] hover:border-[#c9a84c] transition-colors">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                {NAV_LINKS.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-gray-400 hover:text-[#c9a84c] transition-colors text-sm">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Contact</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#c9a84c]"/>{agentPhone}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#c9a84c]"/>{agentEmail}</div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-gray-500 text-xs">
            &copy; 2026 {agentName}. All rights reserved. · <Link href="/privacy" className="hover:text-[#c9a84c]">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
