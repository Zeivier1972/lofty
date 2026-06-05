"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Bot, Send, Bell, BellOff, Settings, MessageSquare, Mail, Phone,
  TrendingUp, Users, Zap, CheckCircle, AlertCircle, Clock,
  RefreshCw, Eye, Home, ChevronRight, Star, Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, formatRelativeTime, getInitials } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "border-l-4 border-l-red-500 bg-red-50",
  MEDIUM: "border-l-4 border-l-yellow-500 bg-yellow-50",
  LOW: "border-l-4 border-l-blue-500 bg-blue-50",
}

const TYPE_ICONS: Record<string, any> = {
  PROPERTY_SAVED: Home,
  PROPERTY_VIEWED_3X: Eye,
  SEARCH_BEHAVIOR: Activity,
  NEW_LEAD: Users,
  FOLLOW_UP: Clock,
  ACTION: Zap,
}

interface AIAgentClientProps {
  notifications: any[]
  conversations: any[]
  config: any
  stats: { totalNotifications: number; unreadCount: number; smsSent: number; emailsSent: number }
}

export default function AIAgentClient({ notifications: initNotifs, conversations, config: initConfig, stats }: AIAgentClientProps) {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState(initNotifs)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: `Hi! I'm ${initConfig.agentName}, your AI real estate assistant. I'm actively monitoring your leads and taking action when they engage. What would you like to know?` },
  ])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [config, setConfig] = useState(initConfig)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: "user", content: chatInput }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput("")
    setChatLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatMessages, userMsg].map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })) }),
      })
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting. Please check your ANTHROPIC_API_KEY." }])
    } finally {
      setChatLoading(false)
    }
  }

  const markAllRead = async () => {
    await fetch("/api/ai/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    toast({ title: "All notifications marked as read" })
  }

  const triggerAI = async (contactId: string, trigger: string) => {
    const res = await fetch("/api/ai/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger, contactId }),
    })
    toast({ title: "AI agent triggered", description: "The agent is processing the contact now" })
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-lofty-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agent — {config.agentName}</h1>
            <p className="text-gray-500 text-sm">Working for {config.realtorName} · Monitoring all leads 24/7</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Active
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Unread Alerts", value: unreadCount, icon: Bell, color: unreadCount > 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-50" },
          { label: "SMS Sent", value: stats.smsSent, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
          { label: "Emails Sent", value: stats.emailsSent, icon: Mail, color: "text-purple-600 bg-purple-50" },
          { label: "Total Actions", value: stats.totalNotifications, icon: Zap, color: "text-orange-600 bg-orange-50" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.color.split(" ")[1])}>
                <s.icon className={cn("w-5 h-5", s.color.split(" ")[0])} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Notifications + Chat */}
        <div className="lg:col-span-3 space-y-4">
          <Tabs defaultValue="feed">
            <TabsList>
              <TabsTrigger value="feed" className="gap-2">
                <Bell className="w-4 h-4" />
                Activity Feed
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">{unreadCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <Bot className="w-4 h-4" />
                Chat with AI
              </TabsTrigger>
              <TabsTrigger value="conversations" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Lead Convos ({conversations.length})
              </TabsTrigger>
            </TabsList>

            {/* Activity Feed */}
            <TabsContent value="feed" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Catherine's AI Feed</CardTitle>
                  {unreadCount > 0 && (
                    <Button size="sm" variant="outline" onClick={markAllRead} className="h-7 gap-1 text-xs">
                      <CheckCircle className="w-3 h-3" />Mark all read
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">
                        <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">AI agent hasn't taken any actions yet</p>
                        <p className="text-xs mt-1">Actions appear here as leads engage with properties</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const Icon = TYPE_ICONS[notif.type] || Zap
                        return (
                          <div
                            key={notif.id}
                            className={cn(
                              "p-4 hover:bg-gray-50 transition-colors",
                              !notif.isRead && "bg-blue-50/40",
                              PRIORITY_STYLES[notif.priority]?.replace("bg-", "border-l-4 border-l-").split(" ").filter(Boolean).join(" ")
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", {
                                "bg-red-100": notif.priority === "HIGH",
                                "bg-yellow-100": notif.priority === "MEDIUM",
                                "bg-blue-100": notif.priority === "LOW",
                              })}>
                                <Icon className={cn("w-4 h-4", {
                                  "text-red-600": notif.priority === "HIGH",
                                  "text-yellow-600": notif.priority === "MEDIUM",
                                  "text-blue-600": notif.priority === "LOW",
                                })} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={cn("text-sm font-semibold text-gray-900", !notif.isRead && "text-lofty-700")}>{notif.title}</p>
                                  {!notif.isRead && <div className="w-2 h-2 bg-lofty-500 rounded-full flex-shrink-0 mt-1" />}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{notif.body}</p>
                                {notif.contact && (
                                  <Link href={`/contacts/${notif.contact.id}`} className="text-xs text-lofty-600 hover:underline mt-0.5 inline-block">
                                    {notif.contact.firstName} {notif.contact.lastName}
                                  </Link>
                                )}
                                <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chat */}
            <TabsContent value="chat" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {/* Messages */}
                  <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 bg-gradient-to-br from-lofty-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={cn("rounded-2xl px-4 py-2.5 max-w-xs text-sm leading-relaxed", msg.role === "user"
                          ? "bg-lofty-600 text-white"
                          : "bg-gray-100 text-gray-800"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-lofty-500 to-purple-600 rounded-full flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-gray-100 rounded-2xl px-4 py-3 flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-gray-100 p-3 flex gap-2">
                    <Input
                      placeholder="Ask the AI agent anything..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      className="flex-1"
                    />
                    <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="icon" className="bg-lofty-600 hover:bg-lofty-700">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Conversations */}
            <TabsContent value="conversations" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0 divide-y divide-gray-100">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No conversations yet</p>
                  ) : (
                    conversations.map((conv) => (
                      <div key={conv.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="bg-lofty-100 text-lofty-700 text-sm">
                            {getInitials(`${conv.contact.firstName} ${conv.contact.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link href={`/contacts/${conv.contact.id}`} className="font-medium text-gray-900 text-sm hover:text-lofty-600">
                            {conv.contact.firstName} {conv.contact.lastName}
                          </Link>
                          <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                          <p className="text-xs text-gray-400">{formatRelativeTime(conv.updatedAt)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{conv.channel}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Config + Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Config */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />AI Automation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "autoRespondSMS", label: "Auto-send SMS", desc: "Reply to behavioral triggers via text" },
                { key: "autoRespondEmail", label: "Auto-send Email", desc: "Send follow-ups via email" },
                { key: "autoFollowUp", label: "Auto follow-up tasks", desc: "Create tasks for Catherine" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={config[item.key]}
                    onCheckedChange={(v) => setConfig((c: any) => ({ ...c, [item.key]: v }))}
                  />
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <Label className="text-xs text-gray-500">Agent Name</Label>
                <Input value={config.agentName} onChange={(e) => setConfig((c: any) => ({ ...c, agentName: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Realtor Name</Label>
                <Input value={config.realtorName} onChange={(e) => setConfig((c: any) => ({ ...c, realtorName: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <Button className="w-full bg-lofty-600 hover:bg-lofty-700 h-8 text-sm" onClick={() => {
                fetch("/api/ai/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) })
                toast({ title: "AI config saved" })
              }}>
                Save Config
              </Button>
            </CardContent>
          </Card>

          {/* Trigger map */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />Automation Triggers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { icon: "🏠", trigger: "Property Saved", action: "Instant SMS + Email + Task" },
                { icon: "👁️", trigger: "Viewed 3× same property", action: "Personal SMS + Priority Task" },
                { icon: "🔍", trigger: "5 searches in a week", action: "SMS with match alert" },
                { icon: "👤", trigger: "New lead registered", action: "Welcome SMS + Email" },
                { icon: "📅", trigger: "No contact in 14 days", action: "Check-in SMS + Task" },
              ].map((item) => (
                <div key={item.trigger} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{item.trigger}</p>
                    <p className="text-gray-500">{item.action}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
