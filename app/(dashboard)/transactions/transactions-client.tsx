"use client"

import { useState } from "react"
import Link from "next/link"
import {
  FileText, Plus, Building, Calendar, DollarSign, Check, Clock,
  ChevronRight, MoreVertical, TrendingUp, Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { format } from "date-fns"

interface TransactionsClientProps {
  transactions: any[]
  stats: any[]
}

const TYPE_COLORS: Record<string, string> = {
  BUYER: "bg-blue-100 text-blue-700",
  SELLER: "bg-green-100 text-green-700",
  DUAL: "bg-purple-100 text-purple-700",
  LEASE: "bg-yellow-100 text-yellow-700",
  REFERRAL: "bg-orange-100 text-orange-700",
}

function getMilestoneProgress(milestones: any[]): number {
  if (!milestones.length) return 0
  const completed = milestones.filter((m) => m.status === "COMPLETED").length
  return Math.round((completed / milestones.length) * 100)
}

export default function TransactionsClient({ transactions, stats }: TransactionsClientProps) {
  const [activeTab, setActiveTab] = useState<string>("ALL")

  const totalVolume = stats.reduce((sum, s) => sum + (s._sum.salePrice || 0), 0)
  const closedVolume = stats.find((s) => s.status === "CLOSED")?._sum?.salePrice || 0
  const activeCount = (stats.find((s) => s.status === "ACTIVE_LISTING")?._count || 0) +
    (stats.find((s) => s.status === "UNDER_CONTRACT")?._count || 0)

  const filtered = activeTab === "ALL" ? transactions : transactions.filter((t) => t.status === activeTab)

  const tabs = [
    { key: "ALL", label: "All" },
    { key: "ACTIVE_LISTING", label: "Active" },
    { key: "UNDER_CONTRACT", label: "Under Contract" },
    { key: "CLOSED", label: "Closed" },
    { key: "CANCELLED", label: "Cancelled" },
  ]

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{transactions.length} total transactions</p>
        </div>
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Plus className="w-4 h-4" /> New Transaction
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Transactions", value: activeCount, icon: Home, color: "text-blue-600 bg-blue-50" },
          { label: "Total Volume", value: formatCurrency(totalVolume), icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
          { label: "Closed Volume", value: formatCurrency(closedVolume), icon: DollarSign, color: "text-green-600 bg-green-50" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.color.split(" ")[1])}>
                <stat.icon className={cn("w-5 h-5", stat.color.split(" ")[0])} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-lofty-600 text-lofty-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">
              ({tab.key === "ALL" ? transactions.length : transactions.filter((t) => t.status === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-3">
        {filtered.map((tx) => {
          const progress = getMilestoneProgress(tx.milestones)
          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{tx.title}</h3>
                        <Badge className={cn("text-xs", TYPE_COLORS[tx.type])}>{tx.type}</Badge>
                        <Badge className={cn("text-xs", getStatusColor(tx.status))}>
                          {tx.status.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        {tx.address}, {tx.city}, {tx.state} {tx.zip}
                      </p>

                      {tx.contact && (
                        <p className="text-sm text-lofty-600 mt-0.5">
                          {tx.contact.firstName} {tx.contact.lastName}
                        </p>
                      )}

                      {/* Milestones progress */}
                      {tx.milestones.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{tx.milestones.filter((m: any) => m.status === "COMPLETED").length}/{tx.milestones.length} milestones</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(tx.salePrice || tx.listPrice)}
                      </p>
                      {tx.commission && (
                        <p className="text-sm text-green-600 font-medium">
                          {formatCurrency(tx.commission)} commission
                        </p>
                      )}
                      {tx.closeDate && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          Close {formatDate(tx.closeDate)}
                        </p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">{tx._count.documents} docs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No transactions found</p>
            <Button className="mt-4 bg-lofty-600 hover:bg-lofty-700">
              <Plus className="w-4 h-4 mr-2" /> New Transaction
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
