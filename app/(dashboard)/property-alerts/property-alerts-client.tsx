"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Bell, Settings, Users, Home, Mail, CheckCircle,
  ChevronDown, Play, Plus, Search, Filter, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface Buyer {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  buyerBudgetMin?: number
  buyerBudgetMax?: number
  buyerBedroomsMin?: number
  buyerPropertyType?: string
  buyerLocation?: string
  createdAt: string
  lastContacted?: string
}

interface Property {
  id: string
  address: string
  city: string
  state: string
  price: number
  bedrooms?: number
  propertyType?: string
  createdAt: string
}

interface AlertConfig {
  enabled: boolean
  propertyStatus: string
  daysListed: string
  locationCriteria: string
  openHouseOnly: string
  frequency: string
  schedule: { sun: boolean; mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean }
  amSlot: boolean
  pmSlot: boolean
  startTiming: string
  excludeSource: string
  excludePipeline: string
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  propertyStatus: "Active",
  daysListed: "Any",
  locationCriteria: "Same as Inquired Zip Code",
  openHouseOnly: "NO",
  frequency: "Daily",
  schedule: { sun: true, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true },
  amSlot: true,
  pmSlot: false,
  startTiming: "immediately",
  excludeSource: "None",
  excludePipeline: "None",
}

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p)
}

function matchesAlertCriteria(property: Property, buyer: Buyer): boolean {
  if (buyer.buyerBudgetMax && property.price > buyer.buyerBudgetMax) return false
  if (buyer.buyerBudgetMin && property.price < buyer.buyerBudgetMin) return false
  if (buyer.buyerBedroomsMin && (property.bedrooms || 0) < buyer.buyerBedroomsMin) return false
  if (buyer.buyerPropertyType && property.propertyType &&
    !property.propertyType.toLowerCase().includes(buyer.buyerPropertyType.toLowerCase())) return false
  if (buyer.buyerLocation) {
    const loc = buyer.buyerLocation.toLowerCase()
    const addr = `${property.address} ${property.city} ${property.state}`.toLowerCase()
    if (!addr.includes(loc) && !loc.includes(property.city?.toLowerCase() || "")) return false
  }
  return true
}

