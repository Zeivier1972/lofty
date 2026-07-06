"use client"

import { useState } from "react"
import { Users, TrendingUp, FileText, CheckSquare, Sparkles, Flame, Mail, UserPlus, MessageCircle, ArrowRight, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate, formatRelativeTime, getInitials, cn, getPriorityColor, getStatusColor } from "@/lib/utils"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import Link from "next/link"
import { format } from "date-fns"
import HelpPanel from "@/components/help-panel"
import HotActivity from "./hot-activity"
import PropertyCards from "./property-cards"

interface DashboardClientProps {
  stats: {
    totalContacts: number
    newLeadsThisMonth: number
    activeTransactions: number
    pipelineValue: number
    closedVolume: number
    tasksDueToday: number
    pendingTasks: number
    upcomingAppointments: number
  }
  tasks: any[]
  appointments: any[]
  recentActivities: any[]
  pipelineData: any[]
  contactsByStatus: any[]
  hotAlerts: any[]
  matchAlertsSentToday: number
  newLeadsToday: number
  portalUnread: number
}

function SofiaBriefing({ hotAlerts: initialHotAlerts, matchAlertsSentToday, newLeadsToday, portalUnread, tasksDueToday, upcomingAppointments }: {
  hotAlerts: any[]
  matchAlertsSentToday: number
  newLeadsToday: number
  portalUnread: number
  tasksDueToday: number
  upcomingAppointments: number
}) {
  const [localHotAlerts, setLocalHotAlerts] = useState(initialHotAlerts)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

  async function dismissHotAlerts() {
    const ids = localHotAlerts.map((a: any) => a.id)
    setLocalHotAlerts([])
    await fetch("/api/ai/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }

  const items = [
    localHotAlerts.length > 0 && {
      icon: Flame,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      label: `${localHotAlerts.length} hot alert${localHotAlerts.length > 1 ? "s" : ""} — client${localHotAlerts.length > 1 ? "s" : ""} showing strong interest`,
      sub: localHotAlerts.slice(0, 2).map((a: any) => a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : "").filter(Boolean).join(", "),
      href: "/property-alerts",
      urgent: true,
      onDismiss: dismissHotAlerts,
    },
    portalUnread > 0 && {
      icon: MessageCircle,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      label: `${portalUnread} unread portal message${portalUnread > 1 ? "s" : ""} from client${portalUnread > 1 ? "s" : ""}`,
      sub: "Reply before noon",
      href: "/inbox?channel=portal",
      urgent: true,
    },
    tasksDueToday > 0 && {
      icon: CheckSquare,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      label: `${tasksDueToday} task${tasksDueToday > 1 ? "s" : ""} due today`,
      sub: "Follow-ups, calls, and commitments",
      href: "/tasks",
      urgent: false,
    },
    upcomingAppointments > 0 && {
      icon: FileText,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      label: `${upcomingAppointments} upcoming appointment${upcomingAppointments > 1 ? "s" : ""}`,
      sub: "Check your calendar",
      href: "/calendar",
      urgent: false,
    },
    newLeadsToday > 0 && {
      icon: UserPlus,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      label: `${newLeadsToday} new lead${newLeadsToday > 1 ? "s" : ""} today`,
      sub: "Add to pipeline and enroll in Smart Plan",
      href: "/contacts?tab=all",
      urgent: false,
    },
    {
      icon: Mail,
      iconBg: matchAlertsSentToday > 0 ? "bg-emerald-100" : "bg-gray-100",
      iconColor: matchAlertsSentToday > 0 ? "text-emerald-600" : "text-gray-400",
      label: matchAlertsSentToday > 0
        ? `${matchAlertsSentToday} match alert email${matchAlertsSentToday > 1 ? "s" : ""} sent this morning`
        : "Match alert emails — scheduled for 8:00 AM",
      sub: matchAlertsSentToday > 0 ? "Clients are seeing their matches now" : "Cron job will run automatically",
      href: "/property-alerts",
      urgent: false,
      done: matchAlertsSentToday > 0,
    },
  ].filter(Boolean) as any[]

  const allClear = hotAlerts.length === 0 && portalUnread === 0 && tasksDueToday === 0

  return (
    <div className="rounded-2xl overflow-hidden shadow-md border border-white/10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a1628] via-[#1a2f50] to-[#0e2240] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <p className="text-yellow-300 text-xs font-semibold tracking-widest uppercase">Sofia · AI Assistant</p>
            <h2 className="text-white font-bold text-lg leading-tight">{greeting}, Catherine 👋</h2>
          </div>
        </div>
        <p className="text-blue-300 text-sm hidden sm:block">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      {/* Body */}
      <div className="bg-white divide-y divide-gray-100">
        {allClear ? (
          <div className="px-6 py-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-gray-800">All clear! No urgent actions.</p>
            <p className="text-sm text-gray-400 mt-1">Sofia is handling the follow-ups automatically.</p>
          </div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-center hover:bg-gray-50 transition-colors group">
              <Link href={item.href} className="flex items-center gap-4 px-6 py-4 flex-1 min-w-0">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", item.iconBg)}>
                  <item.icon className={cn("w-4 h-4", item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold", item.urgent ? "text-gray-900" : "text-gray-700")}>
                    {item.label}
                    {item.urgent && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />}
                  </p>
                  {item.sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.sub}</p>}
                </div>
                {item.done ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex-shrink-0">✓ Done</span>
                ) : !item.onDismiss ? (
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                ) : null}
              </Link>
              {item.onDismiss && (
                <button
                  onClick={() => item.onDismiss!()}
                  className="mr-5 p-1 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                  title="Mark as seen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Leads",
  PROSPECT: "Prospects",
  ACTIVE_CLIENT: "Active Clients",
  PAST_CLIENT: "Past Clients",
  SPHERE_OF_INFLUENCE: "Sphere",
}

const STATUS_COLORS: Record<string, string> = {
  LEAD: "#6B7280",
  PROSPECT: "#3B82F6",
  ACTIVE_CLIENT: "#10B981",
  PAST_CLIENT: "#8B5CF6",
  SPHERE_OF_INFLUENCE: "#F59E0B",
}

const ACTIVITY_ICONS: Record<string, string> = {
  CONTACT_CREATED: "👤",
  EMAIL_SENT: "📧",
  CALL_MADE: "📞",
  TASK_COMPLETED: "✅",
  NOTE_ADDED: "📝",
  PROPERTY_VIEWED: "🏠",
  PIPELINE_MOVED: "📊",
  APPOINTMENT_SCHEDULED: "📅",
  TRANSACTION_UPDATED: "📋",
}

export default function DashboardClient({
  stats, tasks, appointments, recentActivities, pipelineData, contactsByStatus,
  hotAlerts, matchAlertsSentToday, newLeadsToday, portalUnread,
}: DashboardClientProps) {
  const statCards = [
    {
      title: "Total Contacts",
      value: stats.totalContacts.toLocaleString(),
      sub: `+${stats.newLeadsThisMonth} this month`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Pipeline Value",
      value: formatCurrency(stats.pipelineValue),
      sub: "Active opportunities",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Active Transactions",
      value: stats.activeTransactions.toString(),
      sub: formatCurrency(stats.closedVolume) + " closed",
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Tasks Due Today",
      value: stats.tasksDueToday.toString(),
      sub: `${stats.pendingTasks} total pending`,
      icon: CheckSquare,
      color: stats.tasksDueToday > 0 ? "text-red-600" : "text-gray-600",
      bg: stats.tasksDueToday > 0 ? "bg-red-50" : "bg-gray-50",
    },
  ]

  const pieData = contactsByStatus.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s._count,
    color: STATUS_COLORS[s.status] || "#6B7280",
  }))

  const pipelineBarData = pipelineData.map((stage) => ({
    name: stage.name.replace(" ", "\n"),
    count: stage.leads.length,
    value: stage.leads.reduce((s: number, l: any) => s + (l.value || 0), 0),
  }))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2 items-center">
          <HelpPanel section="dashboard" />
          <Button asChild variant="outline" size="sm">
            <Link href="/contacts/new">Add Contact</Link>
          </Button>
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700">
            <Link href="/tasks/new">Add Task</Link>
          </Button>
        </div>
      </div>

      {/* Sofia Daily Briefing */}
      <SofiaBriefing
        hotAlerts={hotAlerts}
        matchAlertsSentToday={matchAlertsSentToday}
        newLeadsToday={newLeadsToday}
        portalUnread={portalUnread}
        tasksDueToday={stats.tasksDueToday}
        upcomingAppointments={stats.upcomingAppointments}
      />

      {/* Hot buyers + popular properties (IDX activity) */}
      <HotActivity />

      {/* Property cards with interested buyers */}
      <PropertyCards />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                </div>
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                  <card.icon className={cn("w-5 h-5", card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline overview */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Pipeline Overview</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-lofty-600 h-8">
              <Link href="/pipeline">View Pipeline</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineBarData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? formatCurrency(value) : value,
                    name === "value" ? "Value" : "Leads",
                  ]}
                />
                <Bar dataKey="count" fill="#0e8fe9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contact distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Contact Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Contacts"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Upcoming Tasks</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-lofty-600 h-8">
              <Link href="/tasks">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", {
                  "bg-red-500": task.priority === "URGENT",
                  "bg-orange-500": task.priority === "HIGH",
                  "bg-blue-500": task.priority === "MEDIUM",
                  "bg-gray-400": task.priority === "LOW",
                })} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  {task.contact && (
                    <p className="text-xs text-gray-500">{task.contact.firstName} {task.contact.lastName}</p>
                  )}
                  {task.dueDate && (
                    <p className={cn("text-xs mt-0.5", new Date(task.dueDate) < new Date() ? "text-red-500" : "text-gray-400")}>
                      {formatDate(task.dueDate)}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-xs flex-shrink-0", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No pending tasks</p>
            )}
          </CardContent>
        </Card>

        {/* Appointments */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Upcoming Appointments</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-lofty-600 h-8">
              <Link href="/calendar">View Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.map((apt) => (
              <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-lofty-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-lofty-600 font-bold leading-none">
                    {format(new Date(apt.startTime), "d")}
                  </span>
                  <span className="text-xs text-lofty-500 leading-none">
                    {format(new Date(apt.startTime), "MMM")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{apt.title}</p>
                  {apt.contact && (
                    <p className="text-xs text-gray-500">{apt.contact.firstName} {apt.contact.lastName}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(apt.startTime), "h:mm a")}
                  </p>
                </div>
                <Badge className={cn("text-xs flex-shrink-0", getStatusColor(apt.status))}>
                  {apt.status}
                </Badge>
              </div>
            ))}
            {appointments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-base">
                  {ACTIVITY_ICONS[activity.type] || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 leading-snug">{activity.title}</p>
                  {activity.contact && (
                    <p className="text-xs text-lofty-600">
                      {activity.contact.firstName} {activity.contact.lastName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
