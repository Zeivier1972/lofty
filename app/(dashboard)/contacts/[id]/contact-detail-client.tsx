"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Phone, Mail, MapPin, Edit, ArrowLeft, Tag, Plus,
  MessageSquare, Calendar, FileText, Home, GitBranch,
  CheckSquare, Zap, Clock, Pin, Trash2, Send, MoreVertical,
  Building, Globe, Facebook, Instagram, Linkedin, Bot,
  TrendingUp, Eye, Star, ChevronRight, ChevronDown,
  Activity, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  cn, formatDate, formatRelativeTime, formatPhone, formatCurrency,
  getInitials, getStatusColor, getPriorityColor, getLeadScoreColor,
} from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

function generateInsight(contact: any): string | null {
  const emails = contact.emails || []
  const activities = contact.activities || []
  const emailActivities = activities.filter((a: any) => a.type === "EMAIL" || a.type === "EMAIL_SENT")
  const fullName = `${contact.firstName} ${contact.lastName}`

  const openedEmails = emailActivities.length
  if (openedEmails > 0) {
    const timeAgo = emailActivities[0]?.createdAt
      ? new Date(emailActivities[0].createdAt).toLocaleString()
      : "recently"
    const zips = contact.buyerLocation ? `in ${contact.buyerLocation}` : ""
    return `Lead ${fullName} opened automated emails ${openedEmails > 1 ? `multiple times: ${emailActivities.slice(0, 3).map((a: any) => new Date(a.createdAt).toLocaleString()).join(", ")}` : `at ${timeAgo}`}. High engagement with listing alerts ${zips}. Suggested immediate outreach to qualify needs and offer showings.`
  }

  if (contact.propertyInterests?.length > 0) {
    return `Lead ${fullName} has shown interest in ${contact.propertyInterests.length} properties. Consider reaching out to schedule showings and discuss their needs.`
  }

  const daysSince = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / 86400000)
  if (daysSince <= 1) {
    return `New lead ${fullName} just registered from ${contact.source || "your website"}. Immediate outreach within the first hour dramatically increases conversion rates.`
  }

  return null
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  EMAIL: { icon: "✉️", color: "bg-blue-100" },
  EMAIL_SENT: { icon: "✉️", color: "bg-blue-100" },
  SMS: { icon: "💬", color: "bg-green-100" },
  SMS_SENT: { icon: "💬", color: "bg-green-100" },
  CALL: { icon: "📞", color: "bg-purple-100" },
  CALL_MADE: { icon: "📞", color: "bg-purple-100" },
  TASK_COMPLETED: { icon: "✅", color: "bg-green-100" },
  NOTE_ADDED: { icon: "📝", color: "bg-yellow-100" },
  PROPERTY_VIEWED: { icon: "🏠", color: "bg-orange-100" },
  PIPELINE_MOVED: { icon: "📊", color: "bg-indigo-100" },
  APPOINTMENT_SCHEDULED: { icon: "📅", color: "bg-pink-100" },
  CONTACT_CREATED: { icon: "👤", color: "bg-gray-100" },
}

type TabId = "overview" | "properties" | "searches" | "transactions" | "documents" | "automations"

