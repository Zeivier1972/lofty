"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Plus, Send, Users, BarChart3, Eye, Trash2,
  X, ChevronDown, CheckCircle2, Clock, AlertCircle,
  FileText, Tag as TagIcon, Target, DollarSign, Image as ImageIcon, Sparkles, Loader2,
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
    const monthName = new Date().toLocaleString("es", { month: "long" })
    const capitalMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
    setSubject(tpl.subject.replace(/\{month\}/gi, capitalMonth))
    setBody(tpl.body.replace(/\{month\}/gi, capitalMonth))
    setSelectedTemplate(tpl.id)
    // Auto-fill campaign name from template if user hasn't typed one yet
    if (!name.trim()) setName(tpl.name)
    setStep("audience")
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
                {/* Image upload toolbar */}
                <div className="flex gap-3 mt-2 flex-wrap">
                  <label className="flex items-center gap-1 text-xs cursor-pointer text-indigo-500 hover:text-indigo-700">
                    <input type="file" accept="image/*,video/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return
                        const form = new FormData(); form.append("file", file)
                        const res = await fetch("/api/upload", { method: "POST", body: form })
                        const data = await res.json()
                        if (!res.ok) { alert(data.error); return }
                        const isVideo = file.type.startsWith("video/")
                        const tag = isVideo
                          ? `\n<p>📹 <a href="${data.url}" style="color:#4F46E5">Ver video</a></p>`
                          : `\n<img src="${data.url}" style="max-width:100%;border-radius:8px;margin:8px 0"/>`
                        setBody(b => b + tag)
                      }} />
                    📎 Subir imagen/video
                  </label>
                </div>
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

// ─── Facebook Ad Campaign Modal ───────────────────────────────────────────────

const FB_OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Generación de Leads", desc: "Formulario de captura en Facebook/Instagram" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfico al Sitio Web", desc: "Lleva visitas a tu landing page o website" },
  { value: "OUTCOME_AWARENESS", label: "Reconocimiento de Marca", desc: "Maximiza el alcance e impresiones" },
]

// Real estate interests that generally work with Facebook HOUSING category
const FB_INTERESTS = [
  { id: "6003020834693", name: "Real Estate" },
  { id: "6003148792459", name: "Home Buying" },
  { id: "6003195797498", name: "Mortgage" },
  { id: "6003404338454", name: "Home Improvement" },
  { id: "6003329588371", name: "Real Estate Investment" },
  { id: "6003458161900", name: "First-Time Home Buyer" },
  { id: "6003225454116", name: "Property Management" },
  { id: "6003384717972", name: "Luxury Real Estate" },
]

const FB_CTA = [
  { value: "LEARN_MORE", label: "Más Información" },
  { value: "CONTACT_US", label: "Contáctanos" },
  { value: "SIGN_UP", label: "Registrarse" },
  { value: "GET_OFFER", label: "Obtener Oferta" },
  { value: "BOOK_TRAVEL", label: "Agendar Cita" },
]

function FacebookAdModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [step, setStep] = useState<"objective" | "creative" | "audience" | "budget">("objective")
  const [saving, setSaving] = useState(false)

  const [campaignName, setCampaignName] = useState("")
  const [objective, setObjective] = useState("OUTCOME_LEADS")
  const [primaryText, setPrimaryText] = useState("")
  const [headline, setHeadline] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [uploadingImg, setUploadingImg] = useState(false)
  const [destinationUrl, setDestinationUrl] = useState(process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/book` : "")
  const [ctaType, setCtaType] = useState("LEARN_MORE")
  const [privacyUrl, setPrivacyUrl] = useState("")
  const [targetLocations, setTargetLocations] = useState("Miami, Florida")
  const [advantagePlus, setAdvantagePlus] = useState(true)
  const [selectedInterests, setSelectedInterests] = useState<{ id: string; name: string }[]>([])
  const [ageMin, setAgeMin] = useState("25")
  const [ageMax, setAgeMax] = useState("65")
  const [dailyBudget, setDailyBudget] = useState("10")

  // AI copy generator
  const [aiBrief, setAiBrief] = useState("")
  const [aiLang, setAiLang] = useState<"es" | "en" | "both">("es")
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)

  const handleGenerateCopy = async () => {
    if (!aiBrief.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: aiBrief, objective, language: aiLang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.campaignName) setCampaignName(data.campaignName)
      if (data.primaryText) setPrimaryText(data.primaryText)
      if (data.headline) setHeadline(data.headline)
      if (data.description) setDescription(data.description)
      setShowAiPanel(false)
      toast({ title: "✨ Texto generado con IA", description: "Revisa y ajusta el copy según necesites." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setAiLoading(false) }
  }
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState("")

  const steps = ["objective", "creative", "audience", "budget"]
  const stepIdx = steps.indexOf(step)

  const handleUploadImage = async (file: File) => {
    setUploadingImg(true)
    try {
      const form = new FormData(); form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImageUrl(data.url)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setUploadingImg(false) }
  }

  const handleLaunch = async () => {
    if (!campaignName || !primaryText || !headline || !destinationUrl) {
      toast({ title: "Completa todos los campos requeridos", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/facebook/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName,
          objective,
          primaryText,
          headline,
          description,
          imageUrl,
          destinationUrl,
          ctaType,
          dailyBudgetCents: Math.round(parseFloat(dailyBudget) * 100),
          startTime: new Date(startDate).toISOString(),
          endTime: endDate ? new Date(endDate).toISOString() : undefined,
          targetLocations: targetLocations.split(",").map(s => s.trim()).filter(Boolean),
          privacyPolicyUrl: privacyUrl || undefined,
          advantagePlus,
          interests: selectedInterests,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "✅ Campaña creada en Facebook", description: "La campaña está en pausa — actívala en Ads Manager." })
      onCreated()
      onClose()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0866ff,#a855f7)" }}>
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Nueva Campaña de Facebook Ads</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={cn("w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold",
                      step === s ? "bg-blue-600 text-white" :
                      stepIdx > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                    )}>{i + 1}</div>
                    {i < 3 && <div className="w-4 h-px bg-gray-200" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Step 1: Objective */}
          {step === "objective" && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nombre de la campaña *</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder="Ej: Propiedades Miami Junio 2026"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Objetivo de la campaña</label>
                <div className="space-y-2">
                  {FB_OBJECTIVES.map(obj => (
                    <label key={obj.value} className={cn(
                      "flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all",
                      objective === obj.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"
                    )}>
                      <input type="radio" name="objective" value={obj.value} checked={objective === obj.value}
                        onChange={() => setObjective(obj.value)} className="mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{obj.label}</p>
                        <p className="text-xs text-gray-500">{obj.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <strong>Nota:</strong> Por ley (Fair Housing Act), los anuncios de bienes raíces en Facebook se crean con categoría especial HOUSING.
                Esto restringe algo el targeting pero es obligatorio.
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep("creative")} disabled={!campaignName.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm disabled:opacity-50">
                  Siguiente: Creativo →
                </button>
              </div>
            </>
          )}

          {/* Step 2: Creative */}
          {step === "creative" && (
            <>
              {/* AI Copy Generator */}
              <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
                <button onClick={() => setShowAiPanel(v => !v)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors">
                  <Sparkles className="w-4 h-4" />
                  ✨ Generar copy con IA
                  <span className="ml-auto text-purple-400 text-xs">{showAiPanel ? "▲ ocultar" : "▼ abrir"}</span>
                </button>
                {showAiPanel && (
                  <div className="px-4 pb-4 space-y-3 border-t border-purple-200">
                    <p className="text-xs text-purple-600 pt-3">
                      Describe tu propiedad, audiencia y ventajas. La IA generará un título, texto y descripción optimizados para Facebook Ads.
                    </p>
                    <textarea value={aiBrief} onChange={e => setAiBrief(e.target.value)} rows={3}
                      placeholder="Ej: Casas de 4 habitaciones en Cutler Bay, FL, sin HOA, sin CDD, precio desde $380K hasta $1.4M. El vendedor paga los gastos de cierre. Dirigido a compradores hispanos de primera vez."
                      className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-purple-700">Idioma:</label>
                      {(["es", "en", "both"] as const).map(l => (
                        <button key={l} onClick={() => setAiLang(l)}
                          className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                            aiLang === l ? "bg-purple-600 text-white border-purple-600" : "border-purple-300 text-purple-600 hover:bg-purple-100")}>
                          {l === "es" ? "Español" : l === "en" ? "English" : "Español + English"}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleGenerateCopy} disabled={aiLoading || !aiBrief.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-purple-700 transition-colors">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {aiLoading ? "Generando..." : "Generar copy"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Texto principal *</label>
                <textarea value={primaryText} onChange={e => setPrimaryText(e.target.value)} rows={3}
                  placeholder="¿Buscas tu casa ideal en Miami? Tenemos opciones desde $300K. Contáctanos hoy."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Aparece encima de la imagen. Máx. 125 caracteres recomendado.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Titular *</label>
                  <input value={headline} onChange={e => setHeadline(e.target.value)}
                    placeholder="Casas en Miami desde $300K"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Descripción</label>
                  <input value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Agenda tu visita gratis"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Imagen del anuncio</label>
                {imageUrl ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setImageUrl("")}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">×</button>
                  </div>
                ) : (
                  <label className={cn("w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors", uploadingImg && "opacity-50 pointer-events-none")}>
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUploadImage(e.target.files[0])} />
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">{uploadingImg ? "Subiendo..." : "Haz clic para subir imagen"}</span>
                    <span className="text-xs text-gray-400 mt-1">Recomendado: 1200×628 px (relación 1.91:1)</span>
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                    {objective === "OUTCOME_LEADS" ? "URL después del formulario (gracias)" : "URL de destino *"}
                  </label>
                  <input value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)}
                    placeholder={objective === "OUTCOME_LEADS" ? "https://catherinegomezrealtor.com" : "https://tusitio.com/contacto"}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  {objective === "OUTCOME_LEADS" && (
                    <p className="text-xs text-gray-400 mt-1">Facebook muestra esta página al lead después de llenar el formulario.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Botón de llamada a acción</label>
                  <select value={ctaType} onChange={e => setCtaType(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {FB_CTA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {objective === "OUTCOME_LEADS" && (
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">URL de política de privacidad *</label>
                    <input value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)}
                      placeholder="https://catherinegomezrealtor.com/privacy"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <p className="text-xs text-gray-400 mt-1">Requerido por Facebook para formularios de captación de leads.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep("objective")} className="px-4 py-2 border border-gray-200 rounded-xl text-sm">← Atrás</button>
                <button onClick={() => setStep("audience")} disabled={!primaryText || !headline || !destinationUrl}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm disabled:opacity-50">
                  Siguiente: Audiencia →
                </button>
              </div>
            </>
          )}

          {/* Step 3: Audience */}
          {step === "audience" && (
            <>
              {/* Advantage+ toggle */}
              <label className={cn(
                "flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all",
                advantagePlus ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"
              )}>
                <input type="checkbox" checked={advantagePlus} onChange={e => setAdvantagePlus(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">✨ Advantage+ Audience <span className="text-blue-600 text-xs font-medium ml-1">RECOMENDADO</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">Meta AI analiza tu anuncio y lo muestra a las personas con más probabilidades de convertirse en leads. No necesitas definir intereses manualmente — el algoritmo lo hace por ti.</p>
                </div>
              </label>

              {!advantagePlus && (
                <>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                    <strong>Categoría HOUSING:</strong> Los anuncios de bienes raíces no pueden segmentar por código postal, edad o género. Solo por estado/ciudad.
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Intereses relacionados</label>
                    <div className="flex flex-wrap gap-2">
                      {FB_INTERESTS.map(i => (
                        <button key={i.id} onClick={() => setSelectedInterests(prev =>
                          prev.find(x => x.id === i.id) ? prev.filter(x => x.id !== i.id) : [...prev, i]
                        )}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                            selectedInterests.find(x => x.id === i.id)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-200 text-gray-600 hover:border-blue-300"
                          )}>
                          {i.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Nota: con categoría HOUSING, Meta puede limitar algunos intereses automáticamente.</p>
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Mercado objetivo (estado/ciudad)</label>
                <input value={targetLocations} onChange={e => setTargetLocations(e.target.value)}
                  placeholder="Miami, Florida, Fort Lauderdale, Florida"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Separa múltiples ciudades con comas. El estado se usa para la segmentación.</p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep("creative")} className="px-4 py-2 border border-gray-200 rounded-xl text-sm">← Atrás</button>
                <button onClick={() => setStep("budget")}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm">
                  Siguiente: Presupuesto →
                </button>
              </div>
            </>
          )}

          {/* Step 4: Budget + Launch */}
          {step === "budget" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Presupuesto diario (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="number" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} min="1"
                      className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Mínimo recomendado: $10/día</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Fecha de inicio</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Fecha de fin (opcional)</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-900 mb-2">Resumen del anuncio</p>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Campaña:</span><span className="font-medium">{campaignName}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Objetivo:</span><span>{FB_OBJECTIVES.find(o => o.value === objective)?.label}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Titular:</span><span>{headline}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Ciudades:</span><span>{targetLocations}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Presupuesto:</span><span>${dailyBudget}/día</span></div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700">
                <strong>La campaña se crea en estado PAUSA</strong> para que la revises en Facebook Ads Manager antes de activarla.
                Puedes hacer ajustes y activarla desde allí.
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep("audience")} className="px-4 py-2 border border-gray-200 rounded-xl text-sm">← Atrás</button>
                <button onClick={handleLaunch} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0866ff,#a855f7)" }}>
                  <Target className="w-4 h-4" />
                  {saving ? "Creando campaña..." : "Crear en Facebook Ads"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsClient({ campaigns: initCampaigns, tags, stats }: CampaignsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState(initCampaigns)
  const [showNew, setShowNew] = useState(false)
  const [showFbAd, setShowFbAd] = useState(false)

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {showNew && (
        <NewCampaignModal tags={tags} onClose={() => setShowNew(false)} onCreated={() => router.refresh()} />
      )}
      {showFbAd && (
        <FacebookAdModal onClose={() => setShowFbAd(false)} onCreated={() => router.refresh()} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{stats.emailableContacts.toLocaleString()} contactos con email disponibles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFbAd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white shadow-sm hover:shadow-md transition-shadow"
            style={{ background: "linear-gradient(135deg,#0866ff,#a855f7)" }}
          >
            <Target className="w-4 h-4" /> Facebook Ads
          </button>
          <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Email Campaign
          </Button>
        </div>
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
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", c.type === "FACEBOOK" ? "" : "bg-indigo-100")}
                    style={c.type === "FACEBOOK" ? { background: "linear-gradient(135deg,#0866ff,#a855f7)" } : {}}>
                    {c.type === "FACEBOOK"
                      ? <Target className="w-4 h-4 text-white" />
                      : <Mail className="w-4 h-4 text-indigo-600" />}
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
