"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Phone, Mail, Star, Facebook, Instagram, Linkedin,
  ChevronRight, MapPin, Bed, Bath, Maximize2, TrendingUp, Award, Shield, Menu, X,
  BarChart2, Calendar, User, ArrowRight, TrendingDown, Home,
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
  const [snapshot, setSnapshot] = useState<any>(null)
  const [blogPosts, setBlogPosts] = useState<any[]>([])

  // Load market snapshot + blog posts
  useState(() => {
    fetch("/api/site/market-snapshot").then(r => r.json()).then(setSnapshot).catch(() => {})
    fetch("/api/blog?public=1").then(r => r.json()).then(d => { if (Array.isArray(d)) setBlogPosts(d) }).catch(() => {})
  })

  const agentName    = websiteConfig?.agentName    || config?.realtorName  || "Catherine Gomez"
  const agentTitle   = websiteConfig?.agentTitle   || "CEO / AGENT  |  License ID: 3320405"
  const agentBio     = websiteConfig?.agentBio     || config?.agentPersona ||
    "Catherine Gomez es una agente de bienes raíces con licencia en Florida y una carrera que comenzó en 2004. Está dedicada a ayudar a sus clientes a encontrar la casa de sus sueños, vender propiedades y navegar el mercado inmobiliario.\n\nCon más de dos décadas de experiencia en el mercado de bienes raíces de Florida, Catherine Gomez se compromete a guiar a sus clientes en cada paso de su camino inmobiliario. Su dedicación y profesionalismo le han valido altas recomendaciones de clientes satisfechos."
  const agentPhone   = websiteConfig?.agentPhone   || config?.realtorPhone || "+1(305) 283-0872"
  const agentEmail   = websiteConfig?.agentEmail   || config?.realtorEmail || "info@catherinegomezrealtor.com"
  const agentAddress = websiteConfig?.agentAddress || "14335 SW 120th St. Suite 101, Miami, Florida 33186, USA"
  const agentWebsite = websiteConfig?.agentWebsite || "https://catherinegomezrealtor.com"
  const agentPhotoUrl = websiteConfig?.agentPhotoUrl as string | undefined
  const heroTitle    = websiteConfig?.heroTitle    || "Catherine Gomez — Realtor AND Educator\nwho helps Latino families buy smart in Florida."
  const heroSubtitle = websiteConfig?.heroSubtitle || "\"I don't just sell homes—I teach you how to buy smart.\""
  const heroBgUrl    = websiteConfig?.heroBgUrl    || "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1920&q=80"
  const testimonials = parseJSON(websiteConfig?.testimonials, DEFAULT_TESTIMONIALS)
  const customStats  = parseJSON<{ value: string; label: string }[] | null>(websiteConfig?.stats, null)
  const facebookUrl  = websiteConfig?.facebookUrl  || "https://facebook.com/catherinegomezrealtor"
  const instagramUrl = websiteConfig?.instagramUrl || "https://instagram.com/catherinegomezrealtor"
  const linkedinUrl  = websiteConfig?.linkedinUrl  || "https://linkedin.com/in/catherinegomez"
  const youtubeUrl   = websiteConfig?.youtubeUrl   as string | undefined
  const whatsappUrl  = `https://wa.me/13052830872`

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

          {/* Right: CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/book" className="bg-[#c9a84c] text-white px-5 py-2 rounded-full font-semibold text-sm hover:bg-[#b8943f] transition-colors">
              Agenda tu cita
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
            <div className="px-4 py-3">
              <Link href="/book" onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center bg-[#c9a84c] text-white px-5 py-2 rounded-full font-semibold text-sm hover:bg-[#b8943f] transition-colors">
                Agenda tu cita
              </Link>
            </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Photo */}
            <div className="max-w-md mx-auto lg:mx-0">
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#0a1f35] aspect-[3/4]">
                {agentPhotoUrl
                  ? <img src={agentPhotoUrl} alt={agentName} className="w-full h-full object-cover object-top" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-[#c9a84c] flex items-center justify-center text-4xl font-bold text-[#1a3a5c]">
                        {initials}
                      </div>
                    </div>
                }
              </div>
            </div>
            {/* Dark info card */}
            <div className="bg-[#1a1a1a] rounded-2xl p-8 text-white">
              <p className="text-xs font-semibold tracking-widest text-gray-400 mb-1 uppercase">{agentTitle}</p>
              <h2 className="font-serif text-3xl font-bold text-white mb-5">{agentName}</h2>
              <div className="space-y-3 mb-6">
                {agentBio.split("\n\n").filter(Boolean).map((para: string, i: number) => (
                  <p key={i} className="text-gray-300 leading-relaxed text-sm">{para}</p>
                ))}
              </div>
              <div className="space-y-2.5 mb-6 pt-5 border-t border-white/10">
                {[
                  { icon: Phone,         text: agentPhone,   href: `tel:${agentPhone.replace(/\D/g,"")}` },
                  { icon: Mail,          text: agentEmail,   href: `mailto:${agentEmail}` },
                  { icon: MapPin,        text: agentAddress, href: undefined },
                  { icon: ChevronRight,  text: agentWebsite, href: agentWebsite, external: true },
                ].map(({ icon: Icon, text, href, external }) => (
                  <div key={text} className="flex items-start gap-3 text-sm text-gray-300">
                    <Icon className="w-4 h-4 text-[#c9a84c] flex-shrink-0 mt-0.5" />
                    {href
                      ? <a href={href} target={external ? "_blank" : undefined} rel="noopener noreferrer"
                          className="hover:text-[#c9a84c] transition-colors break-all">{text}</a>
                      : <span>{text}</span>
                    }
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { label: "Facebook",  href: facebookUrl,  color: "#1877F2", el: <Facebook  className="w-4 h-4" /> },
                  { label: "LinkedIn",  href: linkedinUrl,  color: "#0A66C2", el: <Linkedin  className="w-4 h-4" /> },
                  { label: "Instagram", href: instagramUrl, color: "#E1306C", el: <Instagram className="w-4 h-4" /> },
                  { label: "YouTube",   href: youtubeUrl,   color: "#FF0000", el: <span className="text-xs font-bold">YT</span> },
                  { label: "WhatsApp",  href: whatsappUrl,  color: "#25D366", el: <Phone     className="w-4 h-4" /> },
                ].filter(s => s.href).map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: s.color }}>
                    {s.el}
                  </a>
                ))}
              </div>
              <a href="/book" target="_blank"
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#c9a84c] hover:bg-[#b8963e] text-white font-bold rounded transition-colors tracking-wide text-sm">
                BOOK APPOINTMENT
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

      {/* ── MARKET SNAPSHOT ────────────────────────────────────────────────── */}
      <section id="market" className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-light tracking-widest text-gray-700 uppercase">MARKET SNAPSHOT</h2>
            <Link href="/search" className="text-sm text-[#c9a84c] font-semibold hover:underline flex items-center gap-1">
              View All Listings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {snapshot?.dateRange && (
            <p className="text-sm text-gray-500 mb-8">({snapshot.dateRange})</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-gray-200 rounded-xl overflow-hidden">
            {[
              {
                label: "Active Listings",
                value: snapshot?.activeListings ?? "—",
                sub: snapshot?.newListings30d ? `${snapshot.newListings30d} new this month` : "Miami Market",
                icon: Home,
                trend: null,
              },
              {
                label: "Average List Price",
                value: snapshot?.avgPrice
                  ? `$${snapshot.avgPrice >= 1_000_000
                      ? (snapshot.avgPrice / 1_000_000).toFixed(1) + "M"
                      : Math.round(snapshot.avgPrice / 1000) + "K"}`
                  : "$843K",
                sub: snapshot?.avgPrice ? "Active listings" : "Miami avg (est.)",
                icon: BarChart2,
                trend: "down",
              },
              {
                label: "Avg Days on Market",
                value: snapshot?.avgDaysOnMarket ?? "79",
                sub: "Active listings",
                icon: Calendar,
                trend: "up",
              },
            ].map((stat, i) => (
              <div key={stat.label}
                className={`p-8 bg-white ${i > 0 ? "border-l border-gray-200" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-5xl font-bold text-gray-900 mb-1">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center flex-shrink-0">
                    <stat.icon className="w-6 h-6 text-[#c9a84c]" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-[#1a3a5c]/5 rounded-xl border border-[#1a3a5c]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 text-center sm:text-left">
              <strong>Want a personalized market analysis?</strong> Catherine will review your specific neighborhood and give you a free Comparative Market Analysis.
            </p>
            <a href="#contact"
              className="flex-shrink-0 px-6 py-2.5 bg-[#c9a84c] text-white rounded-full text-sm font-semibold hover:bg-[#b8963e] transition-colors whitespace-nowrap">
              Get Free CMA
            </a>
          </div>
        </div>
      </section>

      {/* ── BLOG ───────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-1">Real Estate Education</p>
              <h2 className="font-serif text-3xl font-bold text-gray-900">Latest from the Blog</h2>
            </div>
            <Link href="/site/blog"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#c9a84c] hover:underline">
              View All Posts <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {blogPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogPosts.slice(0, 3).map((post: any) => {
                const tags = Array.isArray(post.tags) ? post.tags : (() => { try { return JSON.parse(post.tags || "[]") } catch { return [] } })()
                return (
                  <Link key={post.id} href={`/site/blog/${post.slug}`}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                    {post.coverImage && (
                      <div className="aspect-video overflow-hidden">
                        <img src={post.coverImage} alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    <div className="p-5">
                      {tags.slice(0, 1).map((tag: string) => (
                        <span key={tag} className="text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-full mr-1">{tag}</span>
                      ))}
                      <h3 className="font-serif text-lg font-bold text-gray-900 mt-2 mb-2 group-hover:text-[#c9a84c] transition-colors leading-snug">
                        {post.title}
                      </h3>
                      {post.excerpt && <p className="text-gray-500 text-sm line-clamp-2 mb-3">{post.excerpt}</p>}
                      <div className="flex items-center gap-2 text-xs text-gray-400 pt-3 border-t">
                        <User className="w-3 h-3" />{post.author}
                        {post.publishedAt && <><Calendar className="w-3 h-3 ml-2" />{new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            /* Placeholder posts until blog is populated */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "5 Things Every First-Time Buyer in Miami Must Know", tag: "Education", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80", excerpt: "Before you start your home search, there are five things I teach every client to set them up for success." },
                { title: "Miami Market Snapshot: What's Happening in June 2026", tag: "Market Snapshot", img: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=800&q=80", excerpt: "The Miami market is showing signs of stabilization. Here's what the numbers say right now." },
                { title: "Doral vs. Kendall: Which Neighborhood Is Right for Your Family?", tag: "Neighborhoods", img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80", excerpt: "Two of Miami's most popular family neighborhoods — but they're very different. Here's the breakdown." },
              ].map((post, i) => (
                <Link key={i} href="/site/blog"
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="aspect-video overflow-hidden">
                    <img src={post.img} alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-full">{post.tag}</span>
                    <h3 className="font-serif text-lg font-bold text-gray-900 mt-2 mb-2 group-hover:text-[#c9a84c] transition-colors leading-snug">{post.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{post.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/site/blog"
              className="inline-flex items-center gap-2 px-8 py-3 border-2 border-[#c9a84c] text-[#c9a84c] rounded-full font-semibold hover:bg-[#c9a84c] hover:text-white transition-colors">
              Read All Posts <ChevronRight className="w-4 h-4" />
            </Link>
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
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#c9a84c] flex-shrink-0"/>{agentPhone}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#c9a84c] flex-shrink-0"/>{agentEmail}</div>
                <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#c9a84c] flex-shrink-0 mt-0.5"/><span>{agentAddress}</span></div>
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
