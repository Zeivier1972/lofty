"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, MessageSquare, Plus, Send, Eye, Trash2,
  BarChart2, Users, Clock, Star, Search, X, Loader2,
  Edit, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatRelativeTime, getStatusColor } from "@/lib/utils"
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
  RENTAL: "bg-yellow-100 text-yellow-700",
}

const CATEGORIES = ["GENERAL", "BUYER", "SELLER", "RENTAL", "TRANSACTION"]
const AUDIENCES = [
  { value: "all",       label: "Todos los contactos" },
  { value: "buyers",    label: "Solo compradores" },
  { value: "sellers",   label: "Solo vendedores" },
  { value: "new_leads", label: "Leads nuevos (últimos 30 días)" },
  { value: "cold",      label: "Leads fríos (sin contacto 60+ días)" },
  { value: "no_plan",   label: "Sin plan activo" },
]

export default function MessagesClient({ templates: initialTemplates, recentEmails: initialEmails, campaigns: initialCampaigns }: MessagesClientProps) {
  const { toast } = useToast()
  const router = useRouter()

  const [templates, setTemplates]   = useState(initialTemplates)
  const [emails, setEmails]         = useState(initialEmails)
  const [campaigns, setCampaigns]   = useState(initialCampaigns)
  const [searchTpl, setSearchTpl]   = useState("")

  // ── Modals ───────────────────────────────────────────────────────────────
  const [composeEmail, setComposeEmail] = useState<{ open: boolean; template?: any }>({ open: false })
  const [composeSms, setComposeSms]     = useState(false)
  const [newTemplate, setNewTemplate]   = useState<{ open: boolean; editing?: any }>({ open: false })
  const [previewTpl, setPreviewTpl]     = useState<any>(null)
  const [newCampaign, setNewCampaign]   = useState(false)

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTpl.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTpl.toLowerCase())
  )

  const sentCount = emails.filter(e => e.status !== "DRAFT").length
  const openRate  = emails.length > 0
    ? Math.round((emails.filter(e => e.openedAt).length / Math.max(sentCount, 1)) * 100)
    : 0

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function deleteTemplate(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return
    await fetch(`/api/email-templates/${id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast({ title: "Plantilla eliminada" })
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setComposeSms(true)}>
            <MessageSquare className="w-4 h-4" /> Compose SMS
          </Button>
          <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2" onClick={() => setComposeEmail({ open: true })}>
            <Mail className="w-4 h-4" /> Compose Email
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sent",      value: sentCount,         icon: Send,     color: "text-blue-600 bg-blue-50" },
          { label: "Open Rate", value: `${openRate}%`,    icon: Eye,      color: "text-green-600 bg-green-50" },
          { label: "Templates", value: templates.length,  icon: Star,     color: "text-purple-600 bg-purple-50" },
          { label: "Campaigns", value: campaigns.length,  icon: BarChart2,color: "text-orange-600 bg-orange-50" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.color.split(" ")[1])}>
                <stat.icon className={cn("w-4 h-4", stat.color.split(" ")[0])} />
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
          <TabsTrigger value="templates" className="gap-2"><Star className="w-4 h-4" /> Templates</TabsTrigger>
          <TabsTrigger value="sent" className="gap-2"><Send className="w-4 h-4" /> Sent ({sentCount})</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><BarChart2 className="w-4 h-4" /> Campaigns</TabsTrigger>
        </TabsList>

        {/* ── Templates tab ─────────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search templates..." value={searchTpl} onChange={e => setSearchTpl(e.target.value)} className="pl-9 h-9" />
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewTemplate({ open: true })}>
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <Button onClick={() => setNewTemplate({ open: true })} className="mt-4 bg-lofty-600 hover:bg-lofty-700" size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create first template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">{template.name}</p>
                          {template.category && (
                            <Badge className={cn("text-xs", CATEGORY_COLORS[template.category] || "bg-gray-100 text-gray-700")}>{template.category}</Badge>
                          )}
                          {template.isShared && <Badge variant="outline" className="text-xs">Shared</Badge>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 truncate">{template.subject}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.body}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPreviewTpl(template)}>
                        <Eye className="w-3 h-3" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setNewTemplate({ open: true, editing: template })}>
                        <Edit className="w-3 h-3" /> Edit
                      </Button>
                      <Button size="sm" className="h-7 text-xs gap-1 bg-lofty-600 hover:bg-lofty-700" onClick={() => setComposeEmail({ open: true, template })}>
                        <Send className="w-3 h-3" /> Use
                      </Button>
                      <button onClick={() => deleteTemplate(template.id)} className="ml-auto text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Sent tab ───────────────────────────────────────────────────── */}
        <TabsContent value="sent" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
              <div>Subject</div><div>Recipient</div><div>Status</div><div>Date</div>
            </div>
            <div className="divide-y divide-gray-100">
              {emails.map(email => (
                <div key={email.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {email.contact ? `${email.contact.firstName} ${email.contact.lastName}` : email.toAddress}
                  </p>
                  <Badge className={cn("text-xs w-fit", getStatusColor(email.status))}>{email.status}</Badge>
                  <p className="text-xs text-gray-400">{formatRelativeTime(email.createdAt)}</p>
                </div>
              ))}
              {emails.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">No emails sent yet</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Campaigns tab ─────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-1.5" onClick={() => setNewCampaign(true)}>
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
              <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No campaigns yet</p>
              <p className="text-gray-400 text-sm mt-1">Create a campaign to reach multiple contacts at once</p>
              <Button onClick={() => setNewCampaign(true)} className="mt-4 bg-lofty-600 hover:bg-lofty-700" size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <Card key={campaign.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{campaign.subject}</p>
                        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                          <span><Users className="w-3 h-3 inline mr-1" />{campaign.recipients} recipients</span>
                          <span><Eye className="w-3 h-3 inline mr-1" />{campaign.opened} opened</span>
                          {campaign.sentAt && <span><Clock className="w-3 h-3 inline mr-1" />{formatRelativeTime(campaign.sentAt)}</span>}
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {composeEmail.open && (
        <ComposeEmailModal
          template={composeEmail.template}
          onClose={() => setComposeEmail({ open: false })}
          onSent={email => { setEmails(prev => [email, ...prev]); setComposeEmail({ open: false }) }}
        />
      )}
      {composeSms && (
        <ComposeSmsModal onClose={() => setComposeSms(false)} />
      )}
      {newTemplate.open && (
        <TemplateModal
          editing={newTemplate.editing}
          onClose={() => setNewTemplate({ open: false })}
          onSaved={tpl => {
            setTemplates(prev => newTemplate.editing ? prev.map(t => t.id === tpl.id ? tpl : t) : [tpl, ...prev])
            setNewTemplate({ open: false })
          }}
        />
      )}
      {previewTpl && (
        <TemplatePreviewModal template={previewTpl} onClose={() => setPreviewTpl(null)} onUse={() => { setPreviewTpl(null); setComposeEmail({ open: true, template: previewTpl }) }} />
      )}
      {newCampaign && (
        <NewCampaignModal
          onClose={() => setNewCampaign(false)}
          onCreated={c => { setCampaigns(prev => [c, ...prev]); setNewCampaign(false) }}
        />
      )}
    </div>
  )
}

// ── Compose Email Modal ────────────────────────────────────────────────────────
function ComposeEmailModal({ template, onClose, onSent }: { template?: any; onClose: () => void; onSent: (e: any) => void }) {
  const { toast } = useToast()
  const [to, setTo]         = useState("")
  const [subject, setSubject] = useState(template?.subject || "")
  const [body, setBody]     = useState(template?.body || "")
  const [sending, setSending] = useState(false)

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "Completa todos los campos", variant: "destructive" }); return
    }
    setSending(true)
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, templateId: template?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "✅ Email enviado" })
      onSent(data.email)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell title="Compose Email" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Para (email) *</label>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Asunto *</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mensaje *</label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Escribe tu mensaje..." className="resize-none" />
        </div>
        {template && <p className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">Usando plantilla: <strong>{template.name}</strong></p>}
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar Email
        </Button>
      </div>
    </ModalShell>
  )
}

// ── Compose SMS Modal ─────────────────────────────────────────────────────────
function ComposeSmsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [to, setTo]     = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  async function send() {
    if (!to.trim() || !body.trim()) { toast({ title: "Completa todos los campos", variant: "destructive" }); return }
    setSending(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "✅ SMS enviado" })
      onClose()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell title="Compose SMS" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Número de teléfono *</label>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="+13055551234" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mensaje * ({body.length}/160)</label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={320} placeholder="Escribe tu SMS..." className="resize-none" />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={send} disabled={sending || !to.trim() || !body.trim()} className="bg-green-600 hover:bg-green-700 gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          Enviar SMS
        </Button>
      </div>
    </ModalShell>
  )
}

// ── Template Modal (create / edit) ────────────────────────────────────────────
function TemplateModal({ editing, onClose, onSaved }: { editing?: any; onClose: () => void; onSaved: (t: any) => void }) {
  const { toast } = useToast()
  const [name, setName]         = useState(editing?.name    || "")
  const [subject, setSubject]   = useState(editing?.subject || "")
  const [body, setBody]         = useState(editing?.body    || "")
  const [category, setCategory] = useState(editing?.category || "GENERAL")
  const [isShared, setIsShared] = useState(editing?.isShared || false)
  const [saving, setSaving]     = useState(false)

  async function save() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "Completa nombre, asunto y cuerpo", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/email-templates/${editing.id}` : "/api/email-templates"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body, category, isShared }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: editing ? "Plantilla actualizada" : "Plantilla creada" })
      onSaved(data.template)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={editing ? "Editar Plantilla" : "Nueva Plantilla"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Seguimiento comprador" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Asunto *</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Cuerpo * — usa {"{{"}<span>firstName</span>{"}}"}  para personalizar</label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Hola {{firstName}}, quería seguir en contacto..." className="resize-none font-mono text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} className="rounded" />
          Compartir con el equipo
        </label>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving || !name.trim() || !subject.trim() || !body.trim()} className="bg-lofty-600 hover:bg-lofty-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {editing ? "Guardar cambios" : "Crear plantilla"}
        </Button>
      </div>
    </ModalShell>
  )
}

