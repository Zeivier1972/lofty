"use client"

import Link from "next/link"
import {
  Home, Calendar, MessageSquare, FileText, Map,
  ChevronRight, CheckCircle2, Clock, Star,
  TrendingUp, Phone, Mail, ArrowRight, Sparkles,
} from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

interface Milestone {
  id: string
  name: string
  status: string
  dueDate: string | null
  completedDate: string | null
  order: number
}

interface Transaction {
  id: string
  title: string
  address: string
  type: string
  status: string
  salePrice: number | null
  listPrice: number | null
  closeDate: string | null
  milestones: Milestone[]
}

interface PropertySave {
  property: {
    id: string
    address: string
    city: string
    price: number
    bedrooms: number | null
    bathrooms: number | null
    images: string | null
  }
}

interface Appointment {
  id: string
  title: string
  startTime: string
  location: string | null
  type: string
}

interface Contact {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
  leadScore: number
  transactions: Transaction[]
  propertySaves: PropertySave[]
  appointments: Appointment[]
  portalMessages: { isRead: boolean; fromClient: boolean }[]
}

function getPropertyImage(imagesStr: string | null): string {
  try { const a = JSON.parse(imagesStr || "[]"); return Array.isArray(a) && a[0] ? a[0] : "" } catch { return "" }
}

const TRANSACTION_STAGES = [
  { key: "ACTIVE_LISTING", label: "Listed", step: 1 },
  { key: "UNDER_CONTRACT", label: "Under Contract", step: 2 },
  { key: "INSPECTION", label: "Inspection", step: 3 },
  { key: "APPRAISAL", label: "Appraisal", step: 4 },
  { key: "CLEAR_TO_CLOSE", label: "Clear to Close", step: 5 },
  { key: "CLOSED", label: "Closed!", step: 6 },
]

