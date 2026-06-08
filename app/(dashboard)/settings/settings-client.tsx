"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  User, Bell, Shield, Tag, GitBranch, Globe, Save, Loader2,
  Plus, Trash2, Edit, Database, CheckCircle, ExternalLink,
  X, Key, MessageSquare, Mail, Calendar, FileSignature, Home,
  Check, Clock, Copy, Link,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils"

const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
})

interface SettingsClientProps {
  user: any
  tags: any[]
  pipelines: any[]
}

// ─── Integration connect modal ────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    id: "twilio", name: "Twilio", desc: "SMS & voice calls", icon: MessageSquare, color: "bg-red-500",
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxx" },
      { key: "authToken", label: "Auth Token", placeholder: "Your Twilio auth token", type: "password" },
      { key: "phoneNumber", label: "Twilio Phone Number", placeholder: "+13055550100" },
    ],
  },
  {
    id: "sendgrid", name: "SendGrid", desc: "Email delivery service", icon: Mail, color: "bg-blue-500",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "SG.xxxxxxxxxxxxxxxx", type: "password" },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com" },
      { key: "fromName", label: "From Name", placeholder: "Your Name" },
    ],
  },
  {
    id: "google_calendar", name: "Google Calendar", desc: "Sync appointments", icon: Calendar, color: "bg-green-500",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "Google OAuth Client ID" },
      { key: "clientSecret", label: "Client Secret", placeholder: "Google OAuth Client Secret", type: "password" },
      { key: "calendarId", label: "Calendar ID", placeholder: "primary" },
    ],
  },
  {
    id: "zillow", name: "Zillow", desc: "Import Zillow leads", icon: Home, color: "bg-blue-400",
    fields: [
      { key: "apiKey", label: "Zillow API Key", placeholder: "Your Zillow API key", type: "password" },
      { key: "techConnectKey", label: "Tech Connect Key", placeholder: "Zillow Tech Connect key" },
    ],
  },
  {
    id: "realtor", name: "Realtor.com", desc: "Sync Realtor.com leads", icon: Home, color: "bg-red-600",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Realtor.com API key", type: "password" },
      { key: "leadEmail", label: "Lead Email Address", placeholder: "leads@yourdomain.com" },
    ],
  },
  {
    id: "docusign", name: "DocuSign", desc: "Electronic signatures", icon: FileSignature, color: "bg-yellow-500",
    fields: [
      { key: "integrationKey", label: "Integration Key", placeholder: "DocuSign Integration Key" },
      { key: "userId", label: "DocuSign User ID", placeholder: "Your DocuSign user ID" },
      { key: "accountId", label: "Account ID", placeholder: "Your DocuSign account ID" },
    ],
  },
]

