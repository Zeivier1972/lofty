"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2, LayoutDashboard, Users, GitBranch, Home,
  CheckSquare, Calendar, FileText,
  Zap, Settings, ChevronLeft, ChevronRight, BarChart3,
  MessageSquare, Bot, Phone, Share2, Key, Globe,
  BellRing, UserCheck, Send, Inbox, ClipboardList, Plug, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  external?: boolean
  section?: string
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { href: "/properties", icon: Home, label: "Properties" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/calendar", icon: CheckSquare, label: "Calendar" },
  { href: "/inbox", icon: Inbox, label: "Bandeja SMS/WA" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/campaigns", icon: Send, label: "Email Campaigns" },
  { href: "/cma", icon: ClipboardList, label: "CMA Reports" },
  { href: "/transactions", icon: FileText, label: "Transactions" },
  { href: "/smart-plans", icon: Zap, label: "Smart Plans", section: "Automation" },
  { href: "/property-alerts", icon: BellRing, label: "Property Alerts", section: "Automation" },
  { href: "/homeowner-agent", icon: UserCheck, label: "Homeowner Agent", section: "Automation" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/ai-agent", icon: Bot, label: "AI Agent" },
  { href: "/dialer", icon: Phone, label: "Power Dialer" },
  { href: "/social", icon: Share2, label: "Social Media" },
  { href: "/open-house", icon: Key, label: "Open House" },
  { href: "/website-builder", icon: Globe, label: "Website Builder" },
  { href: "/integrations", icon: Plug, label: "Integrations" },
  { href: "/portal", icon: Globe, label: "Client Portal", external: true },
  { href: "/site", icon: Home, label: "My Website", external: true },
  { href: "/settings", icon: Settings, label: "Settings" },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const rendered: Array<{ type: "header"; label: string } | { type: "item"; item: NavItem }> = []
  let lastSection: string | undefined = undefined
  for (const item of navItems) {
    if (item.section && item.section !== lastSection) {
      rendered.push({ type: "header", label: item.section })
      lastSection = item.section
    } else if (!item.section && lastSection) {
      lastSection = undefined
    }
    rendered.push({ type: "item", item })
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-lofty-950 text-white transition-all duration-300 flex-shrink-0",
        // Mobile: fixed overlay drawer
        "fixed inset-y-0 left-0 z-50 w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: normal flow, collapsible
        "md:relative md:translate-x-0 md:z-auto",
        collapsed ? "md:w-16" : "md:w-60"
      )}
    >
      {/* Logo row */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-lofty-800 flex-shrink-0",
        collapsed ? "md:justify-center" : "gap-3"
      )}>
        <div className="w-8 h-8 bg-lofty-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        {/* Always show text on mobile drawer */}
        <span className="font-bold text-lg md:hidden">Lofty CRM</span>
        {/* Desktop: hide when collapsed */}
        {!collapsed && <span className="font-bold text-lg hidden md:block">Lofty CRM</span>}
        {/* Close button — mobile only */}
        <button
          onClick={onMobileClose}
          className="ml-auto p-1.5 hover:bg-lofty-800 rounded-lg md:hidden"
          aria-label="Close menu"
        >
          <X className="w-4 h-4 text-lofty-300" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {rendered.map((entry, idx) => {
            if (entry.type === "header") {
              if (collapsed) return null
              return (
                <li key={`header-${idx}`} className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-lofty-500">
                    {entry.label}
                  </span>
                </li>
              )
            }
            const { href, icon: Icon, label, external } = entry.item
            const isActive = !external && (pathname === href || (href !== "/dashboard" && pathname.startsWith(href)))
            return (
              <li key={href}>
                <Link
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                    isActive ? "bg-lofty-600 text-white" : "text-lofty-300 hover:bg-lofty-800 hover:text-white",
                    collapsed && "md:justify-center md:px-2"
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={cn("text-sm font-medium", collapsed && "md:hidden")}>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Desktop collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-lofty-700 border border-lofty-600 rounded-full hidden md:flex items-center justify-center hover:bg-lofty-600 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-white" /> : <ChevronLeft className="w-3 h-3 text-white" />}
      </button>

      {!collapsed && (
        <div className="p-4 border-t border-lofty-800 hidden md:block">
          <div className="text-xs text-lofty-400">v1.0.0</div>
        </div>
      )}
    </aside>
  )
}
