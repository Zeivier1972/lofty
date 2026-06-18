"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Phone, Mail, Star, Facebook, Instagram, Linkedin, Youtube,
  ChevronRight, MapPin, Bed, Bath, Maximize2, TrendingUp, Award, Shield,
  Menu, X, BarChart2, Calendar, User, ArrowRight, Home, MessageCircle,
  CheckCircle, ChevronDown,
} from "lucide-react"
import type { AIConfig, Property } from "@prisma/client"

// ─── Featured Areas ───────────────────────────────────────────────────────────
const FEATURED_AREAS = [
  { name: "Miami",              img: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=1200&q=90" },
  { name: "Brickell",          img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=90" },
  { name: "Coral Gables",      img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=90" },
  { name: "Doral",             img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=90" },
  { name: "Sunny Isles Beach", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=90" },
  { name: "Kendall",           img: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1200&q=90" },
  { name: "Homestead",         img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=90" },
  { name: "Pinecrest",         img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=90" },
  { name: "Cutler Bay",        img: "https://images.unsplash.com/photo-1546877625-cb8c71916608?auto=format&fit=crop&w=1200&q=90" },
]

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
      className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden group border border-gray-100 hover:border-[#c9a84c]/40">
      <div className="aspect-[4/3] overflow-hidden relative bg-gray-200">
        {images[0]
          ? <img src={images[0]} alt={property.address} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a3a5c] to-[#0a1f35]">
              <MapPin className="w-10 h-10 text-[#c9a84c]/60" />
            </div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="absolute top-3 left-3 bg-[#c9a84c] text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">For Sale</span>
        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <span className="block w-full text-center bg-white text-[#1a3a5c] text-xs font-bold py-2 rounded-lg">View Details →</span>
        </div>
      </div>
      <div className="p-5">
        <p className="text-2xl font-bold text-[#c9a84c] mb-1">{formatPrice(property.price)}</p>
        <p className="text-gray-600 text-sm mb-3 truncate">{property.address}, {property.city}</p>
        <div className="flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
          {property.bedrooms  && <span className="flex items-center gap-1.5"><Bed className="w-3.5 h-3.5 text-[#c9a84c]"/>{property.bedrooms} bd</span>}
          {property.bathrooms && <span className="flex items-center gap-1.5"><Bath className="w-3.5 h-3.5 text-[#c9a84c]"/>{property.bathrooms} ba</span>}
          {property.sqft      && <span className="flex items-center gap-1.5"><Maximize2 className="w-3.5 h-3.5 text-[#c9a84c]"/>{property.sqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </Link>
  )
}

const DEFAULT_TESTIMONIALS = [
  { id: 1, name: "Maria & Carlos R.", role: "Home Buyers — Doral", text: "Catherine nos ayudó a encontrar nuestra casa perfecta en Doral. Su conocimiento del mercado es increíble y siempre estuvo disponible para responder nuestras preguntas.", stars: 5 },
  { id: 2, name: "Jennifer M.", role: "Home Seller — Coral Gables", text: "Vendí mi propiedad en Coral Gables por encima del precio de venta en solo 10 días. El marketing de Catherine es de primer nivel.", stars: 5 },
  { id: 3, name: "Roberto & Ana L.", role: "First-Time Buyers — Miami", text: "Como compradores por primera vez, Catherine nos educó en cada paso del proceso. Cumplió su promesa: nos enseñó a comprar inteligente.", stars: 5 },
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
  const [heroForm, setHeroForm] = useState({ name: "", phone: "" })
  const [heroSubmitting, setHeroSubmitting] = useState(false)
  const [heroSubmitted, setHeroSubmitted] = useState(false)
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "", interest: "BUYING" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [snapshot, setSnapshot] = useState<any>(null)
  const [blogPosts, setBlogPosts] = useState<any[]>([])

  useState(() => {
    fetch("/api/site/market-snapshot").then(r => r.json()).then(setSnapshot).catch(() => {})
    fetch("/api/blog?public=1").then(r => r.json()).then(d => { if (Array.isArray(d)) setBlogPosts(d) }).catch(() => {})
  })

  const agentName    = websiteConfig?.agentName    || config?.realtorName  || "Catherine Gomez"
  const agentTitle   = websiteConfig?.agentTitle   || "CEO / AGENT  |  License ID: 3320405"
  const agentBio     = websiteConfig?.agentBio     || "Catherine Gomez es una agente de bienes raíces con licencia en Florida y una carrera que comenzó en 2004. Está dedicada a ayudar a sus clientes a encontrar la casa de sus sueños, vender propiedades y navegar el mercado inmobiliario.\n\nCon más de dos décadas de experiencia en el mercado de bienes raíces de Florida, Catherine Gomez se compromete a guiar a sus clientes en cada paso de su camino inmobiliario. Su dedicación y profesionalismo le han valido altas recomendaciones de clientes satisfechos."
  const agentPhone   = websiteConfig?.agentPhone   || config?.realtorPhone || "+1(305) 283-0872"
  const agentEmail   = websiteConfig?.agentEmail   || config?.realtorEmail || "info@catherinegomezrealtor.com"
  const agentAddress = websiteConfig?.agentAddress || "14335 SW 120th St. Suite 101, Miami, Florida 33186, USA"
  const agentWebsite = websiteConfig?.agentWebsite || "https://catherinegomezrealtor.com"
  const agentPhotoUrl = websiteConfig?.agentPhotoUrl as string | undefined
  const heroTitle    = websiteConfig?.heroTitle    || "Tu Hogar en Miami\nEmpieza Aquí."
  const heroSubtitle = websiteConfig?.heroSubtitle || "Catherine Gomez — Realtor, Educadora y Experta en el mercado de Florida durante más de 20 años."
  const heroBgUrl    = websiteConfig?.heroBgUrl    || "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1920&q=90"
  const testimonials = parseJSON(websiteConfig?.testimonials, DEFAULT_TESTIMONIALS)
  const customStats  = parseJSON<{ value: string; label: string }[] | null>(websiteConfig?.stats, null)
  const facebookUrl  = websiteConfig?.facebook  || "https://www.facebook.com/catherinegomezrealtors"
  const instagramUrl = websiteConfig?.instagram || "https://www.instagram.com/catherine_gomez_realtor/"
  const linkedinUrl  = websiteConfig?.linkedin  as string | undefined
  const youtubeUrl   = websiteConfig?.youtube   as string | undefined
  const whatsappUrl  = websiteConfig?.whatsapp  || `https://wa.me/13052830872`

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = searchQuery ? `?city=${encodeURIComponent(searchQuery)}` : ""
    router.push(`/search${params}`)
  }

  async function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault()
    setHeroSubmitting(true)
    try {
      await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: heroForm.name.split(" ")[0] || heroForm.name, lastName: heroForm.name.split(" ").slice(1).join(" ") || "", phone: heroForm.phone, interest: "BUYING", message: "Hero form lead" }),
      })
      setHeroSubmitted(true)
    } finally {
      setHeroSubmitting(false)
    }
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

      {/* ── STICKY WHATSAPP BUTTON ─────────────────────────────────────────── */}
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-green-400/40 hover:scale-105 transition-all duration-300 font-semibold text-sm">
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">WhatsApp Catherine</span>
      </a>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/site" className="flex items-center gap-2.5 flex-shrink-0">
            {agentPhotoUrl
              ? <img src={agentPhotoUrl} alt={agentName} className="h-10 w-auto rounded-lg" />
              : (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-[#1a3a5c] flex items-center justify-center shadow-md">
                    <span className="text-[#c9a84c] text-xs font-black tracking-tight">CG</span>
                  </div>
                  <div className="leading-tight">
                    <p className="text-[#1a3a5c] font-black text-sm tracking-tight leading-none">Catherine Gomez</p>
                    <p className="text-[#c9a84c] text-[10px] font-semibold tracking-widest uppercase leading-tight">Realtor · Florida</p>
                  </div>
                </div>
              )
            }
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href}
                className="px-3 py-2 text-xs font-bold tracking-wider text-gray-600 hover:text-[#c9a84c] transition-colors rounded-lg hover:bg-[#c9a84c]/5">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a href={`tel:${agentPhone.replace(/\D/g,"")}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#1a3a5c] transition-colors">
              <Phone className="w-3.5 h-3.5" />{agentPhone}
            </a>
            <Link href="/portal"
              className="border border-[#1a3a5c] text-[#1a3a5c] px-4 py-2 rounded-full font-bold text-xs hover:bg-[#1a3a5c] hover:text-white transition-all duration-300">
              Client Login
            </Link>
            <Link href="/book"
              className="bg-[#1a3a5c] text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-[#c9a84c] transition-all duration-300 shadow-md hover:shadow-[#c9a84c]/30">
              Agenda tu cita
            </Link>
          </div>

          <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 py-2 shadow-xl">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-bold text-gray-700 hover:text-[#c9a84c] hover:bg-gray-50 transition-colors">
                {l.label}
              </Link>
            ))}
            <div className="px-4 py-3 border-t border-gray-100 mt-1">
              <Link href="/book" onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center bg-[#1a3a5c] text-white px-5 py-3 rounded-full font-bold text-sm hover:bg-[#c9a84c] transition-colors">
                Agenda tu cita
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBgUrl} alt="" className="w-full h-full object-cover scale-105" style={{ transform: "scale(1.05)" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1f35]/90 via-[#0a1f35]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1f35]/50 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-screen-xl mx-auto px-4 py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              <span className="text-[#c9a84c] text-xs font-black tracking-[0.2em] uppercase">Miami · Florida · 20+ Years</span>
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-black text-white leading-[1.05] mb-6">
              {heroTitle.includes("\n")
                ? heroTitle.split("\n").map((line: string, i: number) => (
                    <span key={i} className={i === 1 ? "block text-[#c9a84c]" : "block"}>{line}</span>
                  ))
                : heroTitle
              }
            </h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">{heroSubtitle}</p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 mb-10">
              {["500+ Homes Sold", "Bilingüe", "Licencia #3320405"].map(t => (
                <div key={t} className="flex items-center gap-2 text-white/80 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <Link href="/book"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#1a3a5c] font-black rounded-full text-sm transition-all duration-300 shadow-lg shadow-[#c9a84c]/30 hover:shadow-[#c9a84c]/50 hover:scale-105">
                Consulta Gratuita <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/search"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full text-sm border border-white/30 transition-all duration-300 backdrop-blur-sm">
                Ver Propiedades <Search className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: lead capture card */}
          <div className="lg:justify-self-end w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#c9a84c]/20">
              <div className="bg-[#1a3a5c] px-6 py-5">
                <p className="text-[#c9a84c] text-xs font-black tracking-widest uppercase mb-1">Consulta Gratuita</p>
                <h2 className="text-white font-serif text-xl font-bold">Encuentra tu propiedad ideal</h2>
                <p className="text-gray-400 text-sm mt-1">Sin costo · Sin compromiso · En español</p>
              </div>
              {heroSubmitted ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg mb-2">¡Recibido!</p>
                  <p className="text-gray-500 text-sm">Catherine te contactará en menos de 24 horas.</p>
                </div>
              ) : (
                <form onSubmit={handleHeroSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tu Nombre</label>
                    <input required type="text" placeholder="María García"
                      value={heroForm.name}
                      onChange={e => setHeroForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#c9a84c] outline-none text-gray-800 text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tu Teléfono</label>
                    <input required type="tel" placeholder="+1 (305) 000-0000"
                      value={heroForm.phone}
                      onChange={e => setHeroForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#c9a84c] outline-none text-gray-800 text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">¿Qué buscas?</label>
                    <select className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#c9a84c] outline-none text-gray-800 text-sm transition-colors bg-white">
                      <option>Comprar una propiedad</option>
                      <option>Vender mi propiedad</option>
                      <option>Invertir en Florida</option>
                      <option>Pre-construcción</option>
                      <option>Solo explorando</option>
                    </select>
                  </div>
                  <button type="submit" disabled={heroSubmitting}
                    className="w-full py-4 bg-[#c9a84c] hover:bg-[#e8c97a] text-[#1a3a5c] font-black rounded-xl text-sm transition-all duration-300 shadow-md disabled:opacity-50 hover:shadow-[#c9a84c]/30 hover:shadow-lg">
                    {heroSubmitting ? "Enviando..." : "Hablar con Catherine →"}
                  </button>
                  <p className="text-center text-xs text-gray-400">🔒 Tu información es 100% privada</p>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────────── */}
      <div className="bg-[#1a3a5c] py-5 shadow-xl">
        <div className="max-w-screen-xl mx-auto px-4">
          <form onSubmit={handleSearch}
            className="flex items-center gap-0 bg-white rounded-2xl overflow-hidden shadow-lg border-2 border-[#c9a84c]/20">
            <div className="flex items-center gap-2 px-4 flex-1">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Ciudad, vecindario, código postal..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 py-4 text-sm text-gray-700 outline-none placeholder-gray-400"
              />
            </div>
            {["Price", "Beds", "Type"].map(f => (
              <button key={f} type="button" onClick={() => router.push("/search")}
                className="hidden md:flex items-center gap-1 px-4 py-4 text-sm text-gray-500 hover:text-[#c9a84c] border-l border-gray-200 whitespace-nowrap transition-colors">
                {f} <ChevronDown className="w-3 h-3" />
              </button>
            ))}
            <button type="submit"
              className="px-6 py-4 bg-[#c9a84c] hover:bg-[#b8963e] text-white font-bold text-sm transition-colors flex items-center gap-2 flex-shrink-0">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-gray-100">
            {(customStats || [
              { value: "500+",      label: "Propiedades Vendidas",    sub: "Desde 2004" },
              { value: "$200M+",    label: "En Ventas",               sub: "Volumen total" },
              { value: "20+ Años",  label: "De Experiencia",          sub: "En el mercado de Florida" },
              { value: "⭐ 5.0",    label: "Calificación",            sub: "Google & Zillow" },
            ]).map((s: any, i: number) => (
              <div key={s.label} className={`text-center py-8 px-4 ${i === 0 ? "" : ""}`}>
                <p className="text-3xl md:text-4xl font-black text-[#1a3a5c] mb-1">{s.value}</p>
                <p className="text-gray-800 font-bold text-sm">{s.label}</p>
                {s.sub && <p className="text-gray-400 text-xs mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED AREAS ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-3">Explore Florida</p>
            <h2 className="font-serif text-4xl md:text-5xl font-black text-[#1a3a5c]">Nuestras Áreas Destacadas</h2>
            <div className="w-16 h-1 bg-[#c9a84c] mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURED_AREAS.slice(0, 6).map((area, idx) => (
              <Link key={area.name} href={`/search?city=${encodeURIComponent(area.name)}`}
                className={`relative overflow-hidden rounded-2xl group border-2 border-transparent hover:border-[#c9a84c] transition-all duration-300 ${
                  idx === 0 ? "md:col-span-2 md:row-span-2" : ""
                }`}
                style={{ height: idx === 0 ? "420px" : "200px" }}>
                <img src={area.img} alt={area.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-[#1a3a5c]/0 group-hover:bg-[#1a3a5c]/20 transition-colors duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-white font-black text-xl drop-shadow-lg">{area.name}</p>
                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <div className="w-6 h-0.5 bg-[#c9a84c]" />
                    <span className="text-[#c9a84c] text-xs font-bold tracking-wide">Ver propiedades</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/search"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-full font-bold text-sm hover:bg-[#1a3a5c] hover:text-white transition-all duration-300">
              Ver Todas las Propiedades <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED PROPERTIES ────────────────────────────────────────────── */}
      {featuredProperties.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-screen-xl mx-auto px-4">
            <div className="text-center mb-12">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-3">Active Listings</p>
              <h2 className="font-serif text-4xl md:text-5xl font-black text-[#1a3a5c]">Propiedades Destacadas</h2>
              <div className="w-16 h-1 bg-[#c9a84c] mx-auto mt-4 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProperties.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
            <div className="text-center mt-10">
              <Link href="/search"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#c9a84c] text-[#1a3a5c] rounded-full font-black text-sm hover:bg-[#e8c97a] transition-all duration-300 shadow-lg shadow-[#c9a84c]/20">
                Ver Todas las Propiedades <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── WHY ME ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#1a3a5c] text-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-3">La Diferencia Catherine</p>
            <h2 className="font-serif text-4xl md:text-5xl font-black text-white">¿Por qué elegirme?</h2>
            <div className="w-16 h-1 bg-[#c9a84c] mx-auto mt-4 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: "Experta en el Mercado de Miami", desc: "20+ años especializándome en Miami-Dade. Conozco cada vecindario, tendencia de precios y oportunidad oculta en este mercado." },
              { icon: Award,      title: "Educadora Primero",             desc: "Te enseño a comprar inteligente — desde la pre-aprobación hasta el cierre, entenderás cada paso antes de firmar nada." },
              { icon: Shield,     title: "Servicio Bilingüe",            desc: "Fluente en inglés y español. Elimino barreras para que las familias latinas se sientan seguras e informadas." },
            ].map(item => (
              <div key={item.title}
                className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#c9a84c]/50 transition-all duration-500 group">
                <div className="w-14 h-14 rounded-2xl bg-[#c9a84c] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#c9a84c]/30">
                  <item.icon className="w-7 h-7 text-[#1a3a5c]" />
                </div>
                <h3 className="font-serif text-xl font-black text-white mb-3">{item.title}</h3>
                <p className="text-gray-300 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ──────────────────────────────────────────────────────────── */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Photo with decorative frame */}
            <div className="relative max-w-md mx-auto lg:mx-0">
              {/* Decorative gold frame offset */}
              <div className="absolute -top-4 -left-4 right-4 bottom-4 rounded-3xl border-2 border-[#c9a84c] opacity-50" />
              <div className="absolute -top-2 -left-2 right-2 bottom-2 rounded-3xl border border-[#c9a84c]/30 opacity-30" />
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#0a1f35] aspect-[3/4] shadow-2xl">
                {agentPhotoUrl
                  ? <img src={agentPhotoUrl} alt={agentName} className="w-full h-full object-cover object-top" />
                  : <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      <div className="w-40 h-40 rounded-full border-4 border-[#c9a84c] flex items-center justify-center text-5xl font-black text-[#c9a84c]">
                        {initials}
                      </div>
                      <p className="text-white font-bold text-xl">{agentName}</p>
                      <p className="text-[#c9a84c] text-sm">Realtor · Florida</p>
                    </div>
                }
              </div>
              {/* Corner accent */}
              <div className="absolute bottom-6 -right-6 bg-[#c9a84c] text-[#1a3a5c] px-5 py-3 rounded-2xl shadow-xl font-black text-sm">
                20+ Years<br/>
                <span className="font-normal text-xs">in Miami Real Estate</span>
              </div>
            </div>

            {/* Info */}
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-[#c9a84c] uppercase mb-2">{agentTitle}</p>
              <h2 className="font-serif text-4xl md:text-5xl font-black text-[#1a3a5c] mb-6">{agentName}</h2>
              <div className="w-12 h-1 bg-[#c9a84c] mb-8 rounded-full" />
              <div className="space-y-4 mb-8">
                {agentBio.split("\n\n").filter(Boolean).map((para: string, i: number) => (
                  <p key={i} className="text-gray-600 leading-relaxed">{para}</p>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  { icon: Phone, text: agentPhone, href: `tel:${agentPhone.replace(/\D/g,"")}` },
                  { icon: Mail,  text: agentEmail, href: `mailto:${agentEmail}` },
                  { icon: MapPin, text: "14335 SW 120th St, Miami FL", href: undefined },
                  { icon: ChevronRight, text: "catherinegomezrealtor.com", href: agentWebsite, ext: true },
                ].map(({ icon: Icon, text, href, ext }) => (
                  <div key={text} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <Icon className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
                    {href
                      ? <a href={href} target={ext ? "_blank" : undefined} rel="noopener noreferrer"
                          className="text-sm text-gray-700 hover:text-[#c9a84c] transition-colors truncate font-medium">{text}</a>
                      : <span className="text-sm text-gray-700 truncate font-medium">{text}</span>
                    }
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/book"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#1a3a5c] hover:bg-[#c9a84c] text-white font-black rounded-full text-sm transition-all duration-300 shadow-md">
                  Agendar Cita <ChevronRight className="w-4 h-4" />
                </a>
                <div className="flex gap-2">
                  {[
                    { icon: Facebook,  href: facebookUrl,  bg: "#1877F2" },
                    { icon: Instagram, href: instagramUrl, bg: "#E1306C" },
                    { icon: Linkedin,  href: linkedinUrl,  bg: "#0A66C2" },
                    { icon: Youtube,   href: youtubeUrl,   bg: "#FF0000" },
                  ].map(({ icon: Icon, href, bg }) => href && (
                    <a key={bg} href={href} target="_blank" rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 shadow-md"
                      style={{ backgroundColor: bg }}>
                      <Icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-3">Historias de Éxito</p>
            <h2 className="font-serif text-4xl md:text-5xl font-black text-[#1a3a5c]">Lo Que Dicen Mis Clientes</h2>
            <div className="w-16 h-1 bg-[#c9a84c] mx-auto mt-4 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t: any) => (
              <div key={t.id}
                className="relative bg-white rounded-3xl p-8 shadow-md hover:shadow-xl border border-gray-100 hover:border-[#c9a84c]/30 transition-all duration-500 group">
                {/* Decorative quote mark */}
                <div className="absolute -top-4 -left-2 text-[#c9a84c] text-8xl font-serif leading-none select-none opacity-20 group-hover:opacity-40 transition-opacity">"</div>
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_,i) => (
                    <Star key={i} className="w-4 h-4 fill-[#c9a84c] text-[#c9a84c]" />
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-6 relative z-10 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a3a5c] to-[#c9a84c] flex items-center justify-center text-sm font-black text-white shadow-md">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm">{t.name}</p>
                    <p className="text-[#c9a84c] text-xs font-semibold">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET SNAPSHOT ────────────────────────────────────────────────── */}
      <section id="market" className="py-20 bg-white">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-2">Miami Market</p>
              <h2 className="font-serif text-4xl font-black text-[#1a3a5c]">Market Snapshot</h2>
              {snapshot?.dateRange && <p className="text-sm text-gray-400 mt-1">{snapshot.dateRange}</p>}
            </div>
            <Link href="/search" className="hidden sm:flex items-center gap-1 text-sm text-[#c9a84c] font-bold hover:underline">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Active Listings",    value: snapshot?.activeListings ?? "—",     sub: snapshot?.newListings30d ? `+${snapshot.newListings30d} this month` : "Miami Market", icon: Home, color: "from-blue-500 to-blue-600" },
              { label: "Avg. List Price",    value: snapshot?.avgPrice ? `$${snapshot.avgPrice >= 1e6 ? (snapshot.avgPrice/1e6).toFixed(1)+"M" : Math.round(snapshot.avgPrice/1000)+"K"}` : "$843K", sub: "Active listings", icon: BarChart2, color: "from-[#c9a84c] to-amber-500" },
              { label: "Avg. Days on Market", value: snapshot?.avgDaysOnMarket ?? "79",  sub: "Active listings", icon: Calendar, color: "from-[#1a3a5c] to-blue-800" },
            ].map(stat => (
              <div key={stat.label}
                className="relative bg-white rounded-3xl p-8 border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${stat.color} opacity-5 -translate-y-1/2 translate-x-1/2 group-hover:opacity-10 transition-opacity`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-6 shadow-md`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-5xl font-black text-[#1a3a5c] mb-2">{stat.value}</p>
                <p className="font-bold text-gray-700 text-sm">{stat.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#1a3a5c] to-[#0a1f35] rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-white font-black mb-1">¿Quieres un análisis personalizado de tu vecindario?</p>
              <p className="text-gray-400 text-sm">Catherine te dará un CMA gratuito con los datos más recientes del mercado.</p>
            </div>
            <a href="#contact"
              className="flex-shrink-0 px-6 py-3 bg-[#c9a84c] text-[#1a3a5c] rounded-full text-sm font-black hover:bg-[#e8c97a] transition-colors whitespace-nowrap shadow-md">
              Obtener CMA Gratis →
            </a>
          </div>
        </div>
      </section>

      {/* ── BLOG ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-2">Educación Inmobiliaria</p>
              <h2 className="font-serif text-4xl font-black text-[#1a3a5c]">Del Blog de Catherine</h2>
              <div className="w-12 h-1 bg-[#c9a84c] mt-3 rounded-full" />
            </div>
            <Link href="/site/blog"
              className="hidden sm:flex items-center gap-1.5 text-sm font-black text-[#c9a84c] hover:underline">
              Ver todos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(blogPosts.length > 0 ? blogPosts.slice(0, 3) : [
              { title: "5 cosas que todo comprador en Miami debe saber", tag: "Educación", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=90", excerpt: "Antes de empezar tu búsqueda, hay cinco cosas que les enseño a todos mis clientes." },
              { title: "Snapshot del mercado de Miami — Junio 2026", tag: "Mercado", img: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=800&q=90", excerpt: "El mercado de Miami muestra señales de estabilización. Aquí están los números actuales." },
              { title: "Doral vs. Kendall: ¿Cuál es el mejor vecindario para tu familia?", tag: "Vecindarios", img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=90", excerpt: "Dos de los vecindarios más populares de Miami — pero muy diferentes." },
            ]).map((post: any, i: number) => (
              <Link key={i} href={post.slug ? `/site/blog/${post.slug}` : "/site/blog"}
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden hover:border-[#c9a84c]/30">
                <div className="aspect-video overflow-hidden">
                  <img src={post.img || post.coverImage} alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="p-6">
                  <span className="text-xs font-black text-[#c9a84c] bg-[#c9a84c]/10 px-3 py-1 rounded-full">{post.tag || post.tags?.[0]}</span>
                  <h3 className="font-serif text-lg font-black text-gray-900 mt-3 mb-2 group-hover:text-[#c9a84c] transition-colors leading-snug">
                    {post.title}
                  </h3>
                  {post.excerpt && <p className="text-gray-500 text-sm line-clamp-2">{post.excerpt}</p>}
                  <div className="flex items-center gap-1 mt-4 text-[#c9a84c] text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Leer más <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/site/blog"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-full font-black text-sm hover:bg-[#1a3a5c] hover:text-white transition-all duration-300">
              Ver todos los artículos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1920&q=90" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#0a1f35]/92" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c9a84c] mb-3">Contáctame</p>
            <h2 className="font-serif text-4xl md:text-5xl font-black text-white mb-4">Encontremos tu Hogar Ideal</h2>
            <p className="text-gray-400 text-lg">Lista para ayudarte en cada paso del proceso.</p>
          </div>

          {submitted ? (
            <div className="text-center py-16 rounded-3xl bg-white/10 border border-[#c9a84c]/30 backdrop-blur-sm">
              <div className="w-20 h-20 bg-[#c9a84c] rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-[#1a3a5c]" />
              </div>
              <p className="text-3xl font-serif font-black text-white mb-3">¡Mensaje Recibido!</p>
              <p className="text-gray-300">Catherine te contactará dentro de 24 horas.</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "firstName", label: "Nombre", required: true,  type: "text",  placeholder: "María" },
                  { key: "lastName",  label: "Apellido", required: true, type: "text",  placeholder: "García" },
                  { key: "email",     label: "Email",    required: true, type: "email", placeholder: "maria@email.com" },
                  { key: "phone",     label: "Teléfono", required: false, type: "tel",  placeholder: "+1 (305) 000-0000" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">{f.label}{f.required && " *"}</label>
                    <input required={f.required} type={f.type} placeholder={f.placeholder}
                      value={(contactForm as any)[f.key]}
                      onChange={e => setContactForm({ ...contactForm, [f.key]: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors text-sm"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Mensaje</label>
                  <textarea rows={4} placeholder="Cuéntame sobre tus objetivos inmobiliarios..." value={contactForm.message}
                    onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors resize-none text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <button type="submit" disabled={submitting}
                    className="w-full py-4 rounded-xl font-black text-[#1a3a5c] bg-[#c9a84c] hover:bg-[#e8c97a] transition-all duration-300 disabled:opacity-50 text-base shadow-lg shadow-[#c9a84c]/20">
                    {submitting ? "Enviando..." : "Enviar Mensaje →"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#080f1a] py-14 border-t border-white/5">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#1a3a5c] flex items-center justify-center">
                  <span className="text-[#c9a84c] text-xs font-black">CG</span>
                </div>
                <div>
                  <p className="font-black text-white text-lg leading-tight">{agentName}</p>
                  <p className="text-[#c9a84c] text-xs font-semibold tracking-widest">REALTOR · FLORIDA</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-5 max-w-xs">
                Más de 20 años ayudando a familias latinas a comprar inteligente en Miami y Florida.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: Facebook,  url: facebookUrl },
                  { icon: Instagram, url: instagramUrl },
                  { icon: Linkedin,  url: linkedinUrl },
                  { icon: Youtube,   url: youtubeUrl },
                ].filter(s => s.url).map(({ icon: Icon, url }, i) => (
                  <a key={i} href={url!} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-gray-500 hover:text-[#c9a84c] hover:border-[#c9a84c] transition-all duration-300">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-5">Navegación</h3>
              <ul className="space-y-2.5">
                {NAV_LINKS.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-gray-500 hover:text-[#c9a84c] transition-colors text-sm font-medium">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-5">Contacto</h3>
              <div className="space-y-3 text-sm text-gray-500">
                <a href={`tel:${agentPhone.replace(/\D/g,"")}`} className="flex items-center gap-2 hover:text-[#c9a84c] transition-colors">
                  <Phone className="w-4 h-4 text-[#c9a84c] flex-shrink-0"/>{agentPhone}
                </a>
                <a href={`mailto:${agentEmail}`} className="flex items-center gap-2 hover:text-[#c9a84c] transition-colors">
                  <Mail className="w-4 h-4 text-[#c9a84c] flex-shrink-0"/>info@catherinegomezrealtor.com
                </a>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#c9a84c] flex-shrink-0 mt-0.5"/>
                  <span className="leading-relaxed">14335 SW 120th St. Suite 101<br/>Miami, Florida 33186</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-gray-600 text-xs">
            <span>&copy; 2026 {agentName}. All rights reserved.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-[#c9a84c] transition-colors">Privacy Policy</Link>
              <Link href="/site" className="hover:text-[#c9a84c] transition-colors">Public Site</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