function IntegrationModal({ integration, onClose }: { integration: typeof INTEGRATIONS[0]; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()
  const Icon = integration.icon

  async function handleSave() {
    setSaving(true)
    try {
      await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: integration.id, config: values }),
      })
      setSaved(true)
      toast({ title: `${integration.name} connected successfully` })
      setTimeout(onClose, 1200)
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", integration.color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Connect {integration.name}</h2>
              <p className="text-xs text-gray-500">{integration.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {integration.fields.map(field => (
            <div key={field.key}>
              <Label className="mb-1.5 block">{field.label}</Label>
              <Input
                type={field.type || "text"}
                placeholder={field.placeholder}
                value={values[field.key] || ""}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={handleSave} disabled={saving || saved} className="flex-1 bg-lofty-600 hover:bg-lofty-700 gap-2">
            {saved ? <><Check className="w-4 h-4" /> Connected</> : saving ? "Saving..." : <><Key className="w-4 h-4" /> Save Credentials</>}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Availability Settings component ─────────────────────────────────────────
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

function AvailabilitySettings() {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState([
    { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isAvailable: false, slotMinutes: 30 },
    { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
    { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
    { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
    { dayOfWeek: 6, startTime: "10:00", endTime: "14:00", isAvailable: false, slotMinutes: 30 },
  ])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useState(() => {
    fetch("/api/appointments/availability")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length === 7) setSchedule(data) })
      .catch(() => {})
  })

  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book"

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateDay = (idx: number, field: string, value: any) => {
    setSchedule(s => s.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/appointments/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "✅ Disponibilidad guardada" })
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />Disponibilidad para Citas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Booking link */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-indigo-900 mb-1">Tu enlace de reserva</p>
          <p className="text-xs text-indigo-600 mb-3">Comparte este enlace con clientes para que agenden citas contigo directamente.</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-700 font-mono truncate">
              {bookingUrl}
            </div>
            <Button size="sm" onClick={copyLink} variant="outline" className="border-indigo-300 text-indigo-700 gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <Button size="sm" asChild className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              <a href="/book" target="_blank"><Link className="w-3.5 h-3.5" />Abrir</a>
            </Button>
          </div>
        </div>

        {/* Slot duration */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">Duración de citas</label>
          <div className="flex gap-2">
            {[15, 30, 45, 60].map(min => (
              <button
                key={min}
                onClick={() => setSchedule(s => s.map(d => ({ ...d, slotMinutes: min })))}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  schedule[1]?.slotMinutes === min
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-200 text-gray-700 hover:border-indigo-300"
                }`}
              >
                {min} min
              </button>
            ))}
          </div>
        </div>

        {/* Weekly schedule */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-3 block">Horario semanal</label>
          <div className="space-y-2">
            {schedule.map((day, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                <Switch
                  checked={day.isAvailable}
                  onCheckedChange={v => updateDay(idx, "isAvailable", v)}
                />
                <span className="w-24 text-sm font-medium text-gray-700">{DAY_NAMES[day.dayOfWeek]}</span>
                {day.isAvailable ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={e => updateDay(idx, "startTime", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-gray-400 text-sm">—</span>
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={e => updateDay(idx, "endTime", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 flex-1">No disponible</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar Disponibilidad</>}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsClient({ user, tags: initialTags, pipelines: initialPipelines }: SettingsClientProps) {
  const { toast } = useToast()

  // Tags
  const [tags, setTags] = useState(initialTags)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3B82F6")

  // Pipelines
  const [pipelines, setPipelines] = useState(initialPipelines)
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editStageName, setEditStageName] = useState("")
  const [editStageColor, setEditStageColor] = useState("")
  const [newStageName, setNewStageName] = useState<Record<string, string>>({})
  const [newStageColor, setNewStageColor] = useState<Record<string, string>>({})
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newPipelineName, setNewPipelineName] = useState("")
  const [addingPipeline, setAddingPipeline] = useState(false)

  // Integrations
  const [activeIntegration, setActiveIntegration] = useState<typeof INTEGRATIONS[0] | null>(null)
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set())

  // IDX
  const [idxConfig, setIdxConfig] = useState({
    provider: "miami_mls", serverUrl: "", username: "", password: "",
    loginUrl: "https://rets.miami-mls.com/rets/login", mlsId: "",
    autoImport: false, autoAssignSearch: true,
  })
  const [idxSaving, setIdxSaving] = useState(false)
  const [idxConnected, setIdxConnected] = useState(false)
  const [idxTesting, setIdxTesting] = useState(false)
  const [idxSyncing, setIdxSyncing] = useState(false)
  const [idxSyncResult, setIdxSyncResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)
  const [idxPropertyCount, setIdxPropertyCount] = useState<number | null>(null)

  // Load IDX config + property count on mount
  useState(() => {
    fetch("/api/settings/idx").then(r => r.json()).then(d => {
      if (d) setIdxConfig(prev => ({ ...prev, ...d }))
    }).catch(() => {})
    fetch("/api/mls/sync").then(r => r.json()).then(d => {
      setIdxPropertyCount(d.totalProperties)
    }).catch(() => {})
  })

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "", email: user?.email || "", phone: user?.phone || "",
      title: user?.title || "", bio: user?.bio || "", timezone: user?.timezone || "America/New_York",
    },
  })

  // ── Profile ──────────────────────────────────────────────────────────────────
  const saveProfile = async (data: any) => {
    try {
      await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      toast({ title: "Profile updated" })
    } catch {
      toast({ title: "Error saving profile", variant: "destructive" })
    }
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────
  const addTag = async () => {
    if (!newTagName.trim()) return
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: err.error || "Error creating tag", variant: "destructive" })
        return
      }
      const tag = await res.json()
      setTags(t => [...t, tag])
      setNewTagName("")
      toast({ title: `Tag "${tag.name}" created` })
    } catch {
      toast({ title: "Error creating tag", variant: "destructive" })
    }
  }

  const deleteTag = async (id: string) => {
    try {
      await fetch(`/api/tags/${id}`, { method: "DELETE" })
      setTags(t => t.filter(tag => tag.id !== id))
      toast({ title: "Tag deleted" })
    } catch {
      toast({ title: "Error deleting tag", variant: "destructive" })
    }
  }

  // ── Pipeline stages ───────────────────────────────────────────────────────────
  const addStage = async (pipelineId: string) => {
    const name = newStageName[pipelineId]?.trim()
    const color = newStageColor[pipelineId] || "#3B82F6"
    if (!name) return
    try {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, name, color }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: err.error || "Error adding stage", variant: "destructive" })
        return
      }
      const stage = await res.json()
      setPipelines(ps => ps.map(p => p.id === pipelineId ? { ...p, stages: [...p.stages, stage] } : p))
      setNewStageName(s => ({ ...s, [pipelineId]: "" }))
      setAddingTo(null)
      toast({ title: `Stage "${stage.name}" added` })
    } catch {
      toast({ title: "Error adding stage", variant: "destructive" })
    }
  }

  const saveStage = async (stageId: string, pipelineId: string) => {
    try {
      const res = await fetch(`/api/pipeline/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editStageName, color: editStageColor }),
      })
      const updated = await res.json()
      setPipelines(ps => ps.map(p => p.id === pipelineId
        ? { ...p, stages: p.stages.map((s: any) => s.id === stageId ? updated : s) }
        : p))
      setEditingStage(null)
      toast({ title: "Stage updated" })
    } catch {
      toast({ title: "Error updating stage", variant: "destructive" })
    }
  }

  const deleteStage = async (stageId: string, pipelineId: string) => {
    if (!confirm("Delete this stage? Leads in this stage will be unassigned.")) return
    try {
      await fetch(`/api/pipeline/stages/${stageId}`, { method: "DELETE" })
      setPipelines(ps => ps.map(p => p.id === pipelineId
        ? { ...p, stages: p.stages.filter((s: any) => s.id !== stageId) }
        : p))
      toast({ title: "Stage deleted" })
    } catch {
      toast({ title: "Error deleting stage", variant: "destructive" })
    }
  }

  const createPipeline = async () => {
    const name = newPipelineName.trim()
    if (!name) return
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        toast({ title: "Error creating pipeline", variant: "destructive" })
        return
      }
      const pipeline = await res.json()
      setPipelines(ps => [...ps, pipeline])
      setNewPipelineName("")
      setAddingPipeline(false)
      toast({ title: `Pipeline "${pipeline.name}" created` })
    } catch {
      toast({ title: "Error creating pipeline", variant: "destructive" })
    }
  }

  // ── IDX ───────────────────────────────────────────────────────────────────────
  const saveIdx = async () => {
    setIdxSaving(true)
    try {
      await fetch("/api/settings/idx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idxConfig),
      })
      toast({ title: "IDX settings saved" })
    } catch {
      toast({ title: "Error saving IDX settings", variant: "destructive" })
    } finally {
      setIdxSaving(false)
    }
  }

  const testIdxConnection = async () => {
    setIdxTesting(true)
    setIdxConnected(false)
    try {
      const res = await fetch("/api/mls/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idxConfig),
      })
      const data = await res.json()
      if (data.success) {
        setIdxConnected(true)
        toast({ title: "✅ Conexión exitosa", description: data.message })
      } else {
        toast({ title: "❌ " + data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setIdxTesting(false)
    }
  }

  const syncMLSNow = async () => {
    setIdxSyncing(true)
    setIdxSyncResult(null)
    try {
      // Save config first
      await fetch("/api/settings/idx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idxConfig),
      })
      const res = await fetch("/api/mls/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idxConfig),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIdxSyncResult(data)
      setIdxPropertyCount((data.imported || 0) + (data.updated || 0))
      toast({
        title: `✅ Sincronización completada`,
        description: `${data.imported} nuevas · ${data.updated} actualizadas`,
      })
    } catch (e: any) {
      toast({ title: "Error al sincronizar: " + (e.message || "Unknown"), variant: "destructive" })
    } finally {
      setIdxSyncing(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl animate-fade-in">
      {activeIntegration && (
        <IntegrationModal
          integration={activeIntegration}
          onClose={() => {
            setActiveIntegration(null)
            setConnectedIntegrations(s => { const n = new Set(s); n.add(activeIntegration.id); return n })
          }}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account and CRM preferences</p>
      </div>

      <Tabs defaultValue="profile" orientation="vertical" className="flex gap-6">
        <div className="w-48 flex-shrink-0">
          <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1">
            {[
              { value: "profile", label: "Profile", icon: User },
              { value: "notifications", label: "Notifications", icon: Bell },
              { value: "availability", label: "Availability", icon: Clock },
              { value: "tags", label: "Tags", icon: Tag },
              { value: "pipeline", label: "Pipeline", icon: GitBranch },
              { value: "idx", label: "IDX / MLS", icon: Database },
              { value: "integrations", label: "Integrations", icon: Globe },
              { value: "security", label: "Security", icon: Shield },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}
                className="w-full justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-lofty-50 data-[state=active]:text-lofty-700 rounded-lg">
                <Icon className="w-4 h-4" />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 min-w-0">

          {/* Profile */}
          <TabsContent value="profile">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Profile Information</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xl font-bold">
                      {getInitials(user?.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <Button variant="outline" size="sm">Change Photo</Button>
                </div>
                <form onSubmit={handleSubmit(saveProfile)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Full Name</Label><Input {...register("name")} className="mt-1" /></div>
                    <div><Label>Email</Label><Input {...register("email")} type="email" className="mt-1" /></div>
                    <div><Label>Phone</Label><Input {...register("phone")} className="mt-1" /></div>
                    <div><Label>Title</Label><Input {...register("title")} className="mt-1" placeholder="Real Estate Agent" /></div>
                  </div>
                  <div><Label>Bio</Label><Textarea {...register("bio")} className="mt-1" rows={3} /></div>
                  <div><Label>Timezone</Label><Input {...register("timezone")} className="mt-1" placeholder="America/New_York" /></div>
                  <Button type="submit" disabled={isSubmitting} className="bg-lofty-600 hover:bg-lofty-700">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "New lead notifications", desc: "Get notified when a new lead is created" },
                  { label: "Task reminders", desc: "Receive reminders for upcoming tasks" },
                  { label: "Appointment alerts", desc: "Alerts before scheduled appointments" },
                  { label: "Pipeline updates", desc: "Notifications when leads move through pipeline" },
                  { label: "Email replies", desc: "When contacts reply to your emails" },
                  { label: "Smart plan updates", desc: "Status updates on automated plans" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags */}
          <TabsContent value="tags">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Contact Tags</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New tag name..." value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTag()}
                    className="flex-1" />
                  <input type="color" value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer" />
                  <Button onClick={addTag} size="sm" className="bg-lofty-600 hover:bg-lofty-700">
                    <Plus className="w-4 h-4 mr-1" />Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <div key={tag.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium group"
                      style={{ backgroundColor: tag.color + "20", color: tag.color }}>
                      {tag.name}
                      <button onClick={() => deleteTag(tag.id)}
                        className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {tags.length === 0 && <p className="text-sm text-gray-400">No tags yet. Create one above.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline */}
          <TabsContent value="pipeline">
            <div className="space-y-4">
              {pipelines.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No pipelines yet. Create one below.</p>
              )}
              {pipelines.map(pipeline => (
                <Card key={pipeline.id} className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                      {pipeline.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pipeline.stages.map((stage: any) => (
                      <div key={stage.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg group">
                        {editingStage === stage.id ? (
                          <>
                            <input type="color" value={editStageColor}
                              onChange={e => setEditStageColor(e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer flex-shrink-0" />
                            <Input value={editStageName} onChange={e => setEditStageName(e.target.value)}
                              className="flex-1 h-8 text-sm" autoFocus
                              onKeyDown={e => e.key === "Enter" && saveStage(stage.id, pipeline.id)} />
                            <Button size="sm" onClick={() => saveStage(stage.id, pipeline.id)}
                              className="h-7 px-2 bg-lofty-600 hover:bg-lofty-700">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingStage(null)}
                              className="h-7 px-2">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                            <span className="text-sm flex-1">{stage.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="w-7 h-7"
                                onClick={() => { setEditingStage(stage.id); setEditStageName(stage.name); setEditStageColor(stage.color) }}>
                                <Edit className="w-3.5 h-3.5 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7"
                                onClick={() => deleteStage(stage.id, pipeline.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add stage */}
                    {addingTo === pipeline.id ? (
                      <div className="flex items-center gap-2 p-2 border border-dashed border-lofty-300 rounded-lg bg-lofty-50">
                        <input type="color"
                          value={newStageColor[pipeline.id] || "#3B82F6"}
                          onChange={e => setNewStageColor(s => ({ ...s, [pipeline.id]: e.target.value }))}
                          className="w-7 h-7 rounded border cursor-pointer flex-shrink-0" />
                        <Input
                          placeholder="Stage name..."
                          value={newStageName[pipeline.id] || ""}
                          onChange={e => setNewStageName(s => ({ ...s, [pipeline.id]: e.target.value }))}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                          onKeyDown={e => { if (e.key === "Enter") addStage(pipeline.id); if (e.key === "Escape") setAddingTo(null) }}
                        />
                        <Button size="sm" onClick={() => addStage(pipeline.id)}
                          className="h-7 px-2 bg-lofty-600 hover:bg-lofty-700">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingTo(null)} className="h-7 px-2">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTo(pipeline.id)}
                        className="w-full flex items-center gap-2 p-2 text-sm text-lofty-600 hover:bg-lofty-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-lofty-300">
                        <Plus className="w-4 h-4" /> Add Stage
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Create new pipeline */}
              {addingPipeline ? (
                <div className="flex items-center gap-2 p-3 border border-dashed border-lofty-300 rounded-xl bg-lofty-50">
                  <Input
                    placeholder="Pipeline name (e.g. Rental Leads)..."
                    value={newPipelineName}
                    onChange={e => setNewPipelineName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") createPipeline(); if (e.key === "Escape") setAddingPipeline(false) }}
                  />
                  <Button size="sm" onClick={createPipeline} className="bg-lofty-600 hover:bg-lofty-700 gap-1">
                    <Check className="w-3.5 h-3.5" /> Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingPipeline(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setAddingPipeline(true)}
                  className="w-full border-dashed gap-2 text-lofty-600 border-lofty-300 hover:bg-lofty-50">
                  <Plus className="w-4 h-4" /> New Pipeline
                </Button>
              )}
            </div>
          </TabsContent>

          {/* IDX / MLS */}
          <TabsContent value="idx">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">IDX / MLS Integration</CardTitle>
                  {idxConnected && (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Saved
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="bg-lofty-50 border border-lofty-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-lofty-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-lofty-900 text-sm">Miami Association of Realtors (MIAMI MLS)</p>
                    <p className="text-xs text-lofty-600 mt-0.5">Connect to access live MLS listings and auto-assign buyer search profiles</p>
                    <a href="https://www.miamire.com/idx" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-lofty-600 hover:text-lofty-700 mt-1 font-medium">
                      Get IDX credentials from MIAMI MLS <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">MLS Provider</Label>
                  <select value={idxConfig.provider} onChange={e => setIdxConfig(c => ({ ...c, provider: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none">
                    <option value="miami_mls">Miami Association of Realtors (MIAMI MLS)</option>
                    <option value="mls_florida">Florida MLS</option>
                    <option value="bright_mls">Bright MLS</option>
                    <option value="custom">Custom RETS / RESO</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">RETS Login URL</Label>
                    <Input value={idxConfig.loginUrl} onChange={e => setIdxConfig(c => ({ ...c, loginUrl: e.target.value }))}
                      placeholder="https://rets.miami-mls.com/rets/login" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">MLS Agent ID</Label>
                    <Input value={idxConfig.mlsId} onChange={e => setIdxConfig(c => ({ ...c, mlsId: e.target.value }))}
                      placeholder="Your MLS member ID" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">RETS Username</Label>
                    <Input value={idxConfig.username} onChange={e => setIdxConfig(c => ({ ...c, username: e.target.value }))}
                      placeholder="IDX username" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">RETS Password</Label>
                    <Input type="password" value={idxConfig.password}
                      onChange={e => setIdxConfig(c => ({ ...c, password: e.target.value }))}
                      placeholder="IDX password" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Automation</p>
                  {[
                    { key: "autoAssignSearch", label: "Auto-assign search profile on import", desc: "Infer buyer/seller criteria from imported lead data" },
                    { key: "autoImport", label: "Auto-import new IDX leads", desc: "Automatically create contacts from IDX lead captures" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <Switch checked={(idxConfig as any)[item.key]}
                        onCheckedChange={v => setIdxConfig(c => ({ ...c, [item.key]: v }))} />
                    </div>
                  ))}
                </div>

                {/* Connection status */}
                {idxConnected && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-sm font-medium text-green-700">Conectado al MLS correctamente</p>
                  </div>
                )}

                {/* Property count */}
                {idxPropertyCount !== null && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
                    <span className="font-bold">{idxPropertyCount}</span> propiedades en tu sitio web
                  </div>
                )}

                {/* Sync result */}
                {idxSyncResult && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-1">
                    <p className="text-sm font-semibold text-green-800">✅ Última sincronización:</p>
                    <p className="text-sm text-green-700">{idxSyncResult.imported} propiedades nuevas importadas</p>
                    <p className="text-sm text-green-700">{idxSyncResult.updated} propiedades actualizadas</p>
                    {idxSyncResult.errors.length > 0 && (
                      <p className="text-xs text-orange-600">{idxSyncResult.errors.length} errores menores (filas omitidas)</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveIdx} disabled={idxSaving} variant="outline">
                    {idxSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
                  </Button>
                  <Button onClick={testIdxConnection} disabled={idxTesting || !idxConfig.username || !idxConfig.password} variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    {idxTesting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Probando...</> : "🔌 Probar Conexión"}
                  </Button>
                  <Button onClick={syncMLSNow} disabled={idxSyncing || !idxConfig.username || !idxConfig.password}
                    className="bg-lofty-600 hover:bg-lofty-700">
                    {idxSyncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando propiedades...</> : "🔄 Sincronizar Propiedades Ahora"}
                  </Button>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-1">¿Cómo funciona?</p>
                  <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                    <li>Ingresa tus credenciales RETS del Miami MLS</li>
                    <li>Haz clic en <strong>Probar Conexión</strong> para verificar</li>
                    <li>Haz clic en <strong>Sincronizar</strong> para importar tus listings activos</li>
                    <li>Tus propiedades aparecerán automáticamente en <strong>/site</strong> y <strong>/site/listings</strong></li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {INTEGRATIONS.map(integration => {
                  const Icon = integration.icon
                  const isConnected = connectedIntegrations.has(integration.id)
                  return (
                    <div key={integration.id}
                      className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", integration.color)}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{integration.name}</p>
                          <p className="text-xs text-gray-500">{integration.desc}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isConnected ? "outline" : "default"}
                        onClick={() => !isConnected && setActiveIntegration(integration)}
                        className={cn(
                          isConnected ? "text-green-700 border-green-300 bg-green-50" : "bg-lofty-600 hover:bg-lofty-700"
                        )}>
                        {isConnected ? <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Connected</> : "Connect"}
                      </Button>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-lofty-600 flex items-center justify-center">
                      <Database className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">IDX / MLS</p>
                      <p className="text-xs text-gray-500">Miami MLS property data</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="idx"]')?.click()}
                    className="text-lofty-600 border-lofty-300">
                    Configure →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Availability */}
          <TabsContent value="availability">
            <AvailabilitySettings />
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Current Password</Label><Input type="password" className="mt-1" /></div>
                <div><Label>New Password</Label><Input type="password" className="mt-1" /></div>
                <div><Label>Confirm New Password</Label><Input type="password" className="mt-1" /></div>
                <Button className="bg-lofty-600 hover:bg-lofty-700">
                  <Save className="w-4 h-4 mr-2" />Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
