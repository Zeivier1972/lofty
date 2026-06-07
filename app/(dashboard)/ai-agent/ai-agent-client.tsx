"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Bot, Send, Bell, Settings, MessageSquare, Mail, Phone,
  Users, Zap, CheckCircle, Clock, Eye, Home,
  Star, Activity, GraduationCap, Calendar, ChevronRight,
  BookOpen, Target, TrendingUp, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, formatRelativeTime, getInitials } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "border-l-4 border-l-red-500",
  MEDIUM: "border-l-4 border-l-yellow-500",
  LOW: "border-l-4 border-l-blue-500",
}

const TYPE_ICONS: Record<string, any> = {
  PROPERTY_SAVED: Home,
  PROPERTY_VIEWED_3X: Eye,
  SEARCH_BEHAVIOR: Activity,
  NEW_LEAD: Users,
  FOLLOW_UP: Clock,
  PRE_QUALIFY: Target,
  APPOINTMENT_REQUEST: Calendar,
  open_house_visit: Home,
  ACTION: Zap,
}

const TRIGGER_DESCRIPTIONS = [
  { icon: "👤", trigger: "Nuevo lead registrado", action: "SMS bienvenida + Email + Pre-calificación" },
  { icon: "🏠", trigger: "Propiedad guardada", action: "SMS inmediato + Email + Tarea para Catherine" },
  { icon: "👁️", trigger: "Vista 3× misma propiedad", action: "SMS personal + Tarea de alta prioridad" },
  { icon: "🔍", trigger: "5+ búsquedas en una semana", action: "SMS con alerta de coincidencias" },
  { icon: "📅", trigger: "Sin contacto en 14 días", action: "SMS de check-in + Tarea de seguimiento" },
  { icon: "🎯", trigger: "Pre-calificación", action: "Serie de preguntas + Perfil de comprador" },
  { icon: "📞", trigger: "Solicitud de cita", action: "SMS de confirmación + Email con detalles" },
]

interface AIAgentClientProps {
  notifications: any[]
  conversations: any[]
  config: any
  stats: { totalNotifications: number; unreadCount: number; smsSent: number; emailsSent: number }
  ftboPlan: any
  preQualStats: { totalContacts: number; aiTouched: number; pendingCalls: number }
}

