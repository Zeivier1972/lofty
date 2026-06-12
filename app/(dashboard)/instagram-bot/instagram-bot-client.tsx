"use client"

import { useState, useEffect } from "react"
import { Instagram, Zap, Users, CheckCircle2, MessageSquare, Copy, ExternalLink, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

export default function InstagramBotClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch("/api/instagram/config")
      .then(r => r.json())
      .then(d => { setConfig(d.config); setStats(d.stats) })
      .finally(() => setLoading(false))
  }, [])

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
