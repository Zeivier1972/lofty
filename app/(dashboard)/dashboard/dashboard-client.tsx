"use client"

import { Users, TrendingUp, FileText, CheckSquare, Calendar, DollarSign, Home, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate, formatRelativeTime, getInitials, cn, getPriorityColor, getStatusColor } from "@/lib/utils"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import Link from "next/link"
import { format } from "date-fns"

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
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/contacts/new">Add Contact</Link>
          </Button>
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700">
            <Link href="/tasks/new">Add Task</Link>
          </Button>
        </div>
      </div>

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