export default function AIAgentClient({
  notifications: initNotifs,
  conversations,
  config: initConfig,
  stats,
  ftboPlan: initFtboPlan,
  preQualStats,
}: AIAgentClientProps) {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState(initNotifs)
  const [ftboPlan, setFtboPlan] = useState(initFtboPlan)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    {
      role: "assistant",
      content: `¡Hola! Soy ${initConfig.agentName}, la asistente virtual de ${initConfig.realtorName}. 🏠\n\nEstoy monitoreando todos tus leads 24/7 y actuando cuando muestran interés. ¿En qué puedo ayudarte hoy?\n\nHi! I'm ${initConfig.agentName}, ${initConfig.realtorName}'s AI assistant. I'm monitoring all your leads 24/7. How can I help you today?`,
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [config, setConfig] = useState(initConfig)
  const [seedingPlan, setSeedingPlan] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: "user", content: chatInput }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput("")
    setChatLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply || "Lo siento, no pude procesar esa solicitud." }])
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hay un problema de conexión. Por favor verifica tu ANTHROPIC_API_KEY." }])
    } finally {
      setChatLoading(false)
    }
  }

  const markAllRead = async () => {
    await fetch("/api/ai/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    toast({ title: "Todas las notificaciones marcadas como leídas" })
  }

  const saveConfig = async () => {
    const res = await fetch("/api/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    if (res.ok) {
      toast({ title: "✅ Configuración guardada" })
    } else {
      toast({ title: "Error al guardar", variant: "destructive" })
    }
  }

  const seedFTBOPlan = async () => {
    setSeedingPlan(true)
    try {
      const res = await fetch("/api/ai/seed-plans", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFtboPlan(data.plan)
      toast({ title: "✅ Plan de Compradores de Primera Vez creado", description: "10 pasos educativos en español listos para usar" })
    } catch (e: any) {
      toast({ title: e.message || "Error al crear el plan", variant: "destructive" })
    } finally {
      setSeedingPlan(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const aiCoveragePercent = preQualStats.totalContacts > 0
    ? Math.round((preQualStats.aiTouched / preQualStats.totalContacts) * 100)
    : 0

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header — Sofia branding */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/30">
              <Bot className="w-9 h-9 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-bold">{config.agentName} — AI CRM</h1>
                <span className="flex items-center gap-1 bg-green-400/30 text-green-100 border border-green-300/40 px-2 py-0.5 rounded-full text-xs font-semibold">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  Activa
                </span>
              </div>
              <p className="text-indigo-100 text-sm">Asistente de {config.realtorName} · Habla español · Monitoreando 24/7</p>
              <p className="text-indigo-200 text-xs mt-0.5">Pre-califica leads · Agenda citas · Educa compradores de primera vez</p>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-1 text-sm text-indigo-100">
            <span>🌎 Español primero</span>
            <span>📞 Citas con Catherine</span>
            <span>🎓 Educación FTBO</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Alertas sin leer", value: unreadCount, icon: Bell, color: unreadCount > 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-50", sub: "notificaciones" },
          { label: "SMS Enviados", value: stats.smsSent, icon: MessageSquare, color: "text-blue-600 bg-blue-50", sub: "mensajes de texto" },
          { label: "Emails Enviados", value: stats.emailsSent, icon: Mail, color: "text-purple-600 bg-purple-50", sub: "correos electrónicos" },
          { label: "Cobertura IA", value: `${aiCoveragePercent}%`, icon: Target, color: "text-green-600 bg-green-50", sub: `${preQualStats.aiTouched} de ${preQualStats.totalContacts} contactos` },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.color.split(" ")[1])}>
                <s.icon className={cn("w-5 h-5", s.color.split(" ")[0])} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FTBO Smart Plan Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-gray-900 text-sm">Plan: Compradores de Primera Vez</h3>
                  {ftboPlan && (
                    <Badge className="bg-green-100 text-green-700 border-0 text-xs">Activo</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 max-w-md">
                  Guía educativa de 30 días en español: crédito, pago inicial, pre-aprobación, búsqueda y cierre.
                  {ftboPlan && ` · ${ftboPlan.steps?.length || 0} pasos · ${ftboPlan.enrollments?.length || 0} inscritos activos`}
                </p>
                {ftboPlan && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {["Crédito", "Pago inicial", "Pre-aprobación", "Búsqueda", "Cierre"].map(step => (
                      <span key={step} className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">{step}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {ftboPlan ? (
                <Button asChild size="sm" variant="outline" className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Link href="/smart-plans">Ver Plan</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={seedFTBOPlan}
                  disabled={seedingPlan}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {seedingPlan ? "Creando..." : "Crear Plan FTBO"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Activity + Chat + Conversations */}
        <div className="lg:col-span-3 space-y-4">
          <Tabs defaultValue="feed">
            <TabsList className="w-full">
              <TabsTrigger value="feed" className="flex-1 gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" />
                Feed de Actividad
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex-1 gap-1.5 text-xs">
                <Bot className="w-3.5 h-3.5" />
                Chat con Sofia
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex-1 gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5" />
                Conversaciones ({conversations.length})
              </TabsTrigger>
            </TabsList>

            {/* Activity Feed */}
            <TabsContent value="feed" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Feed de Sofia para {config.realtorName}</CardTitle>
                  {unreadCount > 0 && (
                    <Button size="sm" variant="outline" onClick={markAllRead} className="h-7 gap-1 text-xs">
                      <CheckCircle className="w-3 h-3" />Todo leído
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">
                        <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Sofia no ha actuado aún</p>
                        <p className="text-xs mt-1">Las acciones aparecen aquí cuando los leads interactúan</p>
                      </div>
                    ) : (
                      notifications.map(notif => {
                        const Icon = TYPE_ICONS[notif.type] || Zap
                        return (
                          <div
                            key={notif.id}
                            className={cn(
                              "p-4 hover:bg-gray-50 transition-colors",
                              !notif.isRead && "bg-indigo-50/40",
                              PRIORITY_STYLES[notif.priority]
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
                                  <p className={cn("text-sm font-semibold text-gray-900", !notif.isRead && "text-indigo-700")}>{notif.title}</p>
                                  {!notif.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1" />}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{notif.body}</p>
                                {notif.contact && (
                                  <Link href={`/contacts/${notif.contact.id}`} className="text-xs text-indigo-600 hover:underline mt-0.5 inline-block font-medium">
                                    {notif.contact.firstName} {notif.contact.lastName} →
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

            {/* Chat with Sofia */}
            <TabsContent value="chat" className="mt-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="h-[420px] overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2.5 max-w-sm text-sm leading-relaxed whitespace-pre-wrap",
                          msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-800 shadow-sm border border-gray-100"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-4 py-3 flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t border-gray-100 p-3 flex gap-2">
                    <Input
                      placeholder="Pregúntale a Sofia sobre tus leads..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendChat()}
                      className="flex-1"
                    />
                    <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
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
                    <p className="text-sm text-gray-400 text-center py-8">Sin conversaciones aún</p>
                  ) : (
                    conversations.map(conv => (
                      <div key={conv.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm">
                            {getInitials(`${conv.contact.firstName} ${conv.contact.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link href={`/contacts/${conv.contact.id}`} className="font-medium text-gray-900 text-sm hover:text-indigo-600">
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

        {/* Right: Config + Triggers */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Config */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />Configuración de Sofia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "autoRespondSMS", label: "Auto-enviar SMS", desc: "Sofia responde por texto automáticamente" },
                { key: "autoRespondEmail", label: "Auto-enviar Email", desc: "Envía seguimientos por correo" },
                { key: "autoFollowUp", label: "Crear tareas automáticas", desc: "Tareas de seguimiento para Catherine" },
                { key: "preQualEnabled", label: "Pre-calificación automática", desc: "Sofia pre-califica leads nuevos" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={config[item.key] ?? true}
                    onCheckedChange={v => setConfig((c: any) => ({ ...c, [item.key]: v }))}
                  />
                </div>
              ))}

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div>
                  <Label className="text-xs text-gray-500">Nombre del Agente</Label>
                  <Input value={config.agentName} onChange={e => setConfig((c: any) => ({ ...c, agentName: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Nombre de Catherine (Realtor)</Label>
                  <Input value={config.realtorName} onChange={e => setConfig((c: any) => ({ ...c, realtorName: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Teléfono de Catherine</Label>
                  <Input value={config.realtorPhone || ""} onChange={e => setConfig((c: any) => ({ ...c, realtorPhone: e.target.value }))} placeholder="+1 305-555-0100" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Enlace Calendly (para agendar citas)</Label>
                  <Input
                    value={config.calendlyUrl || ""}
                    onChange={e => setConfig((c: any) => ({ ...c, calendlyUrl: e.target.value }))}
                    placeholder="https://calendly.com/catherine"
                    className="mt-1 h-8 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Sofia incluye este enlace en cada mensaje para agendar citas</p>
                </div>
              </div>

              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-8 text-sm" onClick={saveConfig}>
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>

          {/* Triggers */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />Disparadores de Sofia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {TRIGGER_DESCRIPTIONS.map(item => (
                <div key={item.trigger} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{item.trigger}</p>
                    <p className="text-gray-500">{item.action}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pre-qual stats */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />Pre-calificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Contactos totales</span>
                <span className="font-bold text-gray-900">{preQualStats.totalContacts}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tocados por Sofia</span>
                <span className="font-bold text-indigo-600">{preQualStats.aiTouched}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Llamadas pendientes</span>
                <span className="font-bold text-amber-600">{preQualStats.pendingCalls}</span>
              </div>
              <div className="pt-1">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cobertura IA</span>
                  <span>{aiCoveragePercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${aiCoveragePercent}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