export default function ContactDetailClient({ contact, smsMessages = [], stages = [], pipelineId = "" }: { contact: any; smsMessages?: any[]; stages?: any[]; pipelineId?: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [newNote, setNewNote] = useState("")
  const [notes, setNotes] = useState(contact.notes)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [noteType, setNoteType] = useState("Note")
  const [updatingStage, setUpdatingStage] = useState(false)
  const [currentPipeline, setCurrentPipeline] = useState(contact.pipelineLeads?.[0])
  const [sofiaLoading, setSofiaLoading] = useState(false)
  const [activityFilter, setActivityFilter] = useState("All")
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [expandedCall, setExpandedCall] = useState<string | null>(null)

  const triggerSofiaCall = async () => {
    if (!contact.phone) return
    setSofiaLoading(true)
    try {
      const res = await fetch("/api/vapi/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id, phone: contact.phone, name: `${contact.firstName} ${contact.lastName || ""}`.trim() }),
      })
      const data = await res.json()
      if (data.callId) {
        toast({ title: "📞 Sofía está llamando...", description: `Llamada iniciada a ${contact.firstName}` })
      } else {
        toast({ title: "Error", description: data.error || "No se pudo iniciar la llamada", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo conectar", variant: "destructive" })
    } finally {
      setSofiaLoading(false)
    }
  }

  const assignStage = async (stageId: string) => {
    setUpdatingStage(true)
    try {
      const res = await fetch("/api/pipeline/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id, stageId, pipelineId }),
      })
      if (!res.ok) throw new Error("Failed")
      const stage = stages.find(s => s.id === stageId)
      setCurrentPipeline((prev: any) => ({ ...prev, stage }))
      router.refresh()
    } catch {
      toast({ title: "Failed to update stage", variant: "destructive" })
    }
    setUpdatingStage(false)
  }

  const insight = generateInsight(contact)
  const fullName = `${contact.firstName} ${contact.lastName}`
  const initials = getInitials(fullName)
  const enrollment = contact.enrollments?.[0]
  const daysSinceContact = contact.lastContacted
    ? Math.floor((Date.now() - new Date(contact.lastContacted).getTime()) / 86400000)
    : null

  const addNote = async () => {
    if (!newNote.trim()) return
    setIsAddingNote(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      })
      const note = await res.json()
      setNotes([note, ...notes])
      setNewNote("")
      toast({ title: "Note added" })
    } catch {
      toast({ title: "Error adding note", variant: "destructive" })
    } finally {
      setIsAddingNote(false)
    }
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "properties", label: "Properties", count: contact.propertyInterests?.length },
    { id: "searches", label: "Searches" },
    { id: "transactions", label: "Transactions", count: contact.transactions?.length },
    { id: "documents", label: "Documents" },
    { id: "automations", label: `Automations${contact.enrollments?.length > 0 ? ` (${contact.enrollments.length})` : ""}` },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* AI Insight Banner */}
      {insight && (
        <div className="mx-6 mt-4 rounded-2xl p-4 flex items-start gap-4 shadow-sm"
          style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)" }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm leading-relaxed">{insight}</p>
            <div className="flex gap-2 mt-3">
              {contact.phone && (
                <a href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                  <Phone className="w-3 h-3" /> Call to qualify needs
                </a>
              )}
              <button onClick={triggerSofiaCall} disabled={sofiaLoading || !contact.phone} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                <Bot className="w-3 h-3" /> {sofiaLoading ? "Llamando..." : "Talk to AI Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto p-4 space-y-4">
          {/* Contact header */}
          <div className="flex items-start gap-3">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarFallback className="bg-lofty-100 text-lofty-700 text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h2 className="font-bold text-gray-900 text-base truncate">{fullName}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0">
                      <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600 flex items-center gap-2"
                      onClick={async () => {
                        if (!confirm(`Delete ${fullName}? This cannot be undone.`)) return
                        await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" })
                        router.push("/contacts")
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete contact
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge className={cn("text-xs px-2", getStatusColor(contact.status))}>
                  {contact.status === "LEAD" ? "Buyer" : contact.status.replace(/_/g, " ")}
                </Badge>
                {contact.tags.slice(0, 1).map((ct: any) => (
                  <span key={ct.tagId} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                    {ct.tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div>
            <p className="text-xs text-gray-400 mb-1 font-medium">Pipeline</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("w-full flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors text-left", updatingStage && "opacity-50")}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentPipeline?.stage?.color || "#94a3b8" }} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{currentPipeline?.stage?.name || "Set stage"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                {stages.map((s: any) => (
                  <DropdownMenuItem key={s.id} onClick={() => assignStage(s.id)} className={cn("flex items-center gap-2", currentPipeline?.stage?.id === s.id && "bg-lofty-50")}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </DropdownMenuItem>
                ))}
                {stages.length === 0 && <DropdownMenuItem disabled className="text-gray-400 text-xs">No stages configured</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <a href={`tel:${contact.phone}`}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
                contact.phone ? "bg-green-500 hover:bg-green-600" : "bg-gray-200 cursor-not-allowed text-gray-400")}>
              <Phone className="w-4 h-4" />
            </a>
            <SmsButton contactId={contact.id} phone={contact.phone} name={`${contact.firstName} ${contact.lastName || ""}`.trim()} />
            <a href={`mailto:${contact.email}`}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
                contact.email ? "bg-purple-500 hover:bg-purple-600" : "bg-gray-200 cursor-not-allowed text-gray-400")}>
              <Mail className="w-4 h-4" />
            </a>
            <SofiaCallButton contactId={contact.id} phone={contact.phone} name={`${contact.firstName} ${contact.lastName || ""}`.trim()} />
          </div>

          {/* Insight metrics */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Insight</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={cn("text-lg font-bold", getLeadScoreColor(contact.leadScore))}>{contact.leadScore}</p>
                <p className="text-xs text-gray-400">Lead Score</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-700">
                  {daysSinceContact !== null ? `${daysSinceContact}d` : "—"}
                </p>
                <p className="text-xs text-gray-400">Last Touch</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-700">
                  {contact.activities.length}
                </p>
                <p className="text-xs text-gray-400">Activities</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</p>
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <a href={`tel:${contact.phone}`} className="text-gray-700 hover:text-lofty-600">{formatPhone(contact.phone)}</a>
                <span className="ml-auto text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Valid</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <a href={`mailto:${contact.email}`} className="text-gray-700 hover:text-lofty-600 truncate text-xs">{contact.email}</a>
              </div>
            )}
            {contact.source && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 text-xs">Source: {contact.source.replace(/_/g, " ")}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 text-xs">Reg: {formatDate(contact.createdAt)}</span>
            </div>
            {contact.assignedTo && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-xs bg-lofty-100 text-lofty-700">{getInitials(contact.assignedTo.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-600">{contact.assignedTo.name}</span>
                <span className="text-xs text-gray-400 ml-auto">Owner</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((ct: any) => (
                  <span key={ct.tagId} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                    {ct.tag.name}
                  </span>
                ))}
                <button className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-lofty-400 hover:text-lofty-600 transition-colors flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Tag
                </button>
              </div>
            </div>
          )}

          {/* Buyer/Seller profile */}
          {(contact.buyerBudgetMax || contact.buyerLocation || contact.sellerAddress) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {contact.sellerAddress ? "Seller Profile" : "Search Criteria"}
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                {contact.buyerBudgetMax && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Budget</span>
                    <span className="font-medium text-gray-800">
                      {contact.buyerBudgetMin ? `${formatCurrency(contact.buyerBudgetMin)} – ` : "Up to "}
                      {formatCurrency(contact.buyerBudgetMax)}
                    </span>
                  </div>
                )}
                {contact.buyerBedroomsMin && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bedrooms</span>
                    <span className="font-medium text-gray-800">{contact.buyerBedroomsMin}+</span>
                  </div>
                )}
                {contact.buyerLocation && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Area</span>
                    <span className="font-medium text-gray-800 text-right max-w-[120px]">{contact.buyerLocation}</span>
                  </div>
                )}
                {contact.sellerAddress && (
                  <div>
                    <span className="text-gray-500">Property</span>
                    <p className="font-medium text-gray-800 mt-0.5">{contact.sellerAddress}</p>
                  </div>
                )}
                {contact.sellerEstimatedValue && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Est. Value</span>
                    <span className="font-medium text-green-600">{formatCurrency(contact.sellerEstimatedValue)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit link */}
          <Link href={`/contacts/${contact.id}/edit`}>
            <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
              <Edit className="w-4 h-4" /> Edit Contact
            </Button>
          </Link>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="flex gap-0 px-4 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn("px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-3 gap-5">
                {/* Activity timeline */}
                <div className="col-span-2 space-y-3">
                  {/* Note input */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <select value={noteType} onChange={e => setNoteType(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-lofty-500">
                        <option>Note</option>
                        <option>Call Log</option>
                        <option>Task</option>
                        <option>Appointment</option>
                      </select>
                    </div>
                    <Textarea
                      placeholder={`Add a ${noteType.toLowerCase()}...`}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      rows={2}
                      className="resize-none border-0 p-0 focus-visible:ring-0 text-sm placeholder-gray-300"
                    />
                    <div className="flex justify-end mt-2">
                      <Button onClick={addNote} disabled={isAddingNote || !newNote.trim()} size="sm"
                        className="bg-lofty-600 hover:bg-lofty-700 gap-1.5">
                        <Send className="w-3.5 h-3.5" /> Save
                      </Button>
                    </div>
                  </div>

                  {/* Activity filter */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {["All", "Notes", "Calls", "Emails", "Texts", "Tasks", "Appointments"].map(f => (
                      <button key={f} onClick={() => setActivityFilter(f)} className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", activityFilter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Timeline events */}
                  <div className="space-y-2">
                    {/* Notes */}
                    {(activityFilter === "All" || activityFilter === "Notes") && notes.map((note: any) => (
                      <div key={note.id} className={cn("bg-white rounded-xl border shadow-sm p-4", note.isPinned && "border-l-4 border-l-yellow-400")}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm">📝</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase">Note</span>
                              {note.author && <span className="text-xs text-gray-400">{note.author.name}</span>}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(note.createdAt)}</p>
                          </div>
                          {note.isPinned && <Pin className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                        </div>
                      </div>
                    ))}

                    {/* SMS Messages */}
                    {(activityFilter === "All" || activityFilter === "Texts") && smsMessages.map((sms: any) => (
                      <div key={sms.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm", sms.direction === "INBOUND" ? "bg-green-100" : "bg-blue-100")}>
                            💬
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase">{sms.direction === "INBOUND" ? "SMS recibido" : "SMS enviado"}</span>
                              <Badge className={cn("text-xs", sms.status === "SENT" || sms.status === "DELIVERED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{sms.status}</Badge>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{sms.body}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(sms.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Emails */}
                    {(activityFilter === "All" || activityFilter === "Emails") && contact.emails.map((email: any) => (
                      <div key={email.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm">✉️</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <button onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)} className="text-sm font-medium text-blue-700 hover:underline text-left">
                                {email.subject}
                              </button>
                              <Badge className={cn("text-xs flex-shrink-0", email.status === "SENT" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{email.status}</Badge>
                            </div>
                            <p className="text-xs text-gray-400">{formatRelativeTime(email.createdAt)}</p>
                            {expandedEmail === email.id && email.body && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100" dangerouslySetInnerHTML={{ __html: email.body }} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Calls */}
                    {(activityFilter === "All" || activityFilter === "Calls") && contact.dialerCalls?.map((call: any) => (
                      <div key={call.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm", call.status === "COMPLETED" ? "bg-purple-100" : "bg-gray-100")}>
                            📞
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase">Llamada Sofía</span>
                              <Badge className={cn("text-xs", call.status === "COMPLETED" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500")}>{call.status === "COMPLETED" ? `${call.duration}s` : call.status}</Badge>
                            </div>
                            {call.aiSummary && <p className="text-sm text-gray-700 mb-1">{call.aiSummary}</p>}
                            <p className="text-xs text-gray-400">{formatRelativeTime(call.createdAt)}</p>
                            {(call.recordingUrl || call.transcription) && (
                              <div className="mt-2 flex gap-2">
                                {call.recordingUrl && (
                                  <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                                    🎙 Escuchar grabación
                                  </a>
                                )}
                                {call.transcription && (
                                  <button onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)} className="text-xs text-blue-600 hover:underline">
                                    {expandedCall === call.id ? "Ocultar transcripción" : "Ver transcripción"}
                                  </button>
                                )}
                              </div>
                            )}
                            {expandedCall === call.id && call.transcription && (
                              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto border border-gray-100">
                                {call.transcription}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Activities */}
                    {(activityFilter === "All") && contact.activities.map((activity: any) => {
                      const def = ACTIVITY_ICONS[activity.type] || { icon: "📌", color: "bg-gray-100" }
                      return (
                        <div key={activity.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm", def.color)}>
                              {def.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                              {activity.description && (
                                <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-line line-clamp-3">{activity.description}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(activity.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {notes.length === 0 && contact.activities.length === 0 && contact.emails.length === 0 && smsMessages.length === 0 && !contact.dialerCalls?.length && (
                      <div className="text-center py-12">
                        <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">No activity yet — add a note or log a call</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Tasks + Appointments */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
                      <button className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      {contact.tasks.map((task: any) => (
                        <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                          <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", {
                            "bg-red-500": task.priority === "URGENT",
                            "bg-orange-500": task.priority === "HIGH",
                            "bg-blue-500": task.priority === "MEDIUM",
                            "bg-gray-400": task.priority === "LOW",
                          })} />
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium leading-tight", task.status === "COMPLETED" && "line-through text-gray-400")}>
                              {task.title}
                            </p>
                            {task.dueDate && (
                              <p className={cn("text-xs mt-0.5", new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "text-orange-500" : "text-gray-400")}>
                                {formatDate(task.dueDate)}
                              </p>
                            )}
                            {task.assignedTo && (
                              <p className="text-xs text-gray-400">{task.assignedTo.name}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {contact.tasks.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">No tasks</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Appointments</h3>
                      <button className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                    <div className="p-3">
                      {contact.appointments?.length > 0 ? (
                        <div className="space-y-2">
                          {contact.appointments.map((apt: any) => (
                            <div key={apt.id} className="p-2 rounded-lg hover:bg-gray-50">
                              <p className="text-xs font-medium">{apt.title}</p>
                              <p className="text-xs text-gray-400">{formatDate(apt.startTime)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">No appointments</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Properties Tab */}
            {activeTab === "properties" && (
              <div className="space-y-3">
                {contact.propertyInterests?.length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No properties associated with this contact</p>
                  </div>
                ) : (
                  contact.propertyInterests?.map((interest: any) => (
                    <div key={interest.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Home className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{interest.property.address}</p>
                        <p className="text-sm text-gray-500">{interest.property.city}, {interest.property.state} · {formatCurrency(interest.property.price)}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 border-0">{interest.type}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Searches Tab */}
            {activeTab === "searches" && (
              <div className="space-y-4">
                {contact.buyerBudgetMax || contact.buyerLocation ? (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Search className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Saved Search Profile</h3>
                        <p className="text-sm text-gray-400">Auto-matched from lead registration data</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {contact.buyerBudgetMax && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-0.5">Budget Range</p>
                          <p className="font-semibold text-gray-800">
                            {contact.buyerBudgetMin ? `${formatCurrency(contact.buyerBudgetMin)} – ` : "Up to "}
                            {formatCurrency(contact.buyerBudgetMax)}
                          </p>
                        </div>
                      )}
                      {contact.buyerBedroomsMin && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-0.5">Min Bedrooms</p>
                          <p className="font-semibold text-gray-800">{contact.buyerBedroomsMin}+</p>
                        </div>
                      )}
                      {contact.buyerLocation && (
                        <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                          <p className="text-xs text-gray-400 mb-0.5">Location / Zips</p>
                          <p className="font-semibold text-gray-800">{contact.buyerLocation}</p>
                        </div>
                      )}
                      {contact.buyerPropertyType && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-0.5">Property Type</p>
                          <p className="font-semibold text-gray-800">{contact.buyerPropertyType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No search criteria saved</p>
                    <p className="text-gray-300 text-xs mt-1">Edit the contact to add buyer search criteria</p>
                  </div>
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === "transactions" && (
              <div className="space-y-3">
                {contact.transactions?.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No transactions yet</p>
                  </div>
                ) : (
                  contact.transactions.map((transaction: any) => (
                    <Link key={transaction.id} href={`/transactions/${transaction.id}`}
                      className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{transaction.title}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(transaction.salePrice || transaction.listPrice)}</p>
                        </div>
                        <Badge className={cn("text-xs", getStatusColor(transaction.status))}>
                          {transaction.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No documents uploaded</p>
                <Button variant="outline" size="sm" className="mt-4 gap-2">
                  <Plus className="w-4 h-4" /> Upload Document
                </Button>
              </div>
            )}

            {/* Automations Tab */}
            {activeTab === "automations" && (
              <div className="space-y-3">
                {contact.enrollments?.length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Not enrolled in any smart plans</p>
                    <Link href="/smart-plans">
                      <Button variant="outline" size="sm" className="mt-4 gap-2">
                        <Zap className="w-4 h-4" /> Browse Smart Plans
                      </Button>
                    </Link>
                  </div>
                ) : (
                  contact.enrollments.map((enr: any) => (
                    <div key={enr.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
                          enr.status === "ACTIVE" ? "bg-green-100" : "bg-gray-100")}>
                          <Zap className={cn("w-4 h-4", enr.status === "ACTIVE" ? "text-green-600" : "text-gray-400")} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{enr.plan.name}</p>
                          <p className="text-xs text-gray-400">Step {enr.currentStep} · {enr.status}</p>
                        </div>
                        <Badge className={cn("text-xs", enr.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                          {enr.status === "ACTIVE" ? "Running" : enr.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SmsButton({ contactId, phone, name }: { contactId: string; phone?: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  if (!phone) return null

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, message }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "✅ Mensaje enviado", description: `SMS enviado a ${name}` })
        setMessage("")
        setOpen(false)
      } else {
        toast({ title: "Error", description: data.error || "No se pudo enviar", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo conectar", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Enviar SMS"
        className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
          "bg-blue-500 hover:bg-blue-600")}>
        <MessageSquare className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Enviar SMS</p>
                <p className="text-sm text-gray-400">{phone}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>
            <textarea
              autoFocus
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Escribe tu mensaje para ${name}...`}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{message.length}/160 caracteres</p>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Send className="w-4 h-4" />
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SofiaCallButton({ contactId, phone, name }: { contactId: string; phone?: string; name: string }) {
  const [calling, setCalling] = useState(false)
  const { toast } = useToast()

  if (!phone) return null

  async function handleCall() {
    setCalling(true)
    try {
      const res = await fetch("/api/vapi/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, phone, name }),
      })
      const data = await res.json()
      if (data.callId) {
        toast({ title: "📞 Sofía está llamando...", description: `Llamada iniciada a ${name}` })
      } else {
        toast({ title: "Error", description: data.error || "No se pudo iniciar la llamada", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo conectar", variant: "destructive" })
    } finally {
      setCalling(false)
    }
  }

  return (
    <button
      onClick={handleCall}
      disabled={calling}
      title="Llamar con Sofía (AI)"
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
      <Bot className="w-4 h-4" />
    </button>
  )
}
