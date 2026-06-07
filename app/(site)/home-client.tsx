"use client"

import { useState } from "react"
import Link from "next/link"
import { TrendingUp, Award, Shield, Phone, Mail, Star, Facebook, Instagram, Linkedin, ChevronRight, MapPin, Bed, Bath, Maximize2 } from "lucide-react"
import type { AIConfig, Property } from "@prisma/client"

interface HomeClientProps {
  config: AIConfig | null
  websiteConfig?: any
  featuredProperties: Property[]
  stats: {
    _count: number
    _avg: { price: number | null }
  }
}

function parseImages(images: string | null | undefined): string[] {
  if (!images) return []
  try {
    return JSON.parse(images)
  } catch {
    return []
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

function PropertyCard({ property }: { property: Property }) {
  const images = parseImages(property.images)
  const imageUrl = images[0] || null

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden rounded-t-2xl relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={property.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a2744 100%)" }}
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(201,168,76,0.2)" }}>
                <MapPin className="w-8 h-8" style={{ color: "#c9a84c" }} />
              </div>
              <span className="text-white text-sm opacity-70">No Image Available</span>
            </div>
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
          >
            {property.status === "ACTIVE" ? "For Sale" : property.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-2xl font-bold mb-1" style={{ color: "#c9a84c" }}>
          {formatPrice(property.price)}
        </p>
        <p className="text-gray-700 text-sm mb-3 font-medium">
          {property.address}, {property.city}, {property.state} {property.zip}
        </p>

        {/* Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {property.bedrooms != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {property.bedrooms} bd
            </span>
          )}
          {property.bathrooms != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {property.bathrooms} ba
            </span>
          )}
          {property.sqft != null && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Maximize2 className="w-3 h-3" />
              {property.sqft.toLocaleString()} sqft
            </span>
          )}
        </div>

        <Link
          href={`/site/listing/${property.id}`}
          className="w-full block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

const DEFAULT_TESTIMONIALS = [
  {
    id: 1,
    name: "Sarah & Michael T.",
    role: "Home Buyers",
    text: "Working with this team was an absolute dream. They found us our perfect home within 3 weeks and negotiated an incredible deal. We couldn't be happier!",
    stars: 5,
  },
  {
    id: 2,
    name: "Jennifer R.",
    role: "Home Seller",
    text: "Sold my property for 12% above asking price in just 5 days! The marketing strategy and professional photography made all the difference. Truly exceptional service.",
    stars: 5,
  },
  {
    id: 3,
    name: "David & Lisa K.",
    role: "Luxury Buyers",
    text: "The white-glove service exceeded every expectation. From private showings to the seamless closing process, every detail was handled with precision and care.",
    stars: 5,
  },
]

function parseJSON<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) } catch { return fallback }
}

export default function HomeClient({ config, websiteConfig, featuredProperties }: HomeClientProps) {
  const agentName = websiteConfig?.agentName || config?.realtorName || "Lofty Realty"
  const agentBio = websiteConfig?.agentBio || config?.agentPersona || "With years of experience in the luxury real estate market, I am dedicated to helping you find your perfect home or achieve the best value for your property. My commitment to excellence and personalized service sets me apart."
  const agentPhone = websiteConfig?.agentPhone || config?.realtorPhone || "(555) 123-4567"
  const agentEmail = websiteConfig?.agentEmail || config?.realtorEmail || "contact@loftyrealty.com"
  const agentPhotoUrl = websiteConfig?.agentPhotoUrl as string | undefined
  const heroTitle = websiteConfig?.heroTitle || "Your Luxury Real Estate Expert"
  const heroSubtitle = websiteConfig?.heroSubtitle || `${agentName} — delivering extraordinary results with unparalleled market expertise and white-glove service.`
  const primaryColor = websiteConfig?.primaryColor || "#c9a84c"
  const accentColor = websiteConfig?.accentColor || "#e8c97a"
  const darkBg = websiteConfig?.darkBg || "#0a0e1a"
  const darkBg2 = websiteConfig?.darkBg2 || "#1a2744"
  const facebookUrl = websiteConfig?.facebookUrl as string | undefined
  const instagramUrl = websiteConfig?.instagramUrl as string | undefined
  const linkedinUrl = websiteConfig?.linkedinUrl as string | undefined
  const videoUrl = websiteConfig?.videoUrl as string | undefined
  const serviceAreas = parseJSON<string[]>(websiteConfig?.serviceAreas, [])
  const testimonials = parseJSON(websiteConfig?.testimonials, DEFAULT_TESTIMONIALS)
  const customStats = parseJSON<{ value: string; label: string }[] | null>(websiteConfig?.stats, null)

  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
    interest: "BUYING",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const initials = agentName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setSubmitError("Something went wrong. Please try again.")
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="font-sans">
      {/* ──────────────────────────────────────────────
          1. HERO SECTION
      ────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${darkBg} 0%, ${darkBg2} 100%)` }}
      >
        {/* Hero background image */}
        {websiteConfig?.heroBgUrl && (
          <div className="absolute inset-0">
            <img src={websiteConfig.heroBgUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "rgba(10,14,26,0.7)" }} />
          </div>
        )}
        {/* Animated orbs */}
        <div
          className="absolute w-96 h-96 rounded-full opacity-10 animate-float"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
            top: "10%",
            right: "15%",
          }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 animate-float-delayed"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
            bottom: "20%",
            left: "10%",
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-5"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Dark overlay (only when no bg image) */}
        {!websiteConfig?.heroBgUrl && (
          <div className="absolute inset-0" style={{ background: "rgba(10,14,26,0.6)" }} />
        )}

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border text-sm font-medium" style={{ borderColor: `${primaryColor}4d`, color: primaryColor, background: `${primaryColor}1a` }}>
            <Star className="w-4 h-4" style={{ fill: primaryColor, color: primaryColor }} />
            Trusted Luxury Real Estate Expert
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            {heroTitle.includes("\n") ? (
              heroTitle.split("\n").map((line: string, i: number) => (
                <span key={i} className={i > 0 ? "block" : ""} style={i > 0 ? { color: primaryColor } : {}}>{line}</span>
              ))
            ) : (
              <>
                {heroTitle}
                <span className="block" style={{ color: primaryColor }}>&nbsp;</span>
              </>
            )}
          </h1>

          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/site/listings"
              className="px-8 py-4 rounded-full text-lg font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-105 shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {websiteConfig?.ctaPrimary || "View Listings"}
            </Link>
            <Link
              href="#contact"
              className="px-8 py-4 rounded-full text-lg font-semibold text-white border-2 border-white hover:bg-white transition-all duration-200"
              style={{ "--hover-color": darkBg } as React.CSSProperties}
            >
              {websiteConfig?.ctaSecondary || "Contact Me"}
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
            <span className="text-xs">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-1">
              <div className="w-1.5 h-3 bg-white/40 rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          2. STATS BAR
      ────────────────────────────────────────────── */}
      <section
        className="py-6"
        style={{ background: darkBg }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {(customStats || [
              { value: "500+", label: "Homes Sold" },
              { value: "$200M+", label: "In Sales" },
              { value: "15 Years", label: "Experience" },
              { value: "5★", label: "Rated" },
            ]).map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                  {stat.value}
                </span>
                <span className="text-gray-400 text-sm mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          3. FEATURED LISTINGS
      ────────────────────────────────────────────── */}
      <section id="listings" className="py-20 bg-[#fafaf8]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
              Exclusive Portfolio
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#1a1a2e] mb-4">
              Featured Properties
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Handpicked luxury homes curated especially for discerning buyers
            </p>
          </div>

          {featuredProperties.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-gray-100">
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">No listings available at this time.</p>
              <p className="text-gray-400 mt-2">Check back soon for new properties.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              href="/site/listings"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-white transition-all duration-200 hover:opacity-90 hover:gap-3"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              View All Properties
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          4. WHY CHOOSE ME
      ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
              Why Work With Me
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#1a1a2e] mb-4">
              The {agentName} Difference
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "Market Expertise",
                desc: "Deep knowledge of local market trends, pricing strategies, and neighborhood insights to give you a decisive competitive advantage.",
              },
              {
                icon: Award,
                title: "White-Glove Service",
                desc: "Personalized attention from first consultation to closing day. Every detail is handled with the utmost care and professionalism.",
              },
              {
                icon: Shield,
                title: "Results-Driven",
                desc: "Proven track record of achieving top dollar for sellers and securing the best deals for buyers — consistently exceeding expectations.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 group"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: "linear-gradient(135deg, #c9a84c20, #e8c97a30)" }}
                >
                  <item.icon className="w-7 h-7" style={{ color: "#c9a84c" }} />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#1a1a2e] mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          5. ABOUT
      ────────────────────────────────────────────── */}
      <section id="about" className="py-20 bg-[#fafaf8]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Photo */}
            <div className="relative">
              <div
                className="aspect-[4/5] rounded-3xl flex items-center justify-center text-white relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${darkBg} 0%, ${darkBg2} 100%)` }}
              >
                {agentPhotoUrl ? (
                  <img src={agentPhotoUrl} alt={agentName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center z-10">
                    <div
                      className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, color: darkBg }}
                    >
                      {initials}
                    </div>
                    <p className="text-white/60 text-sm">Professional Photo</p>
                  </div>
                )}
                {/* Decorative orb */}
                <div
                  className="absolute w-64 h-64 rounded-full opacity-10"
                  style={{
                    background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
                    bottom: "-20px",
                    right: "-20px",
                  }}
                />
              </div>
              {/* Accent border */}
              <div
                className="absolute -bottom-4 -right-4 w-full h-full rounded-3xl -z-10"
                style={{ border: `2px solid ${primaryColor}`, opacity: 0.3 }}
              />
            </div>

            {/* Right: Info */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: primaryColor }}>
                About Me
              </p>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#1a1a2e] mb-6">
                {agentName}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg mb-6">
                {agentBio}
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                    <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <span>{agentPhone}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                    <Mail className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <span>{agentEmail}</span>
                </div>
              </div>

              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white transition-all duration-200 hover:opacity-90 hover:gap-3"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
              >
                Schedule a Call
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          6. TESTIMONIALS
      ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
              Client Stories
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#1a1a2e] mb-4">
              What Clients Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t: { id: number; name: string; role: string; text: string; stars: number }) => (
              <div
                key={t.id}
                className="p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4" style={{ fill: primaryColor, color: primaryColor }} />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 italic">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a1a2e] text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          7. SERVICE AREAS (conditional)
      ────────────────────────────────────────────── */}
      {serviceAreas.length > 0 && (
        <section className="py-16 bg-[#fafaf8]">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
              Where I Work
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1a1a2e] mb-8">
              Service Areas
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {serviceAreas.map((area: string) => (
                <span
                  key={area}
                  className="px-5 py-2 rounded-full text-sm font-medium text-white"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────
          8. VIDEO (conditional)
      ────────────────────────────────────────────── */}
      {videoUrl && (
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
              Watch
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1a1a2e] mb-8">
              About {agentName}
            </h2>
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
              {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                <iframe
                  src={videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={videoUrl} controls className="w-full h-full object-cover" />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────
          9. CONTACT FORM
      ────────────────────────────────────────────── */}
      <section
        id="contact"
        className="py-20"
        style={{ background: `linear-gradient(135deg, ${darkBg} 0%, ${darkBg2} 100%)` }}
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: "#c9a84c" }}>
              Get In Touch
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">
              Let&apos;s Find Your Dream Home
            </h2>
            <p className="text-gray-400 text-lg">
              Ready to take the next step? I&apos;d love to hear from you.
            </p>
          </div>

          {submitted ? (
            <div className="text-center py-16 px-8 rounded-3xl" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}>
                <Star className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-serif text-3xl font-bold text-white mb-3">Message Received!</h3>
              <p className="text-gray-300 text-lg">Thank you for reaching out. I&apos;ll be in touch within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                <input
                  required
                  type="text"
                  value={contactForm.firstName}
                  onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                <input
                  required
                  type="text"
                  value={contactForm.lastName}
                  onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors"
                  placeholder="Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">I&apos;m Interested In</label>
                <select
                  value={contactForm.interest}
                  onChange={(e) => setContactForm({ ...contactForm, interest: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-[#c9a84c] transition-colors"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="BUYING">Buying a Home</option>
                  <option value="SELLING">Selling a Home</option>
                  <option value="BOTH">Buying & Selling</option>
                  <option value="JUST_BROWSING">Just Browsing</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition-colors resize-none"
                  placeholder="Tell me about your real estate goals..."
                />
              </div>

              {submitError && (
                <div className="md:col-span-2 text-red-400 text-sm text-center">{submitError}</div>
              )}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, color: darkBg }}
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ──────────────────────────────────────────────
          8. FOOTER
      ────────────────────────────────────────────── */}
      <footer style={{ background: darkBg }} className="pt-16 pb-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, color: darkBg }}
                >
                  {initials.charAt(0)}
                </div>
                <span className="font-serif text-xl font-bold text-white">{agentName}</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                {websiteConfig?.footerTagline || "Your trusted luxury real estate expert, dedicated to making your property dreams a reality."}
              </p>
              {/* Social Icons */}
              <div className="flex gap-4 mt-6">
                {[
                  { icon: Facebook, label: "Facebook", url: facebookUrl },
                  { icon: Instagram, label: "Instagram", url: instagramUrl },
                  { icon: Linkedin, label: "LinkedIn", url: linkedinUrl },
                ].filter(s => s.url || true).map((s) => (
                  <a
                    key={s.label}
                    href={s.url || "#"}
                    target={s.url ? "_blank" : undefined}
                    rel={s.url ? "noopener noreferrer" : undefined}
                    aria-label={s.label}
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-gray-400 transition-all duration-200"
                    style={{ ["--hover-color" as string]: primaryColor }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = primaryColor; (e.currentTarget as HTMLElement).style.borderColor = primaryColor }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ""; (e.currentTarget as HTMLElement).style.borderColor = "" }}
                  >
                    <s.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                {[
                  { href: "/site", label: "Home" },
                  { href: "/site/listings", label: "Listings" },
                  { href: "/site#about", label: "About" },
                  { href: "/site#contact", label: "Contact" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-[#c9a84c] transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-white font-semibold mb-4">Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
                  {agentPhone}
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
                  {agentEmail}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
            &copy; 2026 {agentName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
