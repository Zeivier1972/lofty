"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

interface SiteNavProps {
  agentName: string
}

export default function SiteNav({ agentName }: SiteNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = [
    { href: "/site", label: "Home" },
    { href: "/site/listings", label: "Listings" },
    { href: "/site#about", label: "About" },
    { href: "/site#contact", label: "Contact" },
  ]

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo + Agent Name */}
        <Link href="/site" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}>
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span
            className={`font-serif text-xl font-semibold transition-colors duration-300 ${
              scrolled ? "text-[#1a1a2e]" : "text-white"
            }`}
          >
            {agentName}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors duration-300 hover:text-[#c9a84c] ${
                scrolled ? "text-[#1a1a2e]" : "text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/site#contact"
            className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-md"
            style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
          >
            Search Homes
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className={`w-6 h-6 ${scrolled ? "text-[#1a1a2e]" : "text-white"}`} />
          ) : (
            <Menu className={`w-6 h-6 ${scrolled ? "text-[#1a1a2e]" : "text-white"}`} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-6 py-4 flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-[#1a1a2e] font-medium hover:text-[#c9a84c] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/site#contact"
              onClick={() => setMobileOpen(false)}
              className="px-5 py-2 rounded-full text-sm font-semibold text-white text-center transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c97a)" }}
            >
              Search Homes
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
