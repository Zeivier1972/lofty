"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Plus, Send, Users, BarChart3, Eye, Trash2,
  X, ChevronDown, CheckCircle2, Clock, AlertCircle,
  FileText, Tag as TagIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-blue-100 text-blue-700",
  SENDING: "bg-yellow-100 text-yellow-700",
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
}

const TEMPLATES = [
  {
    id: "new_listings",
    name: "Nuevas Propiedades",
    subject: "🏠 Nuevas propiedades que te podrían interesar",
    body: `<p>Hola {first_name},</p>
<p>Tenemos nuevas propiedades que coinciden con lo que estás buscando. Este es el momento perfecto para explorar tus opciones.</p>
<p>¿Te gustaría agendar una llamada gratuita con Catherine para hablar sobre tus opciones?</p>
<p style="margin:24px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Propiedades →</a></p>
<p>Estamos aquí para ayudarte,<br/><strong>Catherine</strong></p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0"/>
<p style="color:#9CA3AF;font-size:12px">Hi {first_name}, we have new property listings that match your search. Contact Catherine to schedule a free consultation.</p>`,
  },
  {
    id: "market_update",
    name: "Actualización del Mercado",
    subject: "📊 Actualización del mercado inmobiliario — {month}",
    body: `<p>Hola {first_name},</p>
<p>El mercado inmobiliario sigue activo. Aquí hay un resumen de lo que está pasando en tu área:</p>
<ul>
<li>📈 Los precios han subido en la mayoría de los vecindarios</li>
<li>🏠 La demanda de compradores sigue siendo alta</li>
<li>⚡ Las casas bien presentadas se venden rápido</li>
</ul>
<p>¿Es el momento correcto para ti? Hablemos.</p>
<p style="margin:24px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Agendar Consulta Gratuita →</a></p>
<p>Con cariño,<br/><strong>Catherine</strong></p>`,
  },
  {
    id: "ftbo_welcome",
    name: "Bienvenida Comprador Primera Vez",
    subject: "🎓 Tu guía para comprar tu primera casa",
    body: `<p>Hola {first_name},</p>
<p>¡Qué emocionante que estés pensando en comprar tu primera casa! Este es uno de los pasos más importantes de tu vida y quiero ayudarte a que sea lo más sencillo posible.</p>
<p><strong>Lo que necesitas saber primero:</strong></p>
<ol>
<li>Revisar tu crédito (mínimo 580 para FHA)</li>
<li>Determinar tu presupuesto</li>
<li>Obtener una pre-aprobación hipotecaria</li>
<li>¡Empezar a buscar!</li>
</ol>
<p>¿Tienes preguntas? Estoy aquí para guiarte en cada paso.</p>
<p style="margin:24px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Habla con Catherine Gratis →</a></p>
<p>¡Hasta pronto!<br/><strong>Catherine</strong></p>`,
  },
  {
    id: "reengagement",
    name: "Re-enganche de Leads Fríos",
    subject: "👋 ¿Sigues buscando propiedades, {first_name}?",
    body: `<p>Hola {first_name},</p>
<p>Ha pasado un tiempo desde que hablamos y quería saber cómo estás. ¿Sigues interesado(a) en bienes raíces?</p>
<p>El mercado ha cambiado bastante — puede que haya opciones perfectas para ti ahora mismo que antes no estaban disponibles.</p>
<p>¿Podemos hablar por 15 minutos? No hay compromiso, solo quiero saber cómo puedo ayudarte mejor.</p>
<p style="margin:24px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Sí, quiero hablar →</a></p>
<p>Siempre aquí para ti,<br/><strong>Catherine</strong></p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0"/>
<p style="color:#9CA3AF;font-size:12px">Hi {first_name}, just checking in — the market has some great options right now. Let's chat! Reply to this email or click above.</p>`,
  },
  {
    id: "open_house",
    name: "Invitación Casa Abierta",
    subject: "🏡 Estás invitado(a) — Casa Abierta este fin de semana",
    body: `<p>Hola {first_name},</p>
<p>¡Tienes una invitación especial! Este fin de semana tenemos una casa abierta exclusiva y me gustaría que la vieras.</p>
<p>📍 <strong>Dirección:</strong> [Dirección]<br/>
📅 <strong>Fecha:</strong> [Fecha]<br/>
⏰ <strong>Horario:</strong> [Hora inicio] - [Hora fin]</p>
<p>Habrá refrescos y yo estaré personalmente para mostrarte cada detalle de la propiedad.</p>
<p style="margin:24px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar Asistencia →</a></p>
<p>¡Nos vemos pronto!<br/><strong>Catherine</strong></p>`,
  },
]

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos los contactos con email" },
  { value: "buyers", label: "Compradores (con criterios de búsqueda)" },
  { value: "sellers", label: "Vendedores (con dirección registrada)" },
  { value: "new_leads", label: "Nuevos leads (últimos 30 días)" },
  { value: "cold", label: "Leads fríos (sin contacto en 60+ días)" },
  { value: "no_plan", label: "Sin Smart Plan activo" },
]

