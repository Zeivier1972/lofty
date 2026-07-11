"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Phone, Mail, MapPin, Edit, ArrowLeft, Tag, Plus,
  MessageSquare, Calendar, FileText, Home, GitBranch,
  CheckSquare, Zap, Clock, Pin, Trash2, Send, MoreVertical,
  Building, Globe, Facebook, Instagram, Linkedin, Bot,
  TrendingUp, Eye, Star, ChevronRight, ChevronDown,
  Activity, Search, Loader2, X, PhoneCall, PhoneMissed, PhoneOff, MicOff, Play, Menu,
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
import { AiAssistBar } from "@/components/ui/ai-assist-bar"
import PropertySendPanel from "./property-send-panel"
import PreconstructionSendPanel from "./preconstruction-send-panel"
import ReferButton from "./refer-button"

function generateInsight(contact: any): string | null {
  const emails = contact.emails || []
  const activities = contact.activities || []
  const fullName = `${contact.firstName} ${contact.lastName}`
  const zips = contact.buyerLocation ? `in ${contact.buyerLocation}` : ""

  // REAL opens only — recorded by the tracking pixel (EMAIL_OPENED activity /
  // openedAt on the email row). Never claim "opened" for merely-sent emails.
  const openActivities = activities.filter((a: any) => a.type === "EMAIL_OPENED")
  const openedRows = emails.filter((e: any) => e.openedAt)
  const opens = openActivities.length || openedRows.length
  if (opens > 0) {
    const lastOpen = openActivities[0]?.createdAt || openedRows[0]?.openedAt
    const timeAgo = lastOpen ? new Date(lastOpen).toLocaleString() : "recently"
    return `Lead ${fullName} opened automated emails ${opens > 1 ? `${opens} times, last at ${timeAgo}` : `at ${timeAgo}`}. High engagement with listing alerts ${zips}. Suggested immediate outreach to qualify needs and offer showings.`
  }

  // Emails sent but no recorded opens yet — say so honestly
  const sentActivities = activities.filter((a: any) => a.type === "EMAIL" || a.type === "EMAIL_SENT")
  if (sentActivities.length >= 3) {
    return `Lead ${fullName} has received ${sentActivities.length} automated emails ${zips} — no opens recorded yet. Consider a call or text to check the email is reaching them.`
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
  EMAIL_OPENED: { icon: "📬", color: "bg-green-100" },
  TASK_COMPLETED: { icon: "✅", color: "bg-green-100" },
  NOTE_ADDED: { icon: "📝", color: "bg-yellow-100" },
  PROPERTY_VIEWED: { icon: "🏠", color: "bg-orange-100" },
  PIPELINE_MOVED: { icon: "📊", color: "bg-indigo-100" },
  APPOINTMENT_SCHEDULED: { icon: "📅", color: "bg-pink-100" },
  CONTACT_CREATED: { icon: "👤", color: "bg-gray-100" },
}

type TabId = "overview" | "properties" | "searches" | "transactions" | "documents" | "automations" | "calls"

function BuyerPrefsPanel({ contact }: { contact: any }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({
    buyerPropertyType: contact.buyerPropertyType || "",
    buyerLocation: contact.buyerLocation || "",
    buyerBedroomsMin: contact.buyerBedroomsMin != null ? String(contact.buyerBedroomsMin) : "",
    buyerBathroomsMin: contact.buyerBathroomsMin != null ? String(contact.buyerBathroomsMin) : "",
    buyerBudgetMin: contact.buyerBudgetMin != null ? String(contact.buyerBudgetMin) : "",
    buyerBudgetMax: contact.buyerBudgetMax != null ? String(contact.buyerBudgetMax) : "",
    buyerTimelineMonths: contact.buyerTimelineMonths != null ? String(contact.buyerTimelineMonths) : "",
    buyerPurpose: contact.buyerPurpose || "",
    buyerMustHaves: contact.buyerMustHaves || "",
  })

  async function save() {
    setSaving(true)
    try {
      const body = {
        buyerPropertyType: fields.buyerPropertyType || null,
        buyerLocation: fields.buyerLocation || null,
        buyerBedroomsMin: fields.buyerBedroomsMin ? parseInt(fields.buyerBedroomsMin) : null,
        buyerBathroomsMin: fields.buyerBathroomsMin ? parseFloat(fields.buyerBathroomsMin) : null,
        buyerBudgetMin: fields.buyerBudgetMin ? parseInt(fields.buyerBudgetMin) : null,
        buyerBudgetMax: fields.buyerBudgetMax ? parseInt(fields.buyerBudgetMax) : null,
        buyerTimelineMonths: fields.buyerTimelineMonths ? parseInt(fields.buyerTimelineMonths) : null,
        buyerPurpose: fields.buyerPurpose || null,
        buyerMustHaves: fields.buyerMustHaves || null,
      }
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to save")
      // Update local contact object so sidebar re-renders correctly
      Object.assign(contact, body)
      setEditing(false)
      toast({ title: "Buyer preferences saved" })
    } catch {
      toast({ title: "Error saving", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const hasData = fields.buyerBudgetMax || fields.buyerLocation || fields.buyerPropertyType || fields.buyerPurpose

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buyer Preferences</p>
        <button
          onClick={() => editing ? save() : setEditing(true)}
          disabled={saving}
          className="text-xs text-lofty-600 hover:text-lofty-800 font-medium flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : editing ? "Save" : <><Edit className="w-3 h-3" /> Edit</>}
        </button>
        {editing && (
          <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex gap-2">
            <select
              value={fields.buyerPropertyType}
              onChange={e => setFields(f => ({ ...f, buyerPropertyType: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lofty-500"
            >
              <option value="">Tipo de propiedad...</option>
              <option>Casa</option><option>Apartamento</option><option>Townhouse</option>
              <option>Condo</option><option>Terreno</option><option>Commercial</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Área / Zona / Ciudad..."
            value={fields.buyerLocation}
            onChange={e => setFields(f => ({ ...f, buyerLocation: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
          />
          <div className="flex gap-2">
            <select
              value={fields.buyerBedroomsMin}
              onChange={e => setFields(f => ({ ...f, buyerBedroomsMin: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lofty-500"
            >
              <option value="">Cuartos mín.</option>
              {["1","2","3","4","5"].map(v => <option key={v} value={v}>{v}+</option>)}
            </select>
            <select
              value={fields.buyerBathroomsMin}
              onChange={e => setFields(f => ({ ...f, buyerBathroomsMin: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lofty-500"
            >
              <option value="">Baños mín.</option>
              {["1","2","3","4"].map(v => <option key={v} value={v}>{v}+</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Budget mín $"
              value={fields.buyerBudgetMin}
              onChange={e => setFields(f => ({ ...f, buyerBudgetMin: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              placeholder="Budget máx $"
              value={fields.buyerBudgetMax}
              onChange={e => setFields(f => ({ ...f, buyerBudgetMax: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={fields.buyerTimelineMonths}
              onChange={e => setFields(f => ({ ...f, buyerTimelineMonths: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lofty-500"
            >
              <option value="">Plazo...</option>
              <option value="1">Lo antes posible</option>
              <option value="3">1–3 meses</option>
              <option value="6">3–6 meses</option>
              <option value="12">6–12 meses</option>
              <option value="24">1+ año</option>
            </select>
            <select
              value={fields.buyerPurpose}
              onChange={e => setFields(f => ({ ...f, buyerPurpose: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lofty-500"
            >
              <option value="">Propósito...</option>
              <option>Inversión</option><option>Vivienda principal</option>
              <option>Vacaciones</option><option>Airbnb</option><option>Renta</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Must-haves (piscina, garaje, vista al mar...)"
            value={fields.buyerMustHaves}
            onChange={e => setFields(f => ({ ...f, buyerMustHaves: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lofty-500"
          />
        </div>
      ) : hasData ? (
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
          {fields.buyerPropertyType && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo</span>
              <span className="font-medium text-gray-800">{fields.buyerPropertyType}</span>
            </div>
          )}
          {fields.buyerLocation && (
            <div className="flex justify-between">
              <span className="text-gray-500">Área</span>
              <span className="font-medium text-gray-800 text-right max-w-[130px]">{fields.buyerLocation}</span>
            </div>
          )}
          {(fields.buyerBudgetMin || fields.buyerBudgetMax) && (
            <div className="flex justify-between">
              <span className="text-gray-500">Presupuesto</span>
              <span className="font-medium text-gray-800">
                {fields.buyerBudgetMin ? `$${Number(fields.buyerBudgetMin).toLocaleString()}` : ""}
                {fields.buyerBudgetMin && fields.buyerBudgetMax ? " – " : ""}
                {fields.buyerBudgetMax ? `$${Number(fields.buyerBudgetMax).toLocaleString()}` : ""}
              </span>
            </div>
          )}
          {fields.buyerBedroomsMin && (
            <div className="flex justify-between">
              <span className="text-gray-500">Cuartos</span>
              <span className="font-medium text-gray-800">{fields.buyerBedroomsMin}+</span>
            </div>
          )}
          {fields.buyerPurpose && (
            <div className="flex justify-between">
              <span className="text-gray-500">Propósito</span>
              <span className="font-medium text-gray-800">{fields.buyerPurpose}</span>
            </div>
          )}
          {fields.buyerTimelineMonths && (
            <div className="flex justify-between">
              <span className="text-gray-500">Plazo</span>
              <span className="font-medium text-gray-800">{fields.buyerTimelineMonths} meses</span>
            </div>
          )}
          {fields.buyerMustHaves && (
            <div className="flex justify-between">
              <span className="text-gray-500">Must-haves</span>
              <span className="font-medium text-gray-800 text-right max-w-[130px]">{fields.buyerMustHaves}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg py-2 hover:border-lofty-400 hover:text-lofty-600 transition-colors"
        >
          + Add buyer preferences
        </button>
      )}
    </div>
  )
}

export default function ContactDetailClient({ contact, smsMessages = [], stages = [], pipelineId = "", alertsSent = [] }: { contact: any; smsMessages?: any[]; stages?: any[]; pipelineId?: string; alertsSent?: any[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [newNote, setNewNote] = useState("")
  const [notes, setNotes] = useState(contact.notes)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [noteType, setNoteType] = useState("Note")
  const [updatingStage, setUpdatingStage] = useState(false)
  const [currentPipeline, setCurrentPipeline] = useState(contact.pipelineLeads?.[0])
  const [sofiaLoading, setSofiaLoading] = useState(false)
  const [activityFilter, setActivityFilter] = useState("All")
  // Arriving from the inbox portal link (?tab=portal) opens the Portal tab so
  // PortalChatPanel mounts and marks the client's messages as read.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "portal") {
      setActivityFilter("Portal")
    }
  }, [])
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const [tasks, setTasks] = useState<any[]>(contact.tasks || [])
  const [appointments, setAppointments] = useState<any[]>(contact.appointments || [])
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDue, setNewTaskDue] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM")
  const [addingTask, setAddingTask] = useState(false)
  const [newAptTitle, setNewAptTitle] = useState("")
  const [newAptStart, setNewAptStart] = useState("")
  const [newAptEnd, setNewAptEnd] = useState("")
  const [addingApt, setAddingApt] = useState(false)
  const [calls, setCalls] = useState<any[]>([])
  const [callsLoaded, setCallsLoaded] = useState(false)
  const [loadingCalls, setLoadingCalls] = useState(false)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [showNewTx, setShowNewTx] = useState(false)
  const [newTxForm, setNewTxForm] = useState({ title: "", address: "", city: "", state: "FL", zip: "", type: "BUYER", listPrice: "" })
  const [savingTx, setSavingTx] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMediaUrl, setEmailMediaUrl] = useState("")
  const [emailLinkUrl, setEmailLinkUrl] = useState("")
  const [emailLinkText, setEmailLinkText] = useState("")
  const [showEmailImage, setShowEmailImage] = useState(false)
  const [showEmailLink, setShowEmailLink] = useState(false)
  const [contactTags, setContactTags] = useState<any[]>(contact.tags || [])
  const [allTags, setAllTags] = useState<any[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [savingTag, setSavingTag] = useState(false)
  const [enrollments, setEnrollments] = useState<any[]>(contact.enrollments || [])
  const [allPlans, setAllPlans] = useState<any[]>([])
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  const openTagPicker = async () => {
    if (!allTags.length) {
      const res = await fetch("/api/tags")
      const data = await res.json()
      setAllTags(data)
    }
    setShowTagPicker(true)
  }

  const openPlanPicker = async () => {
    if (!allPlans.length) {
      const res = await fetch("/api/smart-plans")
      const data = await res.json()
      setAllPlans(Array.isArray(data) ? data : [])
    }
    setShowPlanPicker(true)
  }

  const enrollInPlan = async (plan: any) => {
    setEnrolling(true)
    try {
      const res = await fetch(`/api/smart-plans/${plan.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to enroll", variant: "destructive" })
      } else {
        setEnrollments(prev => [...prev, { ...data, plan }])
        toast({ title: `Enrolled in "${plan.name}"` })
      }
    } finally {
      setEnrolling(false)
      setShowPlanPicker(false)
    }
  }

  const unenrollFromPlan = async (planId: string, planName: string) => {
    try {
      await fetch(`/api/smart-plans/${planId}/enroll`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id }),
      })
      setEnrollments(prev => prev.filter((e: any) => e.planId !== planId))
      toast({ title: `Removed from "${planName}"` })
    } catch {
      toast({ title: "Failed to unenroll", variant: "destructive" })
    }
  }

  const toggleTag = async (tag: any) => {
    const hasTag = contactTags.some((ct: any) => ct.tagId === tag.id)
    if (hasTag) {
      await fetch(`/api/contacts/${contact.id}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      })
      setContactTags(prev => prev.filter((ct: any) => ct.tagId !== tag.id))
    } else {
      await fetch(`/api/contacts/${contact.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      })
      setContactTags(prev => [...prev, { tagId: tag.id, tag }])
    }
  }

  const createAndAddTag = async () => {
    if (!newTagName.trim()) return
    setSavingTag(true)
    const colors = ["#4F46E5", "#059669", "#DC2626", "#D97706", "#7C3AED", "#0891B2"]
    const color = colors[Math.floor(Math.random() * colors.length)]
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color }),
    })
    const tag = await res.json()
    setAllTags(prev => [...prev, tag])
    await fetch(`/api/contacts/${contact.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    })
    setContactTags(prev => [...prev, { tagId: tag.id, tag }])
    setNewTagName("")
    setSavingTag(false)
  }

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

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle.trim(), dueDate: newTaskDue || undefined, priority: newTaskPriority, contactId: contact.id }),
      })
      const task = await res.json()
      setTasks(prev => [...prev, task])
      setNewTaskTitle("")
      setNewTaskDue("")
    } finally {
      setAddingTask(false)
    }
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED"
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t))
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
  }

  async function addAppointment() {
    if (!newAptTitle.trim() || !newAptStart || !newAptEnd) return
    setAddingApt(true)
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newAptTitle.trim(), startTime: newAptStart, endTime: newAptEnd, contactId: contact.id }),
      })
      const apt = await res.json().catch(() => ({}))
      if (res.ok && apt.id) {
        setAppointments(prev => [...prev, apt])
        setNewAptTitle("")
        setNewAptStart("")
        setNewAptEnd("")
        toast({ title: "📅 Cita agendada", description: "Cliente notificado por email/SMS y agregada a tu calendario." })
      } else {
        // Never fail silently — say exactly why (e.g. end before start)
        toast({ title: apt.error || `No se pudo agendar (error ${res.status})`, variant: "destructive" })
      }
    } catch {
      toast({ title: "No se pudo agendar la cita — revisa tu conexión", variant: "destructive" })
    } finally {
      setAddingApt(false)
    }
  }

  async function createTransactionForContact() {
    if (!newTxForm.title.trim() || !newTxForm.address.trim() || !newTxForm.city.trim() || !newTxForm.zip.trim()) return
    setSavingTx(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTxForm, contactId: contact.id, listPrice: newTxForm.listPrice || undefined }),
      })
      const data = await res.json()
      if (data.transaction) {
        router.push(`/transactions/${data.transaction.id}`)
      }
    } finally {
      setSavingTx(false)
    }
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
    { id: "properties", label: "Properties", count: (contact.propertyInterests?.length || 0) + (contact.propertySaves?.length || 0) + alertsSent.length },
    { id: "searches", label: "Searches" },
    { id: "transactions", label: "Transactions", count: contact.transactions?.length },
    { id: "documents", label: "Documents" },
    { id: "automations", label: `Automations${contact.enrollments?.length > 0 ? ` (${contact.enrollments.length})` : ""}` },
    { id: "calls", label: "Llamadas" },
  ]

  const loadCalls = useCallback(async () => {
    if (callsLoaded) return
    setLoadingCalls(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/calls`)
      const data = await res.json()
      setCalls(data.calls || [])
      setCallsLoaded(true)
    } finally {
      setLoadingCalls(false)
    }
  }, [contact.id, callsLoaded])

  return (
    <>
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
                <a href={`/dialer?contactId=${contact.id}`}
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
        {/* Left Sidebar — hidden on mobile, visible on lg+ */}
        <div className={cn(
          "flex-shrink-0 border-r border-gray-100 overflow-y-auto p-4 space-y-4 bg-white",
          "w-full lg:w-72",
          showMobileSidebar ? "block absolute inset-0 z-30 lg:relative lg:block" : "hidden lg:block"
        )}>
          {/* Mobile close button */}
          {showMobileSidebar && (
            <button onClick={() => setShowMobileSidebar(false)}
              className="lg:hidden flex items-center gap-2 text-sm text-gray-500 mb-3 hover:text-gray-800">
              <X className="w-4 h-4" /> Close
            </button>
          )}
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
                        let returnUrl: string | null = null
                        try { returnUrl = sessionStorage.getItem("contactsReturnUrl") } catch {}
                        router.push(returnUrl || "/contacts")
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
                {contactTags.slice(0, 1).map((ct: any) => (
                  <span key={ct.tagId} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                    {ct.tag.name}
                  </span>
                ))}
                {contact.leadReferrals?.[0] && !["RETURNED"].includes(contact.leadReferrals[0].status) && (
                  <a
                    href="/referrals"
                    title={`Referral status: ${contact.leadReferrals[0].status.replace(/_/g, " ")} — click to manage`}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium border transition-colors hover:opacity-80",
                      ["CLOSED", "LOST"].includes(contact.leadReferrals[0].status)
                        ? "bg-gray-100 text-gray-500 border-gray-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    🤝 Assigned to {contact.leadReferrals[0].partner?.name}
                  </a>
                )}
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
            <a href={`/dialer?contactId=${contact.id}`}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
                contact.phone ? "bg-green-500 hover:bg-green-600" : "bg-gray-200 cursor-not-allowed text-gray-400")}>
              <Phone className="w-4 h-4" />
            </a>
            <SmsButton contactId={contact.id} phone={contact.phone} name={`${contact.firstName} ${contact.lastName || ""}`.trim()} />
            <button
              onClick={() => contact.email && setEmailOpen(true)}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
                contact.email ? "bg-purple-500 hover:bg-purple-600" : "bg-gray-200 cursor-not-allowed text-gray-400")}>
              <Mail className="w-4 h-4" />
            </button>
            <SofiaCallButton contactId={contact.id} phone={contact.phone} name={`${contact.firstName} ${contact.lastName || ""}`.trim()} />
          </div>

          <div className="flex items-center gap-2">
            <ShareWithLenderButton contactId={contact.id} />
            <ReferButton contactId={contact.id} contactName={`${contact.firstName} ${contact.lastName || ""}`.trim()} />
          </div>
          <SendPortalInviteButton contactId={contact.id} email={contact.email} firstName={contact.firstName} />

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
                <a href={`/dialer?contactId=${contact.id}`} className="text-gray-700 hover:text-lofty-600">{formatPhone(contact.phone)}</a>
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
          <div className="relative">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {contactTags.map((ct: any) => (
                <span key={ct.tagId}
                  onClick={() => toggleTag(ct.tag)}
                  className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}
                  title="Click para quitar">
                  {ct.tag.name} ×
                </span>
              ))}
              <button
                onClick={openTagPicker}
                className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-lofty-400 hover:text-lofty-600 transition-colors flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Tag
              </button>
            </div>

            {showTagPicker && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-gray-200 w-56 p-3 space-y-2"
                onMouseLeave={() => setShowTagPicker(false)}>
                <p className="text-xs font-semibold text-gray-500">Seleccionar tag</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allTags.map(tag => {
                    const active = contactTags.some((ct: any) => ct.tagId === tag.id)
                    return (
                      <button key={tag.id} onClick={() => toggleTag(tag)}
                        className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          active ? "bg-gray-100" : "hover:bg-gray-50")}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-left text-gray-800">{tag.name}</span>
                        {active && <span className="text-gray-400">✓</span>}
                      </button>
                    )
                  })}
                  {allTags.length === 0 && <p className="text-xs text-gray-400 px-2">No hay tags aún</p>}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex gap-1">
                    <input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && createAndAddTag()}
                      placeholder="Nuevo tag..."
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lofty-400"
                    />
                    <button onClick={createAndAddTag} disabled={savingTag || !newTagName.trim()}
                      className="text-xs bg-lofty-600 text-white px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-lofty-700">
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buyer Preferences — always visible, inline editable */}
          <BuyerPrefsPanel contact={contact} />

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
            <div className="flex items-center gap-0 px-2 overflow-x-auto">
              <button onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden flex-shrink-0 flex items-center gap-1 px-2 py-3 text-gray-500 hover:text-gray-800 border-b-2 border-transparent">
                <Menu className="w-4 h-4" />
              </button>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabId); if (tab.id === "calls") loadCalls() }}
                  className={cn("px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Activity timeline */}
                <div className={cn("space-y-3", (activityFilter === "Tasks" || activityFilter === "Appointments") ? "col-span-1 lg:col-span-3" : "col-span-1 lg:col-span-2")}>
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
                    {["All", "Notes", "Calls", "Emails", "Texts", "Tasks", "Appointments", "Portal",
                      ...(contact.leadReferrals?.length ? ["Referral"] : [])].map(f => (
                      <button key={f} onClick={() => setActivityFilter(f)} className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-colors",
                        activityFilter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50",
                        f === "Referral" && activityFilter !== f && "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100",
                      )}>
                        {f === "Referral" ? "🤝 Referral" : f}
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
                    {(activityFilter === "All" || activityFilter === "Emails") && contact.emails.map((email: any) => {
                      const isInbound = email.direction === "INBOUND"
                      return (
                        <div key={email.id} className={cn("rounded-xl border shadow-sm p-4", isInbound ? "bg-green-50 border-green-200" : "bg-white border-gray-100")}>
                          <div className="flex items-start gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm", isInbound ? "bg-green-200" : "bg-blue-100")}>
                              {isInbound ? "📩" : "✉️"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <button onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)} className={cn("text-sm font-medium hover:underline text-left", isInbound ? "text-green-700" : "text-blue-700")}>
                                  {email.subject}
                                </button>
                                <Badge className={cn("text-xs flex-shrink-0", isInbound ? "bg-green-100 text-green-700" : email.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500")}>
                                  {isInbound ? "Respuesta" : email.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-400">{isInbound ? `De: ${email.fromAddress} · ` : ""}{formatRelativeTime(email.createdAt)}</p>
                              {expandedEmail === email.id && email.body && (
                                <div className="mt-3 p-3 bg-white rounded-lg text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap">{email.body.replace(/<[^>]*>/g, "")}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

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

                    {notes.length === 0 && contact.activities.length === 0 && contact.emails.length === 0 && smsMessages.length === 0 && !contact.dialerCalls?.length && activityFilter !== "Portal" && activityFilter !== "Tasks" && activityFilter !== "Appointments" && activityFilter !== "Referral" && (
                      <div className="text-center py-12">
                        <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">No activity yet — add a note or log a call</p>
                      </div>
                    )}

                    {/* Referral: everything the partner realtor has logged on this lead */}
                    {activityFilter === "Referral" && contact.leadReferrals?.map((ref: any) => {
                      const STATUS_LABELS: Record<string, string> = {
                        SENT: "Sent", CONTACTED: "Contacted", SHOWING: "Showing",
                        UNDER_CONTRACT: "Under contract", CLOSED: "Closed", LOST: "Lost", RETURNED: "Returned",
                      }
                      return (
                        <div key={ref.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                🤝 Shared with {ref.partner?.name}
                                {ref.partner?.brokerage && <span className="text-xs font-normal text-gray-400">· {ref.partner.brokerage}</span>}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {[ref.partner?.phone, ref.partner?.email].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                              {STATUS_LABELS[ref.status] || ref.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Shared {formatRelativeTime(ref.sentAt)} · {ref.updates?.length || 0} update{(ref.updates?.length || 0) !== 1 ? "s" : ""} from the partner
                          </p>
                          <div className="space-y-2 border-t border-gray-100 pt-3">
                            {(!ref.updates || ref.updates.length === 0) && (
                              <p className="text-xs text-gray-400 italic py-1">The partner hasn't logged anything yet.</p>
                            )}
                            {ref.updates?.map((u: any) => (
                              <div key={u.id} className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 text-sm">
                                  {u.kind === "CALL" ? "📞" : u.kind === "STATUS" ? "🔄" : "📝"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{u.body}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {u.author === "AGENT" ? "You" : ref.partner?.name} · {new Date(u.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <a href="/referrals" className="inline-block text-xs text-lofty-600 hover:underline">Manage in Lead Referrals →</a>
                        </div>
                      )
                    })}

                    {/* Portal chat thread */}
                    {activityFilter === "Portal" && (
                      <PortalChatPanel contactId={contact.id} />
                    )}

                    {/* Tasks panel */}
                    {activityFilter === "Tasks" && (
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-blue-500" /> Tareas
                        </h2>
                        <div className="space-y-2">
                          {tasks.length === 0 && <p className="text-xs text-gray-400 py-2">Sin tareas. Agrega la primera.</p>}
                          {tasks.map((task: any) => (
                            <div key={task.id} className="flex items-center gap-3 group p-2 rounded-xl hover:bg-gray-50">
                              <button onClick={() => toggleTask(task.id, task.status)} className="flex-shrink-0">
                                {task.status === "COMPLETED"
                                  ? <CheckSquare className="w-5 h-5 text-green-500" />
                                  : <div className="w-5 h-5 rounded border-2 border-gray-300 hover:border-blue-400 transition-colors" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm", task.status === "COMPLETED" && "line-through text-gray-400")}>{task.title}</p>
                                {task.dueDate && (
                                  <p className={cn("text-xs", new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "text-orange-500" : "text-gray-400")}>
                                    {new Date(task.dueDate).toLocaleDateString("es-US", { month: "short", day: "numeric" })}
                                  </p>
                                )}
                              </div>
                              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", {
                                "bg-red-500": task.priority === "URGENT",
                                "bg-orange-500": task.priority === "HIGH",
                                "bg-blue-400": task.priority === "MEDIUM",
                                "bg-gray-300": task.priority === "LOW",
                              })} />
                              <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-gray-50 space-y-2">
                          <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask() }} placeholder="Nueva tarea..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          <div className="flex gap-2">
                            <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                              <option value="LOW">Baja</option>
                              <option value="MEDIUM">Media</option>
                              <option value="HIGH">Alta</option>
                              <option value="URGENT">Urgente</option>
                            </select>
                            <Button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} size="sm" className="bg-blue-600 hover:bg-blue-700 shrink-0">
                              {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Appointments panel */}
                    {activityFilter === "Appointments" && (
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-pink-500" /> Citas
                        </h2>
                        <div className="space-y-2">
                          {appointments.length === 0 && <p className="text-xs text-gray-400 py-2">Sin citas agendadas.</p>}
                          {appointments.map((apt: any) => (
                            <div key={apt.id} className="flex items-center gap-3 group p-2 rounded-xl hover:bg-gray-50">
                              <Calendar className="w-4 h-4 text-pink-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{apt.title}</p>
                                <p className="text-xs text-gray-400">{new Date(apt.startTime).toLocaleString("es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-gray-50 space-y-2">
                          <input value={newAptTitle} onChange={e => setNewAptTitle(e.target.value)} placeholder="Título de la cita..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Inicio</label>
                              <input type="datetime-local" value={newAptStart} onChange={e => setNewAptStart(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Fin</label>
                              <input type="datetime-local" value={newAptEnd} onChange={e => setNewAptEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                          </div>
                          <Button onClick={addAppointment} disabled={addingApt || !newAptTitle.trim() || !newAptStart || !newAptEnd} size="sm" className="w-full bg-pink-600 hover:bg-pink-700">
                            {addingApt ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                            Agendar cita
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Tasks + Appointments (hidden when those filter tabs are active) */}
                {(activityFilter === "Tasks" || activityFilter === "Appointments") ? null :
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
                      <button onClick={() => setActivityFilter("Tasks")} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      {tasks.map((task: any) => (
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
                      {tasks.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">No tasks</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Appointments</h3>
                      <button onClick={() => setActivityFilter("Appointments")} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
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
                </div>}
              </div>
            )}

            {/* Properties Tab */}
            {activeTab === "properties" && (
              <div className="space-y-3">
                {/* Agent: search live MLS and send directly to client */}
                <PropertySendPanel
                  contactId={contact.id}
                  contactEmail={contact.email || null}
                  contactPhone={contact.phone || null}
                  defaultLocation={contact.buyerLocation || ""}
                  defaultMaxPrice={contact.buyerBudgetMax || undefined}
                  defaultMinBeds={contact.buyerBedroomsMin || undefined}
                  defaultPropertyType={contact.buyerPropertyType || null}
                />

                <PreconstructionSendPanel
                  contactId={contact.id}
                  contactEmail={contact.email || null}
                  contactPhone={contact.phone || null}
                />

                {/* IDX Saved properties (from /homes favorites) */}
                {contact.propertySaves?.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Guardadas desde el sitio web</p>
                    {contact.propertySaves.map((save: any) => {
                      const imgs = save.property.images ? (() => { try { return JSON.parse(save.property.images) } catch { return [] } })() : []
                      const thumb = imgs.find((u: any) => u) || null
                      return (
                        <div key={save.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                          <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {thumb ? (
                              <img src={thumb} alt={save.property.address} className="w-full h-full object-cover" />
                            ) : (
                              <Home className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{save.property.address}</p>
                            <p className="text-sm text-gray-500">{save.property.city}, {save.property.state}{save.property.price ? ` · ${formatCurrency(save.property.price)}` : ""}</p>
                          </div>
                          <Badge className="bg-red-50 text-red-600 border-0 flex-shrink-0">♥ Guardada</Badge>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* CRM property interests */}
                {contact.propertyInterests?.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mt-4">Propiedades del CRM</p>
                    {contact.propertyInterests.map((interest: any) => (
                      <div key={interest.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center">
                          <Home className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{interest.property.address}</p>
                          <p className="text-sm text-gray-500">{interest.property.city}, {interest.property.state}{interest.property.price ? ` · ${formatCurrency(interest.property.price)}` : ""}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 border-0">{interest.type}</Badge>
                      </div>
                    ))}
                  </>
                )}

                {/* Properties Sofia sent via match-alert emails */}
                {alertsSent.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mt-4">Enviadas por Sofía</p>
                    {alertsSent.map((alert: any) => {
                      const p = alert.property
                      const imgs = p.images ? (() => { try { return JSON.parse(p.images) } catch { return [] } })() : []
                      const thumb = imgs.find((u: any) => u) || null
                      const href = p.mlsId
                        ? `/homes/${p.mlsId}`
                        : `/site/listing/${p.id}`
                      return (
                        <div key={alert.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                          <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {thumb ? (
                              <img src={thumb} alt={p.address} className="w-full h-full object-cover" />
                            ) : (
                              <Home className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{p.address}</p>
                            <p className="text-sm text-gray-500">
                              {p.city}, {p.state}
                              {p.price ? ` · ${formatCurrency(p.price)}` : ""}
                              {p.bedrooms ? ` · ${p.bedrooms}bd` : ""}
                              {p.bathrooms ? `/${p.bathrooms}ba` : ""}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">Enviada {formatRelativeTime(alert.sentAt)}</p>
                          </div>
                          <Link
                            href={href}
                            target="_blank"
                            className="flex-shrink-0 text-xs font-semibold text-lofty-600 hover:text-lofty-800 underline underline-offset-2"
                          >
                            Ver →
                          </Link>
                        </div>
                      )
                    })}
                  </>
                )}

                {(!contact.propertySaves?.length && !contact.propertyInterests?.length && !alertsSent.length) && (
                  <div className="text-center py-12">
                    <Home className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No properties associated with this contact</p>
                  </div>
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
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowNewTx(true)} className="bg-lofty-600 hover:bg-lofty-700 gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Nueva Transacción
                  </Button>
                </div>

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

                {/* New Transaction inline modal */}
                {showNewTx && (
                  <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm">Nueva Transacción</h3>
                      <button onClick={() => setShowNewTx(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <input value={newTxForm.title} onChange={e => setNewTxForm(f => ({ ...f, title: e.target.value }))} placeholder="Título *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newTxForm.type} onChange={e => setNewTxForm(f => ({ ...f, type: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        {["BUYER","SELLER","DUAL","LEASE","REFERRAL"].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={newTxForm.listPrice} onChange={e => setNewTxForm(f => ({ ...f, listPrice: e.target.value }))} type="number" placeholder="Precio lista" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <input value={newTxForm.address} onChange={e => setNewTxForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={newTxForm.city} onChange={e => setNewTxForm(f => ({ ...f, city: e.target.value }))} placeholder="Ciudad *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newTxForm.state} onChange={e => setNewTxForm(f => ({ ...f, state: e.target.value }))} placeholder="Estado" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newTxForm.zip} onChange={e => setNewTxForm(f => ({ ...f, zip: e.target.value }))} placeholder="ZIP *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <Button onClick={createTransactionForContact} disabled={savingTx || !newTxForm.title.trim() || !newTxForm.address.trim() || !newTxForm.city.trim() || !newTxForm.zip.trim()} size="sm" className="w-full bg-lofty-600 hover:bg-lofty-700">
                      {savingTx ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                      Crear y abrir transacción
                    </Button>
                  </div>
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

            {/* Calls Tab */}
            {activeTab === "calls" && (
              <div className="space-y-3">
                {loadingCalls ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                ) : calls.length === 0 ? (
                  <div className="text-center py-12">
                    <PhoneCall className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No hay llamadas registradas para este contacto</p>
                  </div>
                ) : (
                  calls.map((call: any) => {
                    const isExpanded = expandedCallId === call.id
                    const dur = call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, "0")}` : null
                    const disposition = call.disposition || call.status
                    const isVoicemail = disposition?.toLowerCase().includes("voicemail") || disposition === "voicemail"
                    const isConnected = ["answered", "connected", "REACHED", "customerLiveAnswer"].some(v => disposition?.includes(v))
                    const Icon = isVoicemail ? MicOff : isConnected ? PhoneCall : PhoneOff
                    const iconColor = isVoicemail ? "text-amber-500" : isConnected ? "text-green-500" : "text-gray-400"
                    const proxyUrl = call.recordingUrl ? `/api/dialer/recording-proxy?url=${encodeURIComponent(call.recordingUrl)}` : null

                    return (
                      <div key={call.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <button
                          onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className={cn("w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0", iconColor.replace("text-", "text-"))}>
                            <Icon className={cn("w-4 h-4", iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {isVoicemail ? "Buzón de voz" : isConnected ? "Llamada contestada" : "Sin respuesta"}
                              </span>
                              {dur && <span className="text-xs text-gray-400">{dur} min</span>}
                              {call.recordingUrl && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                                  <Play className="w-2.5 h-2.5" /> Grabación
                                </span>
                              )}
                              {call.aiSummary && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5">
                                  ✦ Resumen IA
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Sofía · {new Date(call.createdAt).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-gray-400 flex-shrink-0 transition-transform", isExpanded && "rotate-180")} />
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                            {/* Audio player */}
                            {proxyUrl && (
                              <div className="mt-3">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Grabación</p>
                                <audio controls className="w-full h-10" src={proxyUrl}>
                                  Tu navegador no soporta audio.
                                </audio>
                              </div>
                            )}

                            {/* AI Summary */}
                            {call.aiSummary && (
                              <div className="bg-indigo-50 rounded-xl p-3">
                                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1">Resumen IA</p>
                                <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{call.aiSummary}</p>
                              </div>
                            )}

                            {/* Transcription */}
                            {call.transcription && (
                              <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Transcripción</p>
                                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{call.transcription}</p>
                              </div>
                            )}

                            {/* Notes */}
                            {call.notes && (
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                                <p className="text-sm text-gray-700">{call.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Automations Tab */}
            {activeTab === "automations" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Smart Plans</p>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openPlanPicker}>
                    <Plus className="w-3.5 h-3.5" /> Enroll in Plan
                  </Button>
                </div>

                {enrollments.length === 0 ? (
                  <div className="text-center py-10">
                    <Zap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Not enrolled in any smart plans</p>
                  </div>
                ) : (
                  enrollments.map((enr: any) => (
                    <div key={enr.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
                          enr.status === "ACTIVE" ? "bg-green-100" : "bg-gray-100")}>
                          <Zap className={cn("w-4 h-4", enr.status === "ACTIVE" ? "text-green-600" : "text-gray-400")} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{enr.plan?.name}</p>
                          <p className="text-xs text-gray-400">Step {enr.currentStep} · {enr.status}</p>
                        </div>
                        <Badge className={cn("text-xs", enr.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                          {enr.status === "ACTIVE" ? "Running" : enr.status}
                        </Badge>
                        <button
                          onClick={() => unenrollFromPlan(enr.planId, enr.plan?.name)}
                          className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                          title="Remove from plan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Plan picker dropdown */}
                {showPlanPicker && (
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setShowPlanPicker(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">Choose a Smart Plan</p>
                        <button onClick={() => setShowPlanPicker(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
                      </div>
                      {allPlans.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No plans available. <Link href="/smart-plans" className="text-blue-600 underline">Create one</Link></p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {allPlans.map((plan: any) => {
                            const alreadyEnrolled = enrollments.some((e: any) => e.planId === plan.id && e.status === "ACTIVE")
                            return (
                              <button
                                key={plan.id}
                                disabled={alreadyEnrolled || enrolling}
                                onClick={() => enrollInPlan(plan)}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl border transition-colors",
                                  alreadyEnrolled
                                    ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                                )}
                              >
                                <p className="font-medium text-sm text-gray-900">{plan.name}</p>
                                {plan.description && <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>}
                                <p className="text-xs text-gray-300 mt-1">{plan.steps?.length ?? 0} steps</p>
                                {alreadyEnrolled && <p className="text-xs text-green-600 mt-0.5">Already enrolled</p>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Email compose modal */}
    {emailOpen && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setEmailOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Nuevo email</p>
              <p className="text-sm text-gray-400">{contact.email}</p>
            </div>
            <button onClick={() => setEmailOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
          </div>
          <input
            autoFocus
            type="text"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            placeholder="Asunto"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <textarea
            rows={6}
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            placeholder={`Escribe tu mensaje para ${contact.firstName}...`}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
          />

          {/* Media toolbar */}
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-xs cursor-pointer text-purple-600 hover:text-purple-800">
              <input type="file" accept="image/*,video/*" className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const form = new FormData(); form.append("file", file)
                    const res = await fetch("/api/upload", { method: "POST", body: form })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    const isVideo = file.type.startsWith("video/")
                    const tag = isVideo
                      ? `\n<p>📹 <a href="${data.url}" style="color:#4F46E5">Ver video</a></p>`
                      : `\n<img src="${data.url}" style="max-width:100%;border-radius:8px;margin:8px 0"/>`
                    setEmailBody(b => b + tag)
                    toast({ title: "✅ Archivo subido e insertado" })
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" })
                  }
                }} />
              📎 Subir imagen/video
            </label>
            <button type="button" onClick={() => { setShowEmailImage(v => !v); setShowEmailLink(false) }}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
              🖼️ URL de imagen
            </button>
            <button type="button" onClick={() => { setShowEmailLink(v => !v); setShowEmailImage(false) }}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
              🔗 Agregar enlace
            </button>
          </div>

          {showEmailImage && (
            <div className="flex gap-2">
              <input type="url" value={emailMediaUrl} onChange={e => setEmailMediaUrl(e.target.value)}
                placeholder="URL de imagen o video (https://...)"
                className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <button type="button"
                onClick={() => {
                  if (!emailMediaUrl.trim()) return
                  const isVideo = /\.(mp4|mov|webm)/i.test(emailMediaUrl)
                  const tag = isVideo
                    ? `\n<p>📹 <a href="${emailMediaUrl}" style="color:#4F46E5">Ver video</a></p>`
                    : `\n<img src="${emailMediaUrl}" style="max-width:100%;border-radius:8px;margin:8px 0"/>`
                  setEmailBody(b => b + tag)
                  setEmailMediaUrl("")
                  setShowEmailImage(false)
                }}
                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
                Insertar
              </button>
            </div>
          )}

          {showEmailLink && (
            <div className="space-y-2">
              <input type="text" value={emailLinkText} onChange={e => setEmailLinkText(e.target.value)}
                placeholder="Texto del enlace (ej. Ver propiedad)"
                className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <div className="flex gap-2">
                <input type="url" value={emailLinkUrl} onChange={e => setEmailLinkUrl(e.target.value)}
                  placeholder="URL (https://...)"
                  className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                <button type="button"
                  onClick={() => {
                    if (!emailLinkUrl.trim()) return
                    const text = emailLinkText.trim() || emailLinkUrl
                    setEmailBody(b => b + `\n<a href="${emailLinkUrl}" style="color:#4F46E5;font-weight:bold">${text}</a>`)
                    setEmailLinkUrl("")
                    setEmailLinkText("")
                    setShowEmailLink(false)
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
                  Insertar
                </button>
              </div>
            </div>
          )}

          <AiAssistBar contactId={contact.id} draft={emailBody} onApply={setEmailBody} />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEmailOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
              onClick={async () => {
                setSendingEmail(true)
                try {
                  const res = await fetch("/api/emails/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contactId: contact.id, to: contact.email, subject: emailSubject, body: emailBody }),
                  })
                  const data = await res.json()
                  if (res.ok) {
                    toast({ title: "✅ Email enviado", description: `Enviado a ${contact.email}` })
                    setEmailOpen(false)
                    setEmailSubject("")
                    setEmailBody("")
                  } else {
                    toast({ title: "Error", description: data.error || "No se pudo enviar el email", variant: "destructive" })
                  }
                } catch {
                  toast({ title: "Error", description: "No se pudo conectar", variant: "destructive" })
                } finally {
                  setSendingEmail(false)
                }
              }}
              className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Send className="w-4 h-4" />
              {sendingEmail ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function SmsButton({ contactId, phone, name }: { contactId: string; phone?: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  if (!phone) return null

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMediaUrl(data.url)
      toast({ title: "✅ Archivo subido", description: "Listo para enviar" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo subir el archivo", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    try {
      const mediaUrls = mediaUrl.trim() ? [mediaUrl.trim()] : undefined
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, message, mediaUrls }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "✅ Mensaje enviado", description: `SMS${mediaUrls ? " MMS" : ""} enviado a ${name}` })
        setMessage(""); setMediaUrl(""); setShowLink(false); setLinkUrl(""); setOpen(false)
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
      <button onClick={() => setOpen(true)} title="Enviar SMS"
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600">
        <MessageSquare className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Enviar SMS / MMS</p>
                <p className="text-sm text-gray-400">{phone}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            <textarea autoFocus rows={4} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={`Escribe tu mensaje para ${name}...`}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />

            {/* Toolbar */}
            <div className="flex gap-3 flex-wrap">
              <label className={cn("flex items-center gap-1 text-xs cursor-pointer", uploading ? "text-gray-400" : "text-blue-500 hover:text-blue-700")}>
                <input type="file" accept="image/*,video/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                {uploading ? "⏳ Subiendo..." : "📎 Subir imagen/video"}
              </label>
              <button type="button" onClick={() => setShowLink(v => !v)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                🔗 Insertar enlace
              </button>
            </div>

            {mediaUrl && (
              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
                📎 <span className="truncate flex-1">{mediaUrl}</span>
                <button onClick={() => setMediaUrl("")} className="text-gray-400 hover:text-red-500 flex-shrink-0">×</button>
              </div>
            )}

            {showLink && (
              <div className="flex gap-2">
                <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                  placeholder="Pega el enlace (https://...)"
                  className="flex-1 border border-blue-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button type="button"
                  onClick={() => { if (linkUrl.trim()) { setMessage(m => (m ? m + "\n" : "") + linkUrl.trim()); setLinkUrl(""); setShowLink(false) } }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-600">
                  Insertar
                </button>
              </div>
            )}

            <AiAssistBar contactId={contactId} draft={message} onApply={setMessage} />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{message.length} chars · {mediaUrl ? "MMS" : "SMS"}</p>
              <button onClick={handleSend} disabled={sending || !message.trim()}
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

function ShareWithLenderButton({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false)
  const [partners, setPartners] = useState<{ id: string; name: string; company: string | null; pricePerLead: number; isActive: boolean }[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [sharing, setSharing] = useState<string | null>(null)
  const { toast } = useToast()

  async function openModal() {
    setOpen(true)
    setLoadingPartners(true)
    try {
      const res = await fetch("/api/partners")
      const data = await res.json()
      setPartners((data.partners || []).filter((p: any) => p.isActive))
    } finally {
      setLoadingPartners(false)
    }
  }

  async function share(loanOfficerId: string) {
    setSharing(loanOfficerId)
    try {
      const res = await fetch("/api/partners/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, loanOfficerId }),
      })
      const data = await res.json()
      if (data.share) {
        toast({ title: "✅ Lead compartido", description: "El loan officer recibió una notificación por email" })
        setOpen(false)
      } else {
        toast({ title: "Error", description: data.error || "No se pudo compartir", variant: "destructive" })
      }
    } finally {
      setSharing(null)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors">
        <Building className="w-3.5 h-3.5" />
        Compartir con Loan Officer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Compartir lead</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>
            {loadingPartners ? (
              <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
            ) : partners.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No tienes loan officers activos. Agrégalos en la página <strong>Loan Officers</strong>.
              </p>
            ) : (
              <div className="space-y-2">
                {partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => share(p.id)}
                    disabled={!!sharing}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 text-left transition-all">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      {p.company && <p className="text-xs text-gray-400">{p.company}</p>}
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">
                      {sharing === p.id ? "Compartiendo..." : `$${p.pricePerLead}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function SendPortalInviteButton({ contactId, email, firstName }: { contactId: string; email?: string | null; firstName: string }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  if (!email) return null

  async function handleInvite() {
    setSending(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}/portal-invite`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setSent(true)
        toast({ title: "✅ Invitación enviada", description: `Link del portal enviado a ${email}` })
        setTimeout(() => setSent(false), 5000)
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
    <button
      onClick={handleInvite}
      disabled={sending}
      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 text-xs font-medium transition-colors">
      <Globe className="w-3.5 h-3.5" />
      {sending ? "Enviando..." : sent ? "✓ Invitación enviada" : "Invitar al Portal del Cliente"}
    </button>
  )
}

function PortalChatPanel({ contactId }: { contactId: string }) {
  const [messages, setMessages] = useState<{ id: string; fromClient: boolean; content: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  // Load messages on mount
  useState(() => {
    fetch(`/api/portal/admin/${contactId}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  })

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/portal/admin/${contactId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setReply("")
      } else {
        toast({ title: "Error", description: "No se pudo enviar el mensaje", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo conectar", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-400 py-4 text-center">Cargando mensajes del portal...</p>
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">Sin mensajes en el portal todavía.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {messages.map(m => (
            <div key={m.id} className={cn("flex", m.fromClient ? "justify-start" : "justify-end")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                m.fromClient
                  ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                  : "bg-blue-600 text-white rounded-tr-sm"
              )}>
                <p>{m.content}</p>
                <p className={cn("text-[10px] mt-0.5", m.fromClient ? "text-gray-400" : "text-blue-200")}>
                  {new Date(m.createdAt).toLocaleString("es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <Textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply() } }}
          placeholder="Escribe una respuesta al cliente..."
          className="flex-1 min-h-[60px] text-sm resize-none rounded-xl border-gray-200"
        />
        <button
          onClick={sendReply}
          disabled={sending || !reply.trim()}
          className="self-end px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
