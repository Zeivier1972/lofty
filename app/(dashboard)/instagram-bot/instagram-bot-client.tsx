"use client"

import { useState, useEffect } from "react"
import { Instagram, Zap, Users, CheckCircle2, MessageSquare, Copy, ExternalLink, AlertCircle, Plus, Trash2, Link2, FileText, ChevronDown, Upload, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import HelpPanel from "@/components/help-panel"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

export default function InstagramBotClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ keyword: "", name: "", pdfUrl: "", pdfName: "", greeting: "" })
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [resettingConvo, setResettingConvo] = useState<string | null>(null)
  const [handles, setHandles] = useState<{ fbPageId: string; igHandle: string }>({ fbPageId: "", igHandle: "" })
  const [copiedKw, setCopiedKw] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/social/handles").then(r => r.json()).then(d => setHandles({ fbPageId: d.fbPageId || "", igHandle: d.igHandle || "" })).catch(() => {})
  }, [])

  // One-tap deep link that opens the DM with the keyword pre-typed.
  function oneTapLink(keyword: string): string | null {
    const kw = encodeURIComponent(keyword.toUpperCase())
    if (handles.igHandle) return `https://ig.me/m/${handles.igHandle}?text=${kw}`
    if (handles.fbPageId) return `https://m.me/${handles.fbPageId}?text=${kw}`
    return null
  }
  function copyOneTap(keyword: string) {
    const link = oneTapLink(keyword)
    if (!link) return
    navigator.clipboard?.writeText(link)
    setCopiedKw(keyword)
    setTimeout(() => setCopiedKw(null), 2000)
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/instagram/config").then(r => r.json()),
      fetch("/api/instagram/campaigns").then(r => r.json()),
      fetch("/api/instagram/bot-conversations").then(r => r.json()),
    ]).then(([cfg, camps, convos]) => {
      setConfig(cfg.config)
      setStats(cfg.stats)
      setCampaigns(Array.isArray(camps) ? camps : [])
      setConversations(Array.isArray(convos) ? convos : [])
    }).finally(() => setLoading(false))
  }, [])

  const addCampaign = async () => {
    if (!newCampaign.keyword.trim() || !newCampaign.name.trim()) {
      toast({ title: "Keyword y nombre son requeridos", variant: "destructive" })
      return
    }
    setSavingCampaign(true)
    try {
      const res = await fetch("/api/instagram/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCampaigns(prev => [data, ...prev])
      setNewCampaign({ keyword: "", name: "", pdfUrl: "", pdfName: "", greeting: "" })
      setShowNewCampaign(false)
      toast({ title: "✅ Campaña creada" })
    } catch (e: any) {
      toast({ title: e.message || "Error al crear campaña", variant: "destructive" })
    } finally {
      setSavingCampaign(false)
    }
  }

  const uploadPdf = async (file: File) => {
    setUploadingPdf(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/pdf", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewCampaign(p => ({ ...p, pdfUrl: data.url, pdfName: p.pdfName || file.name }))
      toast({ title: "✅ PDF subido" })
    } catch (e: any) {
      toast({ title: e.message || "Error al subir PDF", variant: "destructive" })
    } finally {
      setUploadingPdf(false)
    }
  }

  const deleteCampaign = async (id: string) => {
    try {
      await fetch("/api/instagram/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setCampaigns(prev => prev.filter(c => c.id !== id))
      toast({ title: "Campaña eliminada" })
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    }
  }

  const resetConversation = async (igUserId: string) => {
    setResettingConvo(igUserId)
    try {
      await fetch("/api/instagram/bot-conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igUserId }),
      })
      setConversations(prev => prev.filter(c => c.igUserId !== igUserId))
      toast({ title: "Conversación reiniciada" })
    } catch {
      toast({ title: "Error al reiniciar", variant: "destructive" })
    } finally {
      setResettingConvo(null)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/instagram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error()
      toast({ title: "✅ Configuración guardada" })
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const webhookUrl = `${APP_URL}/api/webhooks/instagram`
  const verifyToken = process.env.NEXT_PUBLIC_IG_VERIFY_TOKEN || "lofty_ig_verify"

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="p-6 space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Instagram className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instagram Lead Bot</h1>
            <p className="text-sm text-gray-500">Captura leads automáticamente desde comentarios y DMs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HelpPanel section="instagram-bot" />
          {config && (
            <button
              onClick={() => { setConfig({ ...config, isEnabled: !config.isEnabled }); setTimeout(save, 100) }}
              className={cn(
                "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
                config.isEnabled ? "bg-green-500" : "bg-gray-300"
              )}
            >
              <span className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                config.isEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Conversaciones", value: stats?.totalConversations || 0, icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
          { label: "Leads capturados", value: stats?.captured || 0, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Esta semana", value: stats?.thisWeek || 0, icon: Zap, color: "text-blue-600 bg-blue-50" },
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

      {/* Setup instructions */}
      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Configuración en Meta (hacer una sola vez)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-800">
          <ol className="list-decimal list-inside space-y-2">
            <li>Ve a <strong>developers.facebook.com</strong> → tu App → Instagram → Webhooks</li>
            <li>Copia la <strong>Webhook URL</strong> y el <strong>Verify Token</strong> de abajo</li>
            <li>Suscríbete a los campos: <code className="bg-amber-100 px-1 rounded">messages</code> y <code className="bg-amber-100 px-1 rounded">comments</code></li>
            <li>Guarda y verifica — Meta enviará una petición GET a tu webhook</li>
          </ol>
          <div className="space-y-2 mt-3">
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Webhook URL</p>
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                <code className="text-xs flex-1 text-gray-700 break-all">{webhookUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "Copiado!" }) }}>
                  <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Verify Token</p>
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                <code className="text-xs flex-1 text-gray-700">{verifyToken}</code>
                <button onClick={() => { navigator.clipboard.writeText(verifyToken); toast({ title: "Copiado!" }) }}>
                  <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold text-amber-700 mb-1">Variables de entorno a agregar en Railway:</p>
            <div className="bg-amber-100 rounded-lg p-2 font-mono text-xs space-y-1">
              <p>INSTAGRAM_ACCESS_TOKEN=<span className="text-amber-600">tu_long_lived_token</span></p>
              <p>INSTAGRAM_ACCOUNT_ID=<span className="text-amber-600">tu_ig_account_id</span></p>
              <p>INSTAGRAM_WEBHOOK_VERIFY_TOKEN=lofty_ig_verify</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Flow Diagram */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Flujo del Bot</CardTitle>
          <p className="text-xs text-gray-400">Así funciona el bot paso a paso</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-0">
            {[
              { icon: "💬", label: "Alguien comenta una palabra clave en tu post", color: "bg-purple-100 text-purple-700" },
              { icon: "📩", label: "Bot envía DM privado + respuesta pública al comentario", color: "bg-blue-100 text-blue-700" },
              { icon: "🎯", label: "Pregunta A / B / C → intención del lead", color: "bg-indigo-100 text-indigo-700" },
              { icon: "👤", label: "Pide nombre completo", color: "bg-violet-100 text-violet-700" },
              { icon: "📧", label: "Pide correo electrónico", color: "bg-pink-100 text-pink-700" },
              { icon: "📱", label: "Pide número de teléfono", color: "bg-rose-100 text-rose-700" },
              { icon: "🏠", label: "Envía PDF de campaña (si aplica) + propiedades del CRM", color: "bg-orange-100 text-orange-700" },
              { icon: "✅", label: "Lead creado en CRM → SMS + email + llamada automática", color: "bg-green-100 text-green-700" },
            ].map((step, i, arr) => (
              <div key={i} className="flex flex-col items-center w-full max-w-sm">
                <div className={cn("flex items-center gap-3 w-full rounded-xl px-4 py-2.5", step.color)}>
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                {i < arr.length - 1 && <div className="w-0.5 h-4 bg-gray-200" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" /> Campañas — Keyword → PDF/Brochure
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowNewCampaign(true)}>
              <Plus className="w-3.5 h-3.5" /> Nueva campaña
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Cuando alguien escribe la palabra clave, el bot envía el PDF específico al final del flujo.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaigns.length === 0 && !showNewCampaign && (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No hay campañas. Ej: keyword "INVEST" → brochure de inversión</p>
            </div>
          )}
          {campaigns.map(c => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-100 text-purple-700 text-xs font-mono uppercase">{c.keyword}</Badge>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  <Badge className={cn("text-xs", c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                    {c.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                {c.pdfUrl && (
                  <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1">
                    <Link2 className="w-3 h-3" />{c.pdfName || "Ver PDF"}
                  </a>
                )}
                {oneTapLink(c.keyword) && (
                  <button
                    onClick={() => copyOneTap(c.keyword)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    title="Copia un link que abre el DM con la palabra ya escrita — pégalo en tus posts o bio"
                  >
                    <Link2 className="w-3 h-3" />{copiedKw === c.keyword ? "¡Link copiado!" : "Copiar link de un toque"}
                  </button>
                )}
                <p className="text-xs text-gray-300 mt-1">{c.leads} leads</p>
              </div>
              <button onClick={() => deleteCampaign(c.id)} className="text-gray-300 hover:text-red-400 transition-colors mt-0.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {showNewCampaign && (
            <div className="border border-purple-200 rounded-xl p-4 bg-purple-50 space-y-3">
              <p className="text-sm font-semibold text-purple-900">Nueva campaña</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Palabra clave *</label>
                  <Input placeholder="INVEST" value={newCampaign.keyword} onChange={e => setNewCampaign(p => ({ ...p, keyword: e.target.value }))} className="bg-white uppercase placeholder:normal-case" />
                  <p className="text-xs text-gray-400 mt-0.5">Ej: INVEST, BRICKELL, HOMESTEAD</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                  <Input placeholder="Inversión Miami 2025" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">PDF / Brochure</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="URL del PDF o sube un archivo →"
                    value={newCampaign.pdfUrl}
                    onChange={e => setNewCampaign(p => ({ ...p, pdfUrl: e.target.value }))}
                    className="bg-white flex-1"
                  />
                  <label className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium cursor-pointer transition-colors flex-shrink-0",
                    uploadingPdf ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white hover:bg-purple-50 hover:border-purple-300 text-gray-600"
                  )}>
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingPdf ? "Subiendo..." : "Subir PDF"}
                    <input type="file" accept=".pdf,application/pdf" className="hidden" disabled={uploadingPdf}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = "" }} />
                  </label>
                </div>
                {newCampaign.pdfUrl && (
                  <a href={newCampaign.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1">
                    <Link2 className="w-3 h-3" /> Ver PDF subido
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre del archivo</label>
                  <Input placeholder="Portafolio de Inversión" value={newCampaign.pdfName} onChange={e => setNewCampaign(p => ({ ...p, pdfName: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Saludo personalizado</label>
                  <Input placeholder="¡Hola! Vi que te interesa..." value={newCampaign.greeting} onChange={e => setNewCampaign(p => ({ ...p, greeting: e.target.value }))} className="bg-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={addCampaign} disabled={savingCampaign}>{savingCampaign ? "Guardando..." : "Crear campaña"}</Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNewCampaign(false); setNewCampaign({ keyword: "", name: "", pdfUrl: "", pdfName: "", greeting: "" }) }}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      {config && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Configuración del Bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Palabras clave que activan el bot (separadas por coma)
              </label>
              <Input
                value={config.triggerKeywords}
                onChange={e => setConfig({ ...config, triggerKeywords: e.target.value })}
                placeholder="info, precio, interesado, interested"
              />
              <p className="text-xs text-gray-400 mt-1">Cuando alguien comenta una de estas palabras, el bot les envía un DM automáticamente</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">🌐 Página web (se envía al final)</label>
              <Input
                value={config.websiteUrl || ""}
                onChange={e => setConfig({ ...config, websiteUrl: e.target.value })}
                placeholder="https://catherinegomezrealtor.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">👆 Botones del saludo (separados por coma)</label>
              <Input
                value={config.greetingButtons ?? "Sí, me interesa,Quiero más info"}
                onChange={e => setConfig({ ...config, greetingButtons: e.target.value })}
                placeholder="Sí, me interesa,Quiero más info"
              />
              <p className="text-xs text-gray-400 mt-1">Aparecen como chips tapables debajo del saludo. Máx. 20 caracteres por botón.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">🎯 Etiquetas de los botones A / B / C</label>
              {[
                { key: "intentButtonA", placeholder: "Comprar para vivir" },
                { key: "intentButtonB", placeholder: "Invertir / Airbnb" },
                { key: "intentButtonC", placeholder: "Solo explorando" },
              ].map(({ key, placeholder }, i) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 w-5">{String.fromCharCode(65 + i)})</span>
                  <Input
                    value={config[key] ?? placeholder}
                    onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="flex-1"
                  />
                </div>
              ))}
              <p className="text-xs text-gray-400">Máx. 20 caracteres. A = comprar · B = invertir · C = explorando</p>
            </div>

            {[
              { key: "msgGreeting", label: "🤖 1. Mensaje inicial (cuando comenta o escribe)", hint: "Ofrece la lista exclusiva — cualquier respuesta positiva continúa" },
              { key: "msgAskIntent", label: "🎯 2. Pregunta de calificación (A/B/C)", hint: "A = comprar para vivir · B = invertir Airbnb · C = solo explorando. Se guarda como etiqueta en el contacto" },
              { key: "msgAskName", label: "👤 3. Pedir nombre", hint: "" },
              { key: "msgAskEmail", label: "📧 4. Pedir email", hint: "Usa {name} para el nombre" },
              { key: "msgAskPhone", label: "📱 5. Pedir teléfono", hint: "Usa {name} para el nombre" },
              { key: "msgThankYou", label: "✅ 6. Mensaje de gracias (lead capturado)", hint: "Usa {name} para el nombre y {website} para tu página web" },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{label}</label>
                <textarea
                  value={config[key]}
                  onChange={e => setConfig({ ...config, [key]: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
              </div>
            ))}

            <Button onClick={save} disabled={saving} className="bg-purple-600 hover:bg-purple-700 w-full">
              {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active conversations */}
      {conversations.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" /> Conversaciones activas
            </CardTitle>
            <p className="text-xs text-gray-400">Reinicia una conversación para que el usuario pueda empezar desde cero.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {conversations.map(c => {
                const stateLabel: Record<string, string> = {
                  ASKED_OPTIN: "Esperando resp.",
                  ASKED_INTENT: "Pregunta A/B/C",
                  ASKED_NAME: "Esperando nombre",
                  ASKED_EMAIL: "Esperando email",
                  ASKED_PHONE: "Esperando teléfono",
                  COMPLETE: "Completado",
                  OPTED_OUT: "Desuscrito",
                }
                const stateColor: Record<string, string> = {
                  ASKED_OPTIN: "bg-yellow-100 text-yellow-700",
                  ASKED_INTENT: "bg-blue-100 text-blue-700",
                  ASKED_NAME: "bg-purple-100 text-purple-700",
                  ASKED_EMAIL: "bg-pink-100 text-pink-700",
                  ASKED_PHONE: "bg-orange-100 text-orange-700",
                  COMPLETE: "bg-green-100 text-green-700",
                  OPTED_OUT: "bg-gray-100 text-gray-500",
                }
                const displayName = c.firstName || (c.igUsername ? `@${c.igUsername}` : c.igUserId.slice(0, 10) + "…")
                return (
                  <div key={c.igUserId} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{displayName}</span>
                        <Badge className={cn("text-xs", stateColor[c.state] || "bg-gray-100 text-gray-500")}>
                          {stateLabel[c.state] || c.state}
                        </Badge>
                        {c.campaignKeyword && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs font-mono uppercase">{c.campaignKeyword}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.email || c.phone || `ID: ${c.igUserId.slice(0, 12)}…`} · {new Date(c.updatedAt).toLocaleString("es")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.contactId && (
                        <a href={`/contacts/${c.contactId}`} className="text-xs text-purple-600 hover:underline">Ver contacto</a>
                      )}
                      <button
                        onClick={() => resetConversation(c.igUserId)}
                        disabled={resettingConvo === c.igUserId}
                        title="Reiniciar conversación"
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <RefreshCw className={cn("w-4 h-4", resettingConvo === c.igUserId && "animate-spin")} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent leads */}
      {stats?.recentLeads?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" /> Leads recientes de Instagram
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {stats.recentLeads.map((lead: any) => (
                <div key={lead.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{lead.firstName || "Unknown"}</p>
                    <p className="text-xs text-gray-500">
                      {lead.igUsername ? `@${lead.igUsername}` : lead.igUserId} · {lead.email || "No email"} · {lead.phone || "No phone"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString("es")}</span>
                    {lead.contactId && (
                      <a href={`/contacts/${lead.contactId}`} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