interface CampaignsClientProps {
  campaigns: any[]
  tags: any[]
  stats: { emailableContacts: number; sentCampaigns: number; totalSent: number }
}

function NewCampaignModal({ tags, onClose, onCreated }: { tags: any[]; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [step, setStep] = useState<"setup" | "audience" | "compose" | "preview">("setup")
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [subjectB, setSubjectB] = useState("")
  const [abTesting, setAbTesting] = useState(false)
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSubject(tpl.subject)
    setBody(tpl.body)
    setSelectedTemplate(tpl.id)
    setStep("compose")
  }

  const fetchAudienceCount = async () => {
    setLoadingCount(true)
    try {
      const params = new URLSearchParams({ audience, tags: selectedTags.join(",") })
      const res = await fetch(`/api/campaigns/audience-count?${params}`)
      const data = await res.json()
      setAudienceCount(data.count)
    } catch {
      setAudienceCount(null)
    } finally {
      setLoadingCount(false)
    }
  }

  const handleSend = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "Completa todos los campos requeridos", variant: "destructive" })
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, subjectVariantB: abTesting ? subjectB : undefined, body, audience, tagIds: selectedTags, sendNow: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✅ Campaña enviada`, description: `${data.sent} emails enviados` })
      onCreated()
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Error al enviar", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!name.trim()) { toast({ title: "Nombre requerido", variant: "destructive" }); return }
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, subjectVariantB: abTesting ? subjectB : undefined, body, audience, tagIds: selectedTags, sendNow: false }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Borrador guardado" })
      onCreated()
      onClose()
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Nueva Campaña de Email</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {["setup", "audience", "compose", "preview"].map((s, i) => (
                  <div key={s} className={cn("flex items-center gap-1")}>
                    <div className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold",
                      step === s ? "bg-indigo-600 text-white" :
                      ["setup", "audience", "compose", "preview"].indexOf(step) > i ? "bg-green-500 text-white" :
                      "bg-gray-200 text-gray-500"
                    )}>{i + 1}</div>
                    {i < 3 && <div className="w-4 h-px bg-gray-200" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {/* Step 1: Setup */}
          {step === "setup" && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nombre de la campaña *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Nuevas propiedades Junio" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">¿Quieres usar una plantilla?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      className={cn(
                        "text-left p-3.5 border-2 rounded-xl transition-all hover:border-indigo-400 hover:bg-indigo-50",
                        selectedTemplate === tpl.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                      )}
                    >
                      <p className="font-semibold text-gray-900 text-sm">{tpl.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{tpl.subject}</p>
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedTemplate(null); setStep("compose") }}
                    className="text-left p-3.5 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <p className="font-semibold text-gray-700 text-sm">Crear desde cero</p>
                    </div>
                    <p className="text-xs text-gray-400">Escribe tu propio mensaje</p>
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep("audience")} disabled={!name.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                  Siguiente: Audiencia →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === "audience" && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Selecciona tu audiencia</label>
                <div className="space-y-2">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <label key={opt.value} className={cn(
                      "flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all",
                      audience === opt.value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-200"
                    )}>
                      <input type="radio" name="audience" value={opt.value} checked={audience === opt.value}
                        onChange={() => setAudience(opt.value)} className="text-indigo-600" />
                      <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {tags.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Filtrar por etiquetas (opcional)</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: any) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTags(t => t.includes(tag.id) ? t.filter(x => x !== tag.id) : [...t, tag.id])}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                          selectedTags.includes(tag.id)
                            ? "border-indigo-500 text-white"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300"
                        )}
                        style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={fetchAudienceCount} variant="outline" disabled={loadingCount} size="sm">
                  {loadingCount ? "Calculando..." : "Calcular audiencia"}
                </Button>
                {audienceCount !== null && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">
                    <Users className="w-4 h-4" />
                    {audienceCount.toLocaleString()} contactos
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("setup")}>← Atrás</Button>
                <Button onClick={() => setStep("compose")} className="bg-indigo-600 hover:bg-indigo-700">
                  Siguiente: Redactar →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Compose */}
          {step === "compose" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700">Asunto del email *</label>
                  <button
                    onClick={() => setAbTesting(!abTesting)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${abTesting ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {abTesting ? "✓ A/B Test activo" : "+ A/B Test"}
                  </button>
                </div>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="🏠 Asunto A — llamativo en español..." />
                {abTesting && (
                  <Input className="mt-2" value={subjectB} onChange={e => setSubjectB(e.target.value)} placeholder="📊 Asunto B — variante alternativa..." />
                )}
                {abTesting && (
                  <p className="text-xs text-purple-600 mt-1">✓ Se enviará A al 50% y B al 50%. El ganador se selecciona por mayor tasa de apertura.</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Usa {"{first_name}"} para personalizar.</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Cuerpo del email *</label>
                <p className="text-xs text-gray-400 mb-2">Variables disponibles: {"{first_name}"} {"{last_name}"} {"{full_name}"}</p>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={14}
                  placeholder="<p>Hola {first_name},</p><p>Tu mensaje aquí...</p>"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  El sistema agregará automáticamente el encabezado, pie de página y enlace de cancelar suscripción.
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("audience")}>← Atrás</Button>
                <Button onClick={() => setStep("preview")} disabled={!subject.trim() || !body.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                  Vista previa →
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Preview + Send */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-20">Campaña:</span>
                  <span className="font-semibold text-gray-900">{name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-20">Asunto:</span>
                  <span className="font-medium text-gray-800">{subject}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-20">Audiencia:</span>
                  <span className="font-medium text-gray-800">
                    {AUDIENCE_OPTIONS.find(o => o.value === audience)?.label}
                    {selectedTags.length > 0 && ` + ${selectedTags.length} etiqueta(s)`}
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />Vista previa (ejemplo con "María García")
                </div>
                <div className="p-4 max-h-64 overflow-y-auto text-sm"
                  dangerouslySetInnerHTML={{
                    __html: body
                      .replace(/\{first_name\}/gi, "María")
                      .replace(/\{last_name\}/gi, "García")
                      .replace(/\{full_name\}/gi, "María García")
                  }}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  El sistema automáticamente <strong>excluye</strong> contactos marcados como "No Email" y agrega un enlace de cancelar suscripción al pie de cada email.
                </p>
              </div>

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep("compose")}>← Editar</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveDraft}>Guardar borrador</Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending}
                    className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "Enviando..." : "Enviar campaña"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignsClient({ campaigns: initCampaigns, tags, stats }: CampaignsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState(initCampaigns)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {showNew && (
        <NewCampaignModal
          tags={tags}
          onClose={() => setShowNew(false)}
          onCreated={() => router.refresh()}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-500 text-sm mt-0.5">{stats.emailableContacts.toLocaleString()} contactos con email disponibles</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Nueva Campaña
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Contactos con email", value: stats.emailableContacts.toLocaleString(), icon: Users, color: "text-indigo-600 bg-indigo-50" },
          { label: "Campañas enviadas", value: stats.sentCampaigns, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Emails totales enviados", value: stats.totalSent.toLocaleString(), icon: Mail, color: "text-blue-600 bg-blue-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.color.split(" ")[1])}>
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

      {/* How it works tip */}
      <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-900">Sistema listo para envíos</p>
          <p className="text-xs text-green-700 mt-0.5">
            Haz clic en <strong>+ Nueva Campaña</strong> para enviar a tus {stats.emailableContacts} contactos con email.
            Puedes elegir enviar a todos o filtrar por segmento (compradores, leads nuevos, fríos, etc.).
            El sistema personaliza cada email con el nombre del contacto.
          </p>
        </div>
      </div>

      {/* Campaign list */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Historial de Campañas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hay campañas aún</p>
              <p className="text-gray-400 text-sm mt-1">Crea tu primera campaña para llegar a tus {stats.emailableContacts.toLocaleString()} contactos</p>
              <Button onClick={() => setShowNew(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Plus className="w-4 h-4" />Nueva Campaña
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.subject || "Sin asunto"}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {c.status === "SENT" && (
                      <>
                        <div className="flex items-center gap-1"><Send className="w-3.5 h-3.5" />{c.recipients?.toLocaleString() || 0}</div>
                        {c.opened > 0 && <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-green-500" />{c.opened}</div>}
                      </>
                    )}
                    <span className={cn("px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT)}>
                      {c.status === "DRAFT" ? "Borrador" : c.status === "SENT" ? "Enviado" : c.status === "SENDING" ? "Enviando..." : c.status}
                    </span>
                    {c.sentAt && <span>{new Date(c.sentAt).toLocaleDateString("es-US")}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
