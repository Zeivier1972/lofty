"use client"

import { useState, useEffect } from "react"
import { Facebook, Zap, Users, CheckCircle2, MessageSquare, Copy, AlertCircle, Plus, Trash2, Link2, FileText, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

export default function FacebookBotClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ keyword: "", name: "", pdfUrl: "", pdfName: "", greeting: "" })
  const [savingCampaign, setSavingCampaign] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/facebook/bot-config").then(r => r.json()),
      fetch("/api/facebook/bot-campaigns").then(r => r.json()),
    ]).then(([cfg, camps]) => {
      setConfig(cfg.config)
      setStats(cfg.stats)
      setCampaigns(Array.isArray(camps) ? camps : [])
    }).finally(() => setLoading(false))
  }, [])

  const save = async (updatedConfig = config) => {
    setSaving(true)
    try {
      const res = await fetch("/api/facebook/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      })
      if (!res.ok) throw new Error()
      toast({ title: "✅ Configuración guardada" })
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = () => {
    const updated = { ...config, isEnabled: !config.isEnabled }
    setConfig(updated)
    save(updated)
  }

  const addCampaign = async () => {
    if (!newCampaign.keyword.trim() || !newCampaign.name.trim()) {
      toast({ title: "Keyword y nombre son requeridos", variant: "destructive" })
      return
    }
    setSavingCampaign(true)
    try {
      const res = await fetch("/api/facebook/bot-campaigns", {
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

  const deleteCampaign = async (id: string) => {
    try {
      await fetch("/api/facebook/bot-campaigns", {
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

  const webhookUrl = `${APP_URL}/api/facebook/webhook`
  const verifyToken = "lofty_fb_verify"

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="p-6 space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center">
            <Facebook className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facebook Lead Bot</h1>
            <p className="text-sm text-gray-500">Captura leads desde comentarios y Messenger con campañas personalizadas</p>
          </div>
        </div>
        {config && (
          <button
            onClick={toggleEnabled}
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Conversaciones", value: stats?.totalConversations || 0, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
          { label: "Leads capturados", value: stats?.captured || 0, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Esta semana", value: stats?.thisWeek || 0, icon: Zap, color: "text-purple-600 bg-purple-50" },
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
            <li>Ve a <strong>developers.facebook.com</strong> → tu App → Webhooks → Page</li>
            <li>Copia la <strong>Webhook URL</strong> y el <strong>Verify Token</strong> de abajo</li>
            <li>Suscríbete a los campos: <code className="bg-amber-100 px-1 rounded">messages</code>, <code className="bg-amber-100 px-1 rounded">feed</code>, <code className="bg-amber-100 px-1 rounded">leadgen</code></li>
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
            <p className="text-xs font-semibold text-amber-700 mb-1">Variables de entorno en Railway:</p>
            <div className="bg-amber-100 rounded-lg p-2 font-mono text-xs space-y-1">
              <p>FB_PAGE_ACCESS_TOKEN=<span className="text-amber-600">tu_page_access_token</span></p>
              <p>FB_VERIFY_TOKEN=lofty_fb_verify</p>
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
              { icon: "💬", label: "Alguien comenta una palabra clave en tu post de Facebook", color: "bg-blue-100 text-blue-700" },
              { icon: "📩", label: "Bot envía DM privado por Messenger + respuesta pública al comentario", color: "bg-indigo-100 text-indigo-700" },
              { icon: "🎯", label: "Pregunta A / B / C → intención del lead", color: "bg-violet-100 text-violet-700" },
              { icon: "👤", label: "Pide nombre completo", color: "bg-purple-100 text-purple-700" },
              { icon: "📧", label: "Pide correo electrónico", color: "bg-pink-100 text-pink-700" },
              { icon: "📱", label: "Pide número de teléfono", color: "bg-rose-100 text-rose-700" },
              { icon: "📄", label: "Envía PDF de campaña (si aplica) + propiedades del CRM", color: "bg-orange-100 text-orange-700" },
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

      {/* ── Campaigns section ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Campañas — Keyword → PDF/Brochure
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowNewCampaign(true)}>
              <Plus className="w-3.5 h-3.5" /> Nueva campaña
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Cuando alguien escribe la palabra clave en un DM o comentario, el bot activa ese flujo específico y envía el PDF al final.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaigns.length === 0 && !showNewCampaign && (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No hay campañas aún.</p>
              <p className="text-xs text-gray-300">Ej: keyword "INVEST" → envía el brochure de inversión</p>
            </div>
          )}

          {campaigns.map(c => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-blue-100 text-blue-700 text-xs font-mono uppercase">{c.keyword}</Badge>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  {c.isActive ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">Activa</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 text-xs">Inactiva</Badge>
                  )}
                </div>
                {c.pdfUrl && (
                  <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                    <Link2 className="w-3 h-3" />
                    {c.pdfName || "Ver PDF"}
                  </a>
                )}
                {c.greeting && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">Saludo: {c.greeting}</p>
                )}
                <p className="text-xs text-gray-300 mt-1">{c.leads} leads capturados</p>
              </div>
              <button onClick={() => deleteCampaign(c.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {showNewCampaign && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
              <p className="text-sm font-semibold text-blue-900">Nueva campaña</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Palabra clave *</label>
                  <Input
                    placeholder="INVEST"
                    value={newCampaign.keyword}
                    onChange={e => setNewCampaign(p => ({ ...p, keyword: e.target.value }))}
                    className="uppercase placeholder:normal-case bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Ej: INVEST, BRICKELL, FIRSTHOME</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre de la campaña *</label>
                  <Input
                    placeholder="Inversión Miami 2025"
                    value={newCampaign.name}
                    onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                    className="bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">URL del PDF / Brochure (opcional)</label>
                <Input
                  placeholder="https://res.cloudinary.com/... o cualquier URL pública"
                  value={newCampaign.pdfUrl}
                  onChange={e => setNewCampaign(p => ({ ...p, pdfUrl: e.target.value }))}
                  className="bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre del archivo (se muestra en el mensaje)</label>
                  <Input
                    placeholder="Portafolio de Inversión Miami"
                    value={newCampaign.pdfName}
                    onChange={e => setNewCampaign(p => ({ ...p, pdfName: e.target.value }))}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Saludo personalizado (opcional)</label>
                  <Input
                    placeholder="¡Hola! Vi que te interesa invertir en Miami..."
                    value={newCampaign.greeting}
                    onChange={e => setNewCampaign(p => ({ ...p, greeting: e.target.value }))}
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={addCampaign} disabled={savingCampaign}>
                  {savingCampaign ? "Guardando..." : "Crear campaña"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNewCampaign(false); setNewCampaign({ keyword: "", name: "", pdfUrl: "", pdfName: "", greeting: "" }) }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot message configuration */}
      {config && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Configuración del Bot (flujo general)</CardTitle>
            <p className="text-xs text-gray-400">Las campañas de arriba pueden tener su propio saludo. Este flujo aplica cuando no hay campaña específica.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Palabras clave generales (separadas por coma)
              </label>
              <Input
                value={config.triggerKeywords}
                onChange={e => setConfig({ ...config, triggerKeywords: e.target.value })}
                placeholder="info, precio, interesado, casa"
              />
              <p className="text-xs text-gray-400 mt-1">Palabras que activan el flujo general. Las campañas de arriba tienen prioridad.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">🌐 Página web (se envía al final)</label>
              <Input
                value={config.websiteUrl || ""}
                onChange={e => setConfig({ ...config, websiteUrl: e.target.value })}
                placeholder="https://catherinegomezrealtor.com"
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <button
                onClick={() => setConfig({ ...config, sendListings: !config.sendListings })}
                className={cn(
                  "relative inline-flex h-6 w-10 items-center rounded-full transition-colors flex-shrink-0",
                  config.sendListings ? "bg-blue-500" : "bg-gray-300"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  config.sendListings ? "translate-x-5" : "translate-x-1"
                )} />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-800">Enviar propiedades activas</p>
                <p className="text-xs text-gray-400">Después del gracias, envía hasta 3 propiedades del CRM según el interés del lead</p>
              </div>
            </div>

            {[
              { key: "msgGreeting", label: "🤖 1. Mensaje inicial", hint: "Se envía cuando alguien comenta una palabra clave" },
              { key: "msgAskIntent", label: "🎯 2. Pregunta de calificación (A/B/C)", hint: "A = comprar · B = invertir · C = explorando" },
              { key: "msgAskName", label: "👤 3. Pedir nombre", hint: "" },
              { key: "msgAskEmail", label: "📧 4. Pedir email", hint: "Usa {name} para el nombre" },
              { key: "msgAskPhone", label: "📱 5. Pedir teléfono", hint: "Usa {name} para el nombre" },
              { key: "msgThankYou", label: "✅ 6. Mensaje de gracias", hint: "Usa {name} y {website}" },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{label}</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={config[key] || ""}
                  onChange={e => setConfig({ ...config, [key]: e.target.value })}
                />
                {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
              </div>
            ))}

            <Button onClick={() => save()} disabled={saving} className="w-full">
              {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