// ── Template Preview Modal ────────────────────────────────────────────────────
function TemplatePreviewModal({ template, onClose, onUse }: { template: any; onClose: () => void; onUse: () => void }) {
  return (
    <ModalShell title={`Preview: ${template.name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-xl px-4 py-2 text-sm"><span className="font-medium text-gray-500">Asunto: </span>{template.subject}</div>
        <div className="border border-gray-200 rounded-xl p-4 min-h-[200px] text-sm whitespace-pre-wrap text-gray-800">{template.body}</div>
        {template.category && <Badge className={cn("text-xs", CATEGORY_COLORS[template.category] || "bg-gray-100 text-gray-700")}>{template.category}</Badge>}
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button onClick={onUse} className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Send className="w-4 h-4" /> Usar esta plantilla
        </Button>
      </div>
    </ModalShell>
  )
}

// ── New Campaign Modal ────────────────────────────────────────────────────────
function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const { toast } = useToast()
  const [name, setName]         = useState("")
  const [subject, setSubject]   = useState("")
  const [body, setBody]         = useState("")
  const [audience, setAudience] = useState("all")
  const [sendNow, setSendNow]   = useState(false)
  const [saving, setSaving]     = useState(false)

  async function create() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "Completa nombre, asunto y mensaje", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body, audience, sendNow }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: sendNow ? "✅ Campaña enviada" : "Campaña guardada como borrador" })
      onCreated(data.campaign)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Nueva Campaña de Email" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre de la campaña *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Newsletter junio 2026" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Audiencia</label>
            <select value={audience} onChange={e => setAudience(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Asunto del email *</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto que verán los destinatarios" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Contenido *</label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Escribe el cuerpo del email..." className="resize-none" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} className="rounded" />
          <div>
            <p className="font-medium text-orange-800">Enviar ahora</p>
            <p className="text-xs text-orange-600">Si no se activa, se guarda como borrador</p>
          </div>
        </label>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={create} disabled={saving || !name.trim() || !subject.trim() || !body.trim()} className={cn("gap-2", sendNow ? "bg-orange-600 hover:bg-orange-700" : "bg-lofty-600 hover:bg-lofty-700")}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : sendNow ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {sendNow ? "Enviar campaña" : "Guardar borrador"}
        </Button>
      </div>
    </ModalShell>
  )
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={cn("bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-y-auto", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
