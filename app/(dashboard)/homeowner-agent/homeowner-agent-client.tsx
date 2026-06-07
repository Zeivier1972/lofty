"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Users,
  TrendingUp,
  Mail,
  Phone,
  Home,
  Lock,
  Settings,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface HomeownerAgentClientProps {
  sellers: any[]
  config: any
}

function classifyIntent(seller: any): string {
  const score = seller.leadScore || 0
  const src = (seller.source || "").toLowerCase()
  if (src.includes("foreclosure") || src.includes("pre-foreclosure"))
    return "Foreclosure / Pre-foreclosure"
  if (src.includes("investor") || src.includes("absentee"))
    return "Absentee Owner / Investor"
  if (score >= 70) return "Likely Seller (High Interest)"
  const daysOld = Math.floor(
    (Date.now() - new Date(seller.createdAt).getTime()) / 86400000
  )
  if (daysOld <= 90) return "Newer / Long-term Nurture"
  return "Other / General Homeowner"
}

function classifyStage(seller: any): string {
  const daysOld = Math.floor(
    (Date.now() - new Date(seller.createdAt).getTime()) / 86400000
  )
  const lastContact = seller.lastContacted
    ? Math.floor(
        (Date.now() - new Date(seller.lastContacted).getTime()) / 86400000
      )
    : 999
  if (daysOld <= 30 || lastContact <= 7) return "Warming Up"
  if (lastContact <= 30) return "Hand-Off"
  return "Long-term Nurturing"
}

const INTENT_CATEGORIES = [
  "Likely Seller (High Interest)",
  "Newer / Long-term Nurture",
  "Absentee Owner / Investor",
  "Foreclosure / Pre-foreclosure",
  "Other / General Homeowner",
]

const INTENT_COLORS = [
  "#3B82F6",
  "#1E3A8A",
  "#6B7280",
  "#93C5FD",
  "#D1D5DB",
]

const STAGES = ["Warming Up", "Hand-Off", "Long-term Nurturing"]

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "homeowners", label: "Homeowners" },
  { id: "campaigns", label: "Campaigns" },
  { id: "settings", label: "Settings" },
]

