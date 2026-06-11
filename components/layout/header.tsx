"use client"

import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Bell, Search, LogOut, Settings, User, ChevronDown, CheckCheck, ExternalLink } from "lucide-react"
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
}

const TYPE_ICONS: Record<string, string> = {
  NEW_LEAD: "👤",
  MESSAGE_RECEIVED: "💬",
  WHATSAPP_RECEIVED: "💬",
  PORTAL_MESSAGE: "📩",
  PROPERTY_SAVED: "🏠",
  PROPERTY_VIEWED_3X: "👀",
  SEARCH_BEHAVIOR: "🔍",
  FOLLOW_UP: "⏰",
  APPOINTMENT_REQUEST: "📅",
}

export default function Header({ user }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchUnreadCount() {
    try {
      const res = await fetch("/api/ai/notifications?unread=true")
      const data = await res.json()
      setUnreadCount(Array.isArray(data) ? data.length : 0)
    } catch {}
  }

  async function openNotifications() {
    setNotifOpen(true)
    setLoadingNotifs(true)
    try {
      const res = await fetch("/api/ai/notifications")
      const data = await res.json()
      setNotifications(Array.isArray(data) ? data : [])
      // Mark all as read
      if (unreadCount > 0) {
        await fetch("/api/ai/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) })
        setUnreadCount(0)
      }
    } catch {}
    setLoadingNotifs(false)
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search contacts, properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-gray-50 border-gray-200 h-9 text-sm"
        />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={(open) => { if (open) openNotifications(); else setNotifOpen(false) }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 max-h-[480px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
              {notifications.some(n => !n.isRead) && (
                <button onClick={async () => {
                  await fetch("/api/ai/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) })
                  setNotifications(ns => ns.map(n => ({ ...n, isRead: true })))
                  setUnreadCount(0)
                }} className="flex items-center gap-1 text-xs text-lofty-600 hover:text-lofty-700">
                  <CheckCheck className="w-3.5 h-3.5" /> Todo leído
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingNotifs ? (
                <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Sin notificaciones</div>
              ) : (
                notifications.slice(0, 20).map(n => (
                  <Link
                    key={n.id}
                    href={n.contact?.id ? `/contacts/${n.contact.id}` : "/ai-agent"}
                    onClick={() => setNotifOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                  </Link>
                ))
              )}
            </div>
            <div className="border-t px-4 py-2">
              <Link href="/ai-agent" onClick={() => setNotifOpen(false)} className="flex items-center justify-center gap-1 text-xs text-lofty-600 hover:text-lofty-700 py-1">
                Ver todas <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback className="bg-lofty-600 text-white text-xs">
                  {getInitials(user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-none">{user?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-600 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