export default function PortalDashboardClient({
  contact,
  agentPhone = "305-283-0872",
  agentEmail = "",
  agentName = "Catherine",
}: {
  contact: Contact
  agentPhone?: string
  agentEmail?: string
  agentName?: string
}) {
  const phoneE164 = agentPhone.startsWith("+") ? agentPhone : `+1${agentPhone.replace(/\D/g, "").slice(-10)}`
  const phoneDisplay = agentPhone.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
  const transaction = contact.transactions[0] || null
  const currentStageStep = TRANSACTION_STAGES.find(s => s.key === transaction?.status)?.step || 1
  const completedMilestones = transaction?.milestones.filter(m => m.status === "COMPLETED").length || 0
  const totalMilestones = transaction?.milestones.length || 0
  const progressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0
  const unreadMessages = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"
  const greetingEs = new Date().getHours() < 12 ? "Buenos días" : new Date().getHours() < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-lofty-800 to-lofty-600 rounded-2xl p-6 text-white mb-8 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lofty-300 text-sm">{greeting} / {greetingEs}</p>
            <h1 className="text-2xl font-bold mt-0.5">{contact.firstName} {contact.lastName}</h1>
            <p className="text-lofty-200 text-sm mt-2">
              {transaction
                ? `Your ${transaction.type === "BUYER" ? "home purchase" : "home sale"} is in progress`
                : "Welcome to your real estate portal"}
            </p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-black">{contact.firstName[0]}{contact.lastName[0]}</span>
          </div>
        </div>
        {transaction && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-lofty-300 mb-1.5">
              <span>Deal Progress</span>
              <span>{progressPct}% complete</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {TRANSACTION_STAGES.map(stage => (
                <div key={stage.key} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-3 h-3 rounded-full border-2 border-white/40",
                    stage.step <= currentStageStep ? "bg-white" : "bg-white/20"
                  )} />
                  <span className="text-[9px] text-lofty-300 hidden sm:block">{stage.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            href: "/portal/messages",
            icon: MessageSquare,
            label: "Messages",
            labelEs: "Mensajes",
            color: "bg-blue-500",
            badge: unreadMessages,
          },
          {
            href: "/portal/timeline",
            icon: Map,
            label: "Timeline",
            labelEs: "Progreso",
            color: "bg-lofty-600",
            badge: 0,
          },
          {
            href: "/portal/properties",
            icon: Home,
            label: "My Homes",
            labelEs: "Mis Propiedades",
            color: "bg-emerald-500",
            badge: contact.propertySaves.length,
          },
          {
            href: "/portal/documents",
            icon: FileText,
            label: "Documents",
            labelEs: "Documentos",
            color: "bg-amber-500",
            badge: transaction?.milestones.filter(m => m.status === "PENDING").length || 0,
          },
        ].map(({ href, icon: Icon, label, labelEs, color, badge }) => (
          <Link
            key={href}
            href={href}
            className="relative bg-white rounded-2xl border p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-lofty-200 transition-all group"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", color)}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">{label}</div>
              <div className="text-xs text-gray-400">{labelEs}</div>
            </div>
            {badge > 0 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active transaction */}
          {transaction && (
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Active Transaction</h2>
                <Link href="/portal/timeline" className="text-xs text-lofty-600 hover:text-lofty-700 font-medium flex items-center gap-1">
                  Full Timeline <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-lofty-50 rounded-xl">
                <div className="w-10 h-10 bg-lofty-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Home className="w-5 h-5 text-lofty-700" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{transaction.address}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="text-lofty-600 font-semibold">
                      {formatCurrency(transaction.salePrice || transaction.listPrice || 0)}
                    </span>
                    <span>•</span>
                    <span>{transaction.type} transaction</span>
                    {transaction.closeDate && <span>• Closes {new Date(transaction.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div className="space-y-2">
                {transaction.milestones.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      m.status === "COMPLETED" ? "bg-green-100" :
                      m.status === "IN_PROGRESS" ? "bg-blue-100" : "bg-gray-100"
                    )}>
                      {m.status === "COMPLETED"
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : m.status === "IN_PROGRESS"
                        ? <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                        : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                    </div>
                    <span className={cn(
                      "text-sm flex-1",
                      m.status === "COMPLETED" ? "line-through text-gray-400" :
                      m.status === "IN_PROGRESS" ? "font-semibold text-blue-700" : "text-gray-600"
                    )}>
                      {m.name}
                    </span>
                    {m.dueDate && m.status !== "COMPLETED" && (
                      <span className="text-xs text-gray-400">
                        {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming appointments */}
          {contact.appointments.length > 0 && (
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">Upcoming Appointments</h2>
              <div className="space-y-3">
                {contact.appointments.map(apt => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-lofty-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-lofty-600 uppercase">
                        {new Date(apt.startTime).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-sm font-black text-lofty-800 leading-tight">
                        {new Date(apt.startTime).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{apt.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(apt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {apt.location && ` · ${apt.location}`}
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      apt.type === "SHOWING" ? "bg-blue-100 text-blue-700" :
                      apt.type === "INSPECTION" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {apt.type.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved properties preview */}
          {contact.propertySaves.length > 0 && (
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Saved Homes</h2>
                <Link href="/portal/properties" className="text-xs text-lofty-600 font-medium flex items-center gap-1">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {contact.propertySaves.slice(0, 4).map(({ property }) => {
                  const img = getPropertyImage(property.images)
                  return (
                    <div key={property.id} className="rounded-xl overflow-hidden border hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-200 overflow-hidden">
                        {img ? (
                          <img src={img} alt={property.address} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Home className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-semibold text-lofty-700">{formatCurrency(property.price)}</div>
                        <div className="text-xs text-gray-500 truncate">{property.city}</div>
                        {(property.bedrooms || property.bathrooms) && (
                          <div className="text-xs text-gray-400">
                            {property.bedrooms}bd · {property.bathrooms}ba
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Agent contact card */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Tu Agente / Your Agent</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-lofty-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-black text-lofty-700">{agentName.charAt(0)}</span>
              </div>
              <div>
                <div className="font-bold text-gray-900">{agentName}</div>
                <div className="text-xs text-gray-500">Agente de Bienes Raíces</div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Link
                href="/portal/messages"
                className="flex items-center gap-2 w-full p-3 bg-lofty-600 text-white rounded-xl text-sm font-semibold hover:bg-lofty-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Enviar mensaje
              </Link>
              <a
                href={`sms:${phoneE164}`}
                className="flex items-center gap-2 w-full p-2.5 border rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-green-600" /> Enviar texto · {phoneDisplay}
              </a>
              <a
                href={`tel:${phoneE164}`}
                className="flex items-center gap-2 w-full p-2.5 border rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-4 h-4 text-lofty-600" /> Llamar · {phoneDisplay}
              </a>
              {agentEmail && (
                <a
                  href={`mailto:${agentEmail}`}
                  className="flex items-center gap-2 w-full p-2.5 border rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4 text-lofty-600" /> Enviar email
                </a>
              )}
            </div>
          </div>

          {/* AI tip card */}
          <div className="bg-gradient-to-br from-purple-600 to-lofty-700 rounded-2xl p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold">Sofía — Asistente IA</span>
            </div>
            <p className="text-sm text-purple-100 leading-relaxed">
              Estoy aquí 24/7 para responder tus preguntas sobre bienes raíces en español o inglés. ¡Escríbeme cuando quieras!
            </p>
            <p className="text-xs text-purple-300 mt-2">
              Available 24/7 in English and Spanish.
            </p>
            <Link href="/portal/messages" className="mt-3 flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white">
              Chatear ahora <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">Your Journey</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Saved Homes</span>
                <span className="font-bold text-lofty-700">{contact.propertySaves.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Appointments</span>
                <span className="font-bold text-gray-900">{contact.appointments.length}</span>
              </div>
              {transaction && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Milestones Done</span>
                    <span className="font-bold text-green-600">{completedMilestones}/{totalMilestones}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Deal Progress</span>
                    <span className="font-bold text-lofty-600">{progressPct}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