export default function HomeownerAgentClient({
  sellers,
  config,
}: HomeownerAgentClientProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [monitoringEnabled, setMonitoringEnabled] = useState(true)
  const [autoAssignIntent, setAutoAssignIntent] = useState(true)
  const [reportFrequency, setReportFrequency] = useState("weekly")

  // Classify every seller upfront
  const classified = sellers.map((s) => ({
    ...s,
    intent: classifyIntent(s),
    stage: classifyStage(s),
  }))

  // Stage counts for banner stat cards
  const warmingUpCount = classified.filter((s) => s.stage === "Warming Up").length
  const handOffCount = classified.filter((s) => s.stage === "Hand-Off").length
  const longTermCount = classified.filter((s) => s.stage === "Long-term Nurturing").length

  // Build the matrix: intent × stage
  const matrix: Record<string, Record<string, number>> = {}
  for (const intent of INTENT_CATEGORIES) {
    matrix[intent] = { "Warming Up": 0, "Hand-Off": 0, "Long-term Nurturing": 0 }
  }
  for (const s of classified) {
    if (matrix[s.intent]) {
      matrix[s.intent][s.stage] = (matrix[s.intent][s.stage] || 0) + 1
    }
  }

  // Counts per intent for the donut chart
  const intentCounts = INTENT_CATEGORIES.map((intent) =>
    classified.filter((s) => s.intent === intent).length
  )
  const totalForChart = intentCounts.reduce((a, b) => a + b, 0) || 1

  // Build conic-gradient stops
  let cumulative = 0
  const conicStops = intentCounts
    .map((count, i) => {
      const pct = (count / totalForChart) * 100
      const start = cumulative
      cumulative += pct
      return `${INTENT_COLORS[i]} ${start.toFixed(1)}% ${cumulative.toFixed(1)}%`
    })
    .join(", ")

  const bannerStats = [
    { label: "Total Monitoring", value: sellers.length },
    { label: "Warming Up", value: warmingUpCount },
    { label: "Hand-Off", value: handOffCount },
    { label: "Long-term Nurturing", value: longTermCount },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Purple Gradient Banner */}
      <div
        className="px-6 pt-6 pb-5"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
      >
        {/* Title Row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Homeowner Agent</h1>
            <p className="text-purple-200 text-sm">
              Monitoring and nurturing your seller pipeline
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {bannerStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-purple-200 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 space-y-6">
        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Homeowner Analysis */}
            <Card className="border-0 shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Homeowner Analysis
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sellers segmented by intent and engagement stage
                </p>
              </div>
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Donut Chart */}
                  <div className="flex flex-col items-center gap-4 flex-shrink-0">
                    <div
                      className="w-40 h-40 rounded-full"
                      style={{
                        background:
                          totalForChart === 0
                            ? "#E5E7EB"
                            : `conic-gradient(${conicStops})`,
                        mask: "radial-gradient(circle, transparent 52px, black 52px)",
                        WebkitMask:
                          "radial-gradient(circle, transparent 52px, black 52px)",
                      }}
                    />
                    {/* Legend */}
                    <div className="space-y-1.5">
                      {INTENT_CATEGORIES.map((intent, i) => (
                        <div key={intent} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: INTENT_COLORS[i] }}
                          />
                          <span className="text-xs text-gray-600">{intent}</span>
                          <span className="text-xs font-semibold text-gray-800 ml-auto pl-3">
                            {intentCounts[i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Homeowner Intent
                          </th>
                          {STAGES.map((stage) => (
                            <th
                              key={stage}
                              className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                            >
                              {stage}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {INTENT_CATEGORIES.map((intent, i) => (
                          <tr key={intent} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: INTENT_COLORS[i] }}
                                />
                                <span className="text-gray-800 font-medium text-xs">
                                  {intent}
                                </span>
                              </div>
                            </td>
                            {STAGES.map((stage) => (
                              <td
                                key={stage}
                                className="text-center py-3 px-3 text-gray-700 font-semibold text-sm"
                              >
                                {matrix[intent][stage]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Engagement */}
            <Card className="border-0 shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Engagement</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Homeowner engagement activity metrics
                </p>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[
                          "All Engagement",
                          "Open Email",
                          "View Home Report",
                          "Back to Site",
                          "Request Home Value Reports",
                          "Request CMA Reports",
                          "Request Cash Offer",
                        ].map((col) => (
                          <th
                            key={col}
                            className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-gray-50">
                        {Array(7)
                          .fill(0)
                          .map((_, i) => (
                            <td
                              key={i}
                              className="text-center py-4 px-4 text-gray-700 font-semibold text-sm"
                            >
                              0
                            </td>
                          ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── HOMEOWNERS ── */}
        {activeTab === "homeowners" && (
          <Card className="border-0 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Homeowner Contacts
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sellers.length} seller{sellers.length !== 1 ? "s" : ""} in your pipeline
                </p>
              </div>
            </div>
            <CardContent className="p-0">
              {classified.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Home className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No homeowner contacts yet</p>
                  <p className="text-xs mt-1">
                    Contacts with a seller address or estimated value will appear here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[
                          "Name",
                          "Phone",
                          "Email",
                          "Intent",
                          "Stage",
                          "Est. Value",
                          "Actions",
                        ].map((col) => (
                          <th
                            key={col}
                            className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {classified.map((seller) => (
                        <tr
                          key={seller.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-900">
                              {seller.firstName} {seller.lastName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {seller.phone ? (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                {seller.phone}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {seller.email ? (
                              <span className="flex items-center gap-1 text-gray-600 max-w-[180px] truncate">
                                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                {seller.email}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className="text-xs whitespace-nowrap border-indigo-200 text-indigo-700 bg-indigo-50"
                            >
                              {seller.intent}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-xs whitespace-nowrap ${
                                seller.stage === "Warming Up"
                                  ? "border-green-200 text-green-700 bg-green-50"
                                  : seller.stage === "Hand-Off"
                                  ? "border-yellow-200 text-yellow-700 bg-yellow-50"
                                  : "border-gray-200 text-gray-600 bg-gray-50"
                              }`}
                            >
                              {seller.stage}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {seller.sellerEstimatedValue
                              ? `$${Number(seller.sellerEstimatedValue).toLocaleString()}`
                              : "—"}
                          </td>
                          <td className="py-3 px-4">
                            <Link href={`/contacts/${seller.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                              >
                                View Contact
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── CAMPAIGNS ── */}
        {activeTab === "campaigns" && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-20 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Coming Soon</h3>
                <p className="text-gray-500 text-sm mt-1 max-w-sm">
                  Automated campaigns for homeowners — drip sequences, home value
                  alerts, and market update emails — are on the way.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-indigo-200 text-indigo-600 bg-indigo-50"
              >
                In Development
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === "settings" && (
          <Card className="border-0 shadow-sm max-w-xl">
            <div className="p-5 border-b border-gray-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">
                Homeowner Agent Settings
              </h2>
            </div>
            <CardContent className="p-5 space-y-5">
              {/* Toggle: Enable monitoring */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label
                    htmlFor="monitoring-toggle"
                    className="text-sm font-medium text-gray-800"
                  >
                    Enable Homeowner Agent monitoring
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Track and nurture seller contacts automatically
                  </p>
                </div>
                <Switch
                  id="monitoring-toggle"
                  checked={monitoringEnabled}
                  onCheckedChange={setMonitoringEnabled}
                />
              </div>

              <div className="border-t border-gray-100" />

              {/* Toggle: Auto-assign intent */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label
                    htmlFor="intent-toggle"
                    className="text-sm font-medium text-gray-800"
                  >
                    Auto-assign intent
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically classify seller intent based on lead score and
                    source
                  </p>
                </div>
                <Switch
                  id="intent-toggle"
                  checked={autoAssignIntent}
                  onCheckedChange={setAutoAssignIntent}
                />
              </div>

              <div className="border-t border-gray-100" />

              {/* Home Value Report Frequency */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-800">
                  Home Value Report frequency
                </Label>
                <p className="text-xs text-gray-500">
                  How often to send automated home value reports to homeowners
                </p>
                <Select value={reportFrequency} onValueChange={setReportFrequency}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-gray-100 pt-2">
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    // settings save — extend with API call as needed
                  }}
                >
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
