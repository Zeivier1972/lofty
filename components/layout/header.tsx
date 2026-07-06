"use client"

import { useState, useEffect, useRef } from "react"
import { signOut } from "next-auth/react"
import {
  Bell, Search, LogOut, Settings, User, ChevronDown, CheckCheck,
  X, Menu, UserPlus, MessageCircle, Home, Eye, Clock, Calendar,
  TrendingUp, Flag, AtSign, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials, formatRelativeTime } from "@/lib/utils"
import Link from "next/link"

interface HeaderProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
  onMenuClick?: () => void
}

// Category config — maps notification type to Lofty-style label, icon, color
const CATEGORY: Record<string, { label: string; Icon: React.ElementType; bg: string; text: string }> = {
  NEW_LEAD:            { label: "Lead Alert",        Icon: UserPlus,       bg: "bg-blue-100",   text: "text-blue-600" },
  MESSAGE_RECEIVED:    { label: "Message",            Icon: MessageCircle,  bg: "bg-indigo-100", text: "text-indigo-600" },
  WHATSAPP_RECEIVED:   { label: "WhatsApp",           Icon: MessageCircle,  bg: "bg-green-100",  text: "text-green-600" },
  PORTAL_MESSAGE:      { label: "Portal Message",     Icon: AtSign,         bg: "bg-violet-100", text: "text-violet-600" },
  PROPERTY_SAVED:      { label: "Property Saved",     Icon: Home,           bg: "bg-emerald-100",text: "text-emerald-600" },
  PROPERTY_VIEWED_3X:  { label: "Property Activity",  Icon: Eye,            bg: "bg-purple-100", text: "text-purple-600" },
  SEARCH_BEHAVIOR:     { label: "Search Activity",    Icon: TrendingUp,     bg: "bg-sky-100",    text: "text-sky-600" },
  FOLLOW_UP:           { label: "Follow Up",          Icon: Clock,          bg: "bg-amber-100",  text: "text-amber-600" },
  APPOINTMENT_REQUEST: { label: "Appointment",        Icon: Calendar,       bg: "bg-teal-100",   text: "text-teal-600" },
  OPPORTUNITY:         { label: "Opportunity",        Icon: Flag,           bg: "bg-orange-100", text: "text-orange-600" },
  ACTION:              { label: "Action",             Icon: AlertCircle,    bg: "bg-gray-100",   text: "text-gray-600" },
}

function getCategory(type: string) {
  return CATEGORY[type] || { label: type.replace(/_/g, " "), Icon: Bell, bg: "bg-gray-100", text: "text-gray-500" }
}

function formatTime(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Group notifications by type for the badge counts like Lofty
function groupByType(notifications: any[]) {
  const groups: Record<string, number> = {}
  for (const n of notifications) {
    if (!n.isRead) groups[n.type] = (groups[n.type] || 0) + 1
  }
  return groups
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [panelOpen])

  async function fetchUnreadCount() {
    try {
      const res = await fetch("/api/ai/notifications?unread=true")
      const data = await res.json()
      setUnreadCount(Array.isArray(data) ? data.length : 0)
    } catch {}
  }

  async function openPanel() {
    setPanelOpen(true)
    setLoading(true)
    try {
      const res = await fetch("/api/ai/notifications")
      const data = await res.json()
      setNotifications(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  async function markAllRead() {
    await fetch("/api/ai/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    })
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  async function markOneRead(id: string) {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    fetch("/api/ai/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
  }

  const unreadGroups = groupByType(notifications)

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0 gap-2 relative z-30">

        {/* Left: hamburger + search */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {searchOpen ? (
            <div className="flex items-center gap-2 flex-1 md:hidden">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input autoFocus placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-gray-50 border-gray-200 h-9 text-sm" />
              </div>
              <button onClick={() => setSearchOpen(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <button onClick={() => setSearchOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Search">
                <Search className="w-5 h-5" />
              </button>
              <div className="relative w-72 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search contacts, properties..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-gray-50 border-gray-200 h-9 text-sm" />
              </div>
            </>
          )}
        </div>

        {/* Right: bell + user */}
        {!searchOpen && (
          <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
            {/* Bell */}
            <button
              onClick={() => panelOpen ? setPanelOpen(false) : openPanel()}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-1.5 md:px-2 py-1.5 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.image || ""} />
                    <AvatarFallback className="bg-lofty-600 text-white text-xs">{getInitials(user?.name || "U")}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-gray-900 leading-none">{user?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2"><User className="w-4 h-4" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-600 focus:text-red-600 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {/* ── Notification side panel (Lofty-style) ── */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          {/* Dim backdrop */}
          <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={() => setPanelOpen(false)} />

          {/* Panel */}
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col pointer-events-auto"
            style={{ borderLeft: "1px solid #e5e7eb" }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.some(n => !n.isRead) && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </button>
                )}
                <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category summary bar — like Lofty's grouped badges */}
            {Object.keys(unreadGroups).length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                {Object.entries(unreadGroups).map(([type, count]) => {
                  const cat = getCategory(type)
                  const Icon = cat.Icon
                  return (
                    <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
                      <Icon className="w-3 h-3" />
                      {cat.label}
                      <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">{count}</span>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <Bell className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-sm font-medium text-gray-400">No notifications yet</p>
                  <p className="text-xs text-gray-300 mt-1">New leads and activity will appear here</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cat = getCategory(n.type)
                  const Icon = cat.Icon
                  const contactName = n.contact ? `${n.contact.firstName} ${n.contact.lastName || ""}`.trim() : null
                  const href = n.contact?.id ? `/contacts/${n.contact.id}` : "/ai-agent"
                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => { if (!n.isRead) markOneRead(n.id); setPanelOpen(false) }}
                      className={`flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors group ${!n.isRead ? "bg-blue-50/40" : ""}`}
                    >
                      {/* Category icon with optional unread dot */}
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.bg}`}>
                          <Icon className={`w-4.5 h-4.5 ${cat.text}`} style={{ width: 18, height: 18 }} />
                        </div>
                        {!n.isRead && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-tight ${!n.isRead ? "text-gray-900" : "text-gray-700"}`}>
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{formatTime(n.createdAt)}</p>
                        </div>
                        {contactName && (
                          <p className="text-xs font-medium text-gray-600 mt-0.5 truncate">{contactName}</p>
                        )}
                        {n.body && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-3">
              <Link
                href="/ai-agent"
                onClick={() => setPanelOpen(false)}
                className="flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium py-1 hover:bg-blue-50 rounded-lg transition-colors"
              >
                View all activity
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
