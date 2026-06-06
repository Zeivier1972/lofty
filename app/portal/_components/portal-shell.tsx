"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2, LayoutDashboard, Home, FileText,
  MessageSquare, Map, LogOut, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface Contact {
  firstName: string
  lastName: string
  email: string | null
}

const NAV = [
  { href: "/portal/dashboard", icon: LayoutDashboard, label: "Dashboard", labelEs: "Inicio" },
  { href: "/portal/timeline", icon: Map, label: "Timeline", labelEs: "Progreso" },
  { href: "/portal/properties", icon: Home, label: "Properties", labelEs: "Propiedades" },
  { href: "/portal/documents", icon: FileText, label: "Documents", labelEs: "Documentos" },
  { href: "/portal/messages", icon: MessageSquare, label: "Messages", labelEs: "Mensajes" },
]

export default function PortalShell({
  contact,
  unreadMessages,
  children,
}: {
  contact: Contact
  unreadMessages: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" })
    router.push("/portal/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header */}
      <header className="bg-lofty-900 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/portal/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-lofty-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight">Lofty</div>
              <div className="text-xs text-lofty-400 leading-tight">Client Portal</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href
              const badge = href === "/portal/messages" && unreadMessages > 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-lofty-600 text-white" : "text-lofty-300 hover:text-white hover:bg-lofty-800"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold">{contact.firstName} {contact.lastName}</div>
              <div className="text-xs text-lofty-400">{contact.email}</div>
            </div>
            <div className="w-8 h-8 bg-lofty-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              {contact.firstName[0]}{contact.lastName[0]}
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1 px-3 py-1.5 text-xs text-lofty-400 hover:text-white border border-lofty-700 rounded-lg hover:border-lofty-500 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-lofty-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-lofty-800 px-4 py-3 space-y-1">
            {NAV.map(({ href, icon: Icon, label, labelEs }) => {
              const isActive = pathname === href
              const badge = href === "/portal/messages" && unreadMessages > 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    isActive ? "bg-lofty-600 text-white" : "text-lofty-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  <span className="text-lofty-500 text-xs">/ {labelEs}</span>
                  {badge && (
                    <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadMessages}
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-lofty-400 w-full"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="grid grid-cols-5 h-14">
          {NAV.map(({ href, icon: Icon, labelEs }) => {
            const isActive = pathname === href
            const badge = href === "/portal/messages" && unreadMessages > 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  isActive ? "text-lofty-600" : "text-gray-400"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{labelEs}</span>
                {badge && (
                  <span className="absolute top-1 right-4 w-3.5 h-3.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold text-[9px]">
                    {unreadMessages}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
