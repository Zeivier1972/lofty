"use client"

import { useState } from "react"
import {
  Mail, MessageSquare, Plus, Send, Eye, Edit, Trash2,
  BarChart2, Users, Clock, Star, Search, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn, formatDate, formatRelativeTime, getStatusColor } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface MessagesClientProps {
  templates: any[]
  recentEmails: any[]
  campaigns: any[]
}

const CATEGORY_COLORS: Record<string, string> = {
  BUYER: "bg-blue-100 text-blue-700",
  SELLER: "bg-green-100 text-green-700",
  GENERAL: "bg-gray-100 text-gray-700",
  TRANSACTION: "bg-purple-100 text-purple-700",
}

export default function MessagesClient({ templates, recentEmails, campaigns }: MessagesClientProps) {
  const { toast } = useToast()
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [searchTpl, setSearchTpl] = useState("")

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTpl.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTpl.toLowerCase())
  )

  const emailStats = {
    sent: recentEmails.filter((e) => e.status === "SENT").length,
    opened: recentEmails.filter((e) => e.status === "OPENED").length,
    openRate: recentEmails.length > 0
      ? Math.round((recentEmails.filter((e) => e.openedAt).length / recentEmails.filter((e) => e.status === "SENT").length) * 100) || 0
      : 0,
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 text-sm mt-0.5">Email & SMS communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Compose SMS
          </Button>
          <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2" onClick={() => setComposeOpen(true)}>
            <Mail className="w-4 h-4" /> Compose Email
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sent", value: recentEmails.filter((e) => e.status !== "DRAFT").length, icon: Send, color: "text-blue-600 bg-blue-50" },
          { label: "Open Rate", value: `${emailStats.openRate}%`, icon: Eye, color: "text-green-600 bg-green-50" },
          { label: "Templates", value: templates.length, icon: Star, color: "text-purple-600 bg-purple-50" },
          { label: "Campaigns", value: campaigns.length, icon: BarChart2, color: "text-orange-600 bg-orange-50" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.color.split(" ")[1])}>
                <stat.icon className={cn("w-4.5 h-4.5", stat.color.split(" ")[0])} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <Star className="w-4 h-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="w-4 h-4" /> Sent ({recentEmails.length})
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <BarChart2 className="w-4 h-4" /> Campaigns
          </TabsTrigger>
        </TabsList>

        {/* Templates tab */}
        <TabsContent value="templates" className="mt-4">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search templates..." value={searchTpl} onChange={(e) => setSearchTpl(e.target.value)} className="pl-9 h-9" />
            </div>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className={cn(
                  "border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow",
                  selectedTemplate?.id === template.id && "ring-2 ring-lofty-500"
                )}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{template.name}</p>
                        {template.category && (
                          <Badge className={cn("text-xs", CATEGORY_COLORS[template.category] || "bg-gray-100 text-gray-700")}>
                            {template.category}
                          </Badge>
                        )}
                        {template.isShared && (
                          <Badge variant="outline" className="text-xs">Shared</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{template.subject}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.body}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Eye className="w-3 h-3" /> Preview
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1 bg-lofty-600 hover:bg-lofty-700">
                      <Send className="w-3 h-3" /> Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Sent emails */}
        <TabsContent value="sent" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
              <div>Subject</div>
              <div>Recipient</div>
              <div>Status</div>
              <div>Date</div>
            </div>
            <div className="divide-y divide-gray-100">
              {recentEmails.map((email) => (
                <div key={email.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {email.contact ? `${email.contact.firstName} ${email.contact.lastName}` : email.toAddress}
                  </p>
                  <Badge className={cn("text-xs w-fit", getStatusColor(email.status))}>{email.status}</Badge>
                  <p className="text-xs text-gray-400">{formatRelativeTime(email.createdAt)}</p>
                </div>
              ))}
              {recentEmails.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No emails sent yet</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Campaigns */}
        <TabsContent value="campaigns" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-1.5">
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
              <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No campaigns yet</p>
              <p className="text-gray-400 text-sm mt-1">Create a campaign to reach multiple contacts at once</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span><Users className="w-3 h-3 inline mr-1" />{campaign.recipients} recipients</span>
                          <span><Eye className="w-3 h-3 inline mr-1" />{campaign.opened} opened</span>
                        </div>
                      </div>
                      <Badge className={cn("text-xs", getStatusColor(campaign.status))}>{campaign.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
