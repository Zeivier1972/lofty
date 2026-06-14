"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2, LayoutDashboard, Users, GitBranch, Home,
  CheckSquare, Calendar, FileText,
  Zap, Settings, ChevronLeft, ChevronRight, BarChart3,
  MessageSquare, Bot, Phone, Share2, Key, Globe,
  BellRing, UserCheck, Send, Inbox, ClipboardList, Plug, X, Instagram, Landmark,
  Wand2, ChevronDown, Mail, TrendingUp, Megaphone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  external?: boolean
}

interface NavGroup {
  label: string
  icon: React.ElementType
  items: NavItem[]
}

// Items that always show at the top (no group)
const topItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
]

const navGroups: NavGroup[] = [
  {
    label: "Leads & Contacts",
    icon: Users,
    items: [
      { href: "/contacts", icon: Users, label: "Contacts" },
      { href: "/pipeline", icon: GitBranch, label: "Pipeline" },
      { href: "/tasks", icon: CheckSquare, label: "Tasks" },
      { href: "/calendar", icon: Calendar, label: "Calendar" },
    ],
  },
  {
    label: "Communications",
    icon: MessageSquare,
    items: [
      { href: "/inbox", icon: Inbox, label: "Bandeja SMS/WA" },
      { href: "/messages", icon: MessageSquare, label: "Messages" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { href: "/campaigns", icon: Send, label: "Email Campaigns" },
      { href: "/social", icon: Share2, label: "Social Media" },
      { href: "/content-studio", icon: Wand2, label: "Content Studio" },
    ],
  },
  {
    label: "AI & Automation",
    icon: Bot,
    items: [
      { href: "/ai-agent", icon: Bot, label: "AI Agent (Sofía & Aria)" },
      { href: "/dialer", icon: Phone, label: "Power Dialer" },
      { href: "/smart-plans", icon: Zap, label: "Smart Plans" },
      { href: "/property-alerts", icon: BellRing, label: "Property Alerts" },
      { href: "/homeowner-agent", icon: UserCheck, label: "Homeowner Agent" },
      { href: "/instagram-bot", icon: Instagram, label: "Instagram Bot" },
    ],
  },
  {
    label: "Real Estate",
    icon: Home,
    items: [
      { href: "/properties", icon: Home, label: "Properties" },
      { href: "/cma", icon: ClipboardList, label: "CMA Reports" },
      { href: "/transactions", icon: FileText, label: "Transactions" },
      { href: "/open-house", icon: Key, label: "Open House" },
      { href: "/partners", icon: Landmark, label: "Loan Officers" },
    ],
  },
  {
    label: "Website & Portal",
    icon: Globe,
    items: [
      { href: "/website-builder", icon: Globe, label: "Website Builder" },
      { href: "/site", icon: Home, label: "My Website", external: true },
      { href: "/portal", icon: Globe, label: "Client Portal", external: true },
    ],
  },
  {
    label: "Reports & Settings",
    icon: BarChart3,
    items: [
      { href: "/reports", icon: BarChart3, label: "Reports" },
      { href: "/integrations", icon: Plug, label: "Integrations" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Determine which group should be open by default based on current path
  const activeGroup = navGroups.find(g => g.items.some(i => !i.external && (pathname === i.href || pathname.startsWith(i.href))))
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup.label] : ["Leads & Contacts"])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const isItemActive = (item: NavItem) =>
    !item.external && (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))

  return (
    <aside
      className={cn(
        "flex flex-col bg-lofty-950 text-white transition-all duration-300 flex-shrink-0",
        "fixed inset-y-0 left-0 z-50 w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
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
        <span className="font-bold text-lg md:hidden">Lofty CRM</span>
        {!collapsed && <span className="font-bold text-lg hidden md:block">Lofty CRM</span>}
        <button onClick={onMobileClose} className="ml-auto p-1.5 hover:bg-lofty-800 rounded-lg md:hidden" aria-label="Close menu">
          <X className="w-4 h-4 text-lofty-300" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {/* Top-level items (Dashboard) */}
          {topItems.map(item => {
            const isActive = isItemActive(item)
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                    isActive ? "bg-lofty-600 text-white" : "text-lofty-300 hover:bg-lofty-800 hover:text-white",
                    collapsed && "md:justify-center md:px-2"
                  )}
                  title={collapsed ? item.label : undefined}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={cn("text-sm font-medium", collapsed && "md:hidden")}>{item.label}</span>
                </Link>
              </li>
            )
          })}

          {/* Grouped items */}
          {navGroups.map(group => {
            const isOpen = openGroups.includes(group.label)
            const hasActive = group.items.some(isItemActive)

            if (collapsed) {
              // Collapsed: show only icons, no groups
              return group.items.map(item => {
                const isActive = isItemActive(item)
                return (
                  <li key={item.href}>
                    <Link href={item.href} target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={onMobileClose}
                      className={cn(
                        "flex items-center justify-center px-2 py-2.5 rounded-lg transition-all",
                        isActive ? "bg-lofty-600 text-white" : "text-lofty-300 hover:bg-lofty-800 hover:text-white"
                      )}
                      title={item.label}>
                      <item.icon className="w-5 h-5" />
                    </Link>
                  </li>
                )
              })
            }

            return (
              <li key={group.label}>
                {/* Group header button */}
                <button onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 mt-1",
                    hasActive ? "text-white" : "text-lofty-400 hover:text-white hover:bg-lofty-800"
                  )}>
                  <group.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">{group.label}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
                </button>

                {/* Group items */}
                {isOpen && (
                  <ul className="ml-3 pl-3 border-l border-lofty-800 space-y-0.5 mb-1">
                    {group.items.map(item => {
                      const isActive = isItemActive(item)
                      return (
                        <li key={item.href}>
                          <Link href={item.href}
                            target={item.external ? "_blank" : undefined}
                            rel={item.external ? "noopener noreferrer" : undefined}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm",
                              isActive ? "bg-lofty-600 text-white font-medium" : "text-lofty-300 hover:bg-lofty-800 hover:text-white"
                            )}>
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.label}</span>
                            {item.external && <Globe className="w-3 h-3 ml-auto opacity-50" />}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Desktop collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-lofty-700 border border-lofty-600 rounded-full hidden md:flex items-center justify-center hover:bg-lofty-600 transition-colors z-10">
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