export default function PropertyAlertsClient({ buyers, properties, config: _config }: {
  buyers: Buyer[]
  properties: Property[]
  config: any
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"alert" | "snapshot" | "report">("alert")
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQ, setSearchQ] = useState("")

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
  type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
  const dayKeys: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

  // Buyers with matching properties
  const buyersWithMatches = useMemo(() => buyers.map(b => ({
    ...b,
    matchCount: properties.filter(p => matchesAlertCriteria(p, b)).length,
  })), [buyers, properties])

  const enrolledCount = buyersWithMatches.filter(b => b.matchCount > 0 || b.buyerLocation).length
  const totalMatches = buyersWithMatches.reduce((s, b) => s + b.matchCount, 0)

  const filteredBuyers = searchQ
    ? buyersWithMatches.filter(b =>
      `${b.firstName} ${b.lastName} ${b.email} ${b.buyerLocation}`.toLowerCase().includes(searchQ.toLowerCase()))
    : buyersWithMatches

  async function saveConfig() {
    setSaving(true)
    try {
      await fetch("/api/settings/property-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertConfig),
      })
      toast({ title: "Property alert settings saved" })
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function sendAlerts() {
    setSending(true)
    try {
      const res = await fetch("/api/property-alerts/send", { method: "POST" })
      const data = await res.json()
      toast({ title: `Alerts queued for ${data.count || 0} buyers` })
    } catch {
      toast({ title: "Error sending alerts", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automated Property Alerts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Auto-send matching listings to buyer leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sendAlerts} disabled={sending} className="gap-2">
            <Play className="w-4 h-4" />
            {sending ? "Sending..." : "Send Now"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Enrolled Buyers", value: enrolledCount, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Properties Available", value: properties.length, color: "text-green-600", bg: "bg-green-50" },
          { label: "Matches Found", value: totalMatches, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Alerts Active", value: alertConfig.enabled ? "ON" : "OFF", color: alertConfig.enabled ? "text-green-600" : "text-gray-400", bg: alertConfig.enabled ? "bg-green-50" : "bg-gray-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className={cn("p-4 rounded-xl", s.bg)}>
              <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
              <p className="text-sm text-gray-600 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { id: "alert", label: "Property Alert" },
            { id: "snapshot", label: "Market Snapshot" },
            { id: "report", label: "Market Report" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "alert" && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left: Settings form */}
          <div className="col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Alert Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Enable */}
                <div className="flex items-center justify-between py-1">
                  <Label className="text-sm font-medium">Enable</Label>
                  <Switch
                    checked={alertConfig.enabled}
                    onCheckedChange={v => setAlertConfig(c => ({ ...c, enabled: v }))}
                  />
                </div>

                {/* Exclude Source */}
                <div>
                  <Label className="text-sm mb-1.5 block">Exclude Source</Label>
                  <select value={alertConfig.excludeSource}
                    onChange={e => setAlertConfig(c => ({ ...c, excludeSource: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="None">None</option>
                    <option value="Zillow">Zillow</option>
                    <option value="Realtor.com">Realtor.com</option>
                    <option value="Manual">Manual Entry</option>
                  </select>
                </div>

                {/* Property Status */}
                <div>
                  <Label className="text-sm mb-1.5 block">Property Status</Label>
                  <select value={alertConfig.propertyStatus}
                    onChange={e => setAlertConfig(c => ({ ...c, propertyStatus: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Active</option>
                    <option>Active + Coming Soon</option>
                    <option>All</option>
                  </select>
                </div>

                {/* Days Listed */}
                <div>
                  <Label className="text-sm mb-1.5 block">Days Listed</Label>
                  <select value={alertConfig.daysListed}
                    onChange={e => setAlertConfig(c => ({ ...c, daysListed: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Any</option>
                    <option>New Today</option>
                    <option>Last 3 Days</option>
                    <option>Last 7 Days</option>
                  </select>
                </div>

                {/* Location Criteria */}
                <div>
                  <Label className="text-sm mb-1.5 block">Location Criteria</Label>
                  <select value={alertConfig.locationCriteria}
                    onChange={e => setAlertConfig(c => ({ ...c, locationCriteria: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Same as Inquired Zip Code</option>
                    <option>Same City</option>
                    <option>Buyer Search Criteria</option>
                    <option>Any</option>
                  </select>
                </div>

                {/* Open House Only */}
                <div>
                  <Label className="text-sm mb-1.5 block">Open House Only</Label>
                  <select value={alertConfig.openHouseOnly}
                    onChange={e => setAlertConfig(c => ({ ...c, openHouseOnly: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="NO">NO</option>
                    <option value="YES">YES</option>
                  </select>
                </div>

                {/* Frequency */}
                <div>
                  <Label className="text-sm mb-1.5 block">Frequency</Label>
                  <select value={alertConfig.frequency}
                    onChange={e => setAlertConfig(c => ({ ...c, frequency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Daily</option>
                    <option>Twice Daily</option>
                    <option>Weekly</option>
                    <option>Instant</option>
                  </select>
                </div>

                {/* Schedule */}
                <div>
                  <Label className="text-sm mb-2 block">Schedule</Label>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <td className="w-8" />
                          {DAYS.map(d => <th key={d} className="text-center text-gray-500 font-medium pb-1 px-1">{d}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-gray-500 pr-2 text-xs">AM</td>
                          {dayKeys.map(d => (
                            <td key={d} className="text-center px-1">
                              <input type="checkbox"
                                checked={alertConfig.schedule[d]}
                                onChange={e => setAlertConfig(c => ({ ...c, schedule: { ...c.schedule, [d]: e.target.checked } }))}
                                className="accent-blue-600" />
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="text-gray-500 pr-2 text-xs">PM</td>
                          {dayKeys.map(d => (
                            <td key={d} className="text-center px-1">
                              <input type="checkbox"
                                checked={alertConfig.pmSlot}
                                onChange={e => setAlertConfig(c => ({ ...c, pmSlot: e.target.checked }))}
                                className="accent-blue-600" />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                    <span>Set</span>
                    <select value={alertConfig.startTiming}
                      onChange={e => setAlertConfig(c => ({ ...c, startTiming: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="immediately">immediately</option>
                      <option value="1_day">1 day</option>
                      <option value="3_days">3 days</option>
                      <option value="7_days">7 days</option>
                    </select>
                    <span>after lead registration</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="teamApply" className="accent-blue-600" />
                  <label htmlFor="teamApply" className="text-sm text-gray-600">Apply for team</label>
                </div>

                <Button onClick={saveConfig} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Enrolled buyers */}
          <div className="col-span-3">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Enrolled Buyers</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      placeholder="Search buyers..."
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredBuyers.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No buyers with search criteria</p>
                    <p className="text-gray-400 text-sm mt-1">Buyers with saved search criteria will appear here</p>
                    <Link href="/contacts">
                      <Button className="mt-4 bg-blue-600 hover:bg-blue-700" size="sm">
                        <Plus className="w-4 h-4 mr-1.5" /> Add Buyer Contacts
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Budget</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Criteria</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Matches</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredBuyers.map(buyer => (
                          <tr key={buyer.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{buyer.firstName} {buyer.lastName}</p>
                                <p className="text-xs text-gray-400">{buyer.email || buyer.phone || "—"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {buyer.buyerBudgetMax
                                ? `Up to ${formatPrice(buyer.buyerBudgetMax)}`
                                : buyer.buyerBudgetMin
                                  ? `From ${formatPrice(buyer.buyerBudgetMin)}`
                                  : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {buyer.buyerLocation && (
                                  <Badge variant="outline" className="text-xs">{buyer.buyerLocation}</Badge>
                                )}
                                {buyer.buyerBedroomsMin && (
                                  <Badge variant="outline" className="text-xs">{buyer.buyerBedroomsMin}+ bd</Badge>
                                )}
                                {buyer.buyerPropertyType && (
                                  <Badge variant="outline" className="text-xs">{buyer.buyerPropertyType}</Badge>
                                )}
                                {!buyer.buyerLocation && !buyer.buyerBedroomsMin && !buyer.buyerPropertyType && (
                                  <span className="text-gray-400 text-xs">Budget only</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {buyer.matchCount > 0 ? (
                                <Badge className="bg-green-100 text-green-700 border-0">
                                  {buyer.matchCount} match{buyer.matchCount !== 1 ? "es" : ""}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-400">0 matches</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/contacts/${buyer.id}`}>
                                <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs h-7">
                                  View →
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
          </div>
        </div>
      )}

      {activeTab === "snapshot" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Market Snapshot</p>
            <p className="text-gray-400 text-sm mt-1">Auto-send neighborhood market snapshots to homeowner leads.</p>
            <p className="text-gray-400 text-sm">Connect your IDX feed in Settings → IDX / MLS to enable.</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "report" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Market Report</p>
            <p className="text-gray-400 text-sm mt-1">Send detailed market reports to seller leads on a schedule.</p>
            <p className="text-gray-400 text-sm">Configure your MLS connection to start generating reports.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
