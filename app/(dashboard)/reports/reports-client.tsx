"use client"

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, Users, DollarSign, CheckSquare, Target, AlertTriangle, Clock } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useState, useEffect } from "react"
import HelpPanel from "@/components/help-panel"

interface ReportsClientProps {
  contactsByMonth: { month: string; count: number }[]
  tasksByStatus: any[]
  transactionsByStatus: any[]
  topLeadSources: any[]
  revenueByMonth: { month: string; revenue: number }[]
  pipelineByStage: any[]
}

const CHART_COLORS = ["#0e8fe9", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#6B7280"]

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B",
  IN_PROGRESS: "#3B82F6",
  COMPLETED: "#10B981",
  CANCELLED: "#6B7280",
}

export default function ReportsClient({
  contactsByMonth, tasksByStatus, transactionsByStatus, topLeadSources, revenueByMonth, pipelineByStage,
}: ReportsClientProps) {
  const [velocity, setVelocity] = useState<any>(null)

  useEffect(() => {
    fetch("/api/reports/pipeline-velocity")
      .then(r => r.json())
      .then(d => setVelocity(d))
      .catch(() => {})
  }, [])

  const totalContacts = contactsByMonth.reduce((s, m) => s + m.count, 0)
  const totalRevenue = revenueByMonth.reduce((s, m) => s + m.revenue, 0)
  const completedTasks = tasksByStatus.find((t) => t.status === "COMPLETED")?._count || 0
  const closedTransactions = transactionsByStatus.find((t) => t.status === "CLOSED")?._count || 0

  const tasksPieData = tasksByStatus.map((t) => ({
    name: t.status,
    value: t._count,
    color: TASK_STATUS_COLORS[t.status] || "#6B7280",
  }))

  const sourceData = topLeadSources.map((s) => ({
    name: (s.source || "Unknown").replace(/_/g, " "),
    count: s._count,
  }))

  const pipelineData = pipelineByStage.map((stage) => ({
    name: stage.name,
    leads: stage.leads.length,
    value: stage.leads.reduce((s: number, l: any) => s + (l.value || 0), 0),
  }))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track your performance over the last 6 months</p>
        </div>
        <HelpPanel section="reports" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "New Contacts (6mo)", value: totalContacts, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Revenue (6mo)", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-green-600 bg-green-50" },
          { label: "Tasks Completed", value: completedTasks, icon: CheckSquare, color: "text-purple-600 bg-purple-50" },
          { label: "Deals Closed", value: closedTransactions, icon: Target, color: "text-orange-600 bg-orange-50" },
        ].map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color.split(" ")[1]}`}>
                  <card.icon className={`w-5 h-5 ${card.color.split(" ")[0]}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New Contacts */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">New Contacts by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contactsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0e8fe9" radius={[4, 4, 0, 0]} name="New Contacts" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Closed Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Velocity */}
      {velocity?.funnel && velocity.funnel.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-lofty-600" /> Pipeline Velocity — Días Promedio por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {velocity.funnel.map((stage: any) => (
                <div key={stage.stageId} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: stage.stageColor }} />
                  <p className="text-xs font-medium text-gray-700 truncate">{stage.stageName}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stage.totalLeads}</p>
                  <p className="text-[10px] text-gray-400">leads</p>
                  <p className="text-sm font-semibold text-lofty-600 mt-1">{stage.avgDaysInStage}d</p>
                  <p className="text-[10px] text-gray-400">promedio</p>
                  {stage.staleLeads > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />
                      <span className="text-[10px] text-orange-500">{stage.staleLeads} estancados</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Conversion funnel bar */}
            <div className="space-y-2">
              {velocity.funnel.map((stage: any, i: number) => (
                <div key={stage.stageId} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 truncate">{stage.stageName}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${stage.conversionRate}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">{stage.conversionRate}%</span>
                  <span className="text-xs text-gray-400 w-16 text-right">{formatCurrency(stage.totalValue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lead Sources */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Contacts" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Task Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={tasksPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {tasksPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {tasksPieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
