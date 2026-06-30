"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  CheckCircle2, RefreshCw, Plug, Zap, AlertCircle, XCircle, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count: number
}

interface FacebookAccount {
  id: string
  accountName: string
  pageId: string
  subscribedToLeads: boolean
  createdAt: string
  forms: LeadForm[]
}

const OAUTH_ERRORS: Record<string, string> = {
  fb_denied: "Permisos de Facebook denegados. Intenta de nuevo y acepta todos los permisos.",
  no_pages: "No se encontraron páginas de Facebook. Asegúrate de ser administrador de tu página.",
  fb_error: "Error conectando Facebook. Intenta de nuevo.",
  fb_token_failed: "Error obteniendo el token de Facebook. Verifica tus credenciales de la app.",
  missing_fb_app_id: "Agrega FACEBOOK_APP_ID y FACEBOOK_APP_SECRET en Railway Variables.",
}

export default function IntegrationsClient() {
  const [fbAccounts, setFbAccounts] = useState<FacebookAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualToken, setManualToken] = useState("")
  const [savingManual, setSavingManual] = useState(false)
  const [manualError, setManualError] = useState("")
  const [syncingForm, setSyncingForm] = useState<string | null>(null)
  const { toast } = useToast()

  async function syncFormLeads(formId: string, formName: string) {
    setSyncingForm(formId)
    try {
      const res = await fetch("/api/facebook/sync-form-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, formName }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "No se pudo importar", variant: "destructive" })
      } else {
        toast({ title: `✅ ${data.imported} leads importados`, description: `${data.skipped} ya existían en el CRM` })
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setSyncingForm(null)
    }
  }
  const searchParams = useSearchParams()

  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    if (success === "facebook") {
      toast({ title: "¡Facebook conectado!", description: "Tu página está lista para recibir leads automáticamente." })
    } else if (error) {
      toast({ title: "Error de conexión", description: OAUTH_ERRORS[error] || "Error desconocido.", variant: "destructive" })
    }
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const res = await fetch("/api/integrations/facebook")
      const data = await res.json()
      setFbAccounts(data.accounts || [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  async function saveManualToken() {
    if (!manualToken.trim()) {
      toast({ title: "Pega tu User Token", variant: "destructive" })
      return
    }
    setSavingManual(true)
    setManualError("")
    try {
      const res = await fetch("/api/integrations/facebook/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: manualToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setManualError(data.error || "Error desconocido")
        setSavingManual(false)
        return
      }
      // Force full reload so connected state is guaranteed fresh
      window.location.href = "/integrations?success=facebook"
    } catch {
      setManualError("Error de red. Intenta de nuevo.")
    }
    setSavingManual(false)
  }

  async function disconnect(pageId: string) {
    setDisconnecting(pageId)
    await fetch(`/api/integrations/facebook?pageId=${pageId}`, { method: "DELETE" })
    await loadStatus()
    setDisconnecting(null)
    toast({ title: "Desconectado", description: "Página de Facebook desconectada del CRM." })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"
  const webhookUrl = `${appUrl}/api/leads/facebook`
  const isConnected = fbAccounts.length > 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
        <p className="text-gray-500 mt-1">Conecta tus herramientas de marketing para capturar leads automáticamente.</p>
      </div>

      {/* Facebook Lead Ads */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xl leading-none">f</span>
              </div>
              <div>
                <CardTitle className="text-base">Facebook Lead Ads</CardTitle>
                <p className="text-sm text-gray-500">Captura leads de tus campañas directo al CRM</p>
              </div>
            </div>
            {!loading && (
              <Badge className={isConnected ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                {isConnected ? "Conectado" : "No conectado"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando conexión...</span>
            </div>
          ) : !isConnected ? (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Cómo funciona
                </p>
                <ol className="text-sm text-blue-700 space-y-1.5 pl-2">
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">1.</span>Conectas tu cuenta de Facebook</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">2.</span>Autorizamos tu página de negocios</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">3.</span>Cuando alguien llena tu formulario de Lead Ad, el lead entra al CRM en segundos</li>
                  <li className="flex items-start gap-2"><span className="font-bold mt-0.5">4.</span>Sofia lo llama automáticamente (si está activada en AI Agent)</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => { window.location.href = "/api/auth/facebook" }}
                  className="bg-[#1877F2] hover:bg-[#1464d8] text-white"
                >
                  <Plug className="w-4 h-4 mr-2" />
                  Conectar Facebook
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowManual(!showManual)} className="text-gray-600 text-xs">
                  Conectar manualmente
                </Button>
              </div>

              {showManual && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Conexión manual con User Token</p>
                  <ol className="text-xs text-gray-500 space-y-1 pl-2">
                    <li className="flex gap-2"><span className="font-bold">1.</span>Ve a <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Graph API Explorer</a></li>
                    <li className="flex gap-2"><span className="font-bold">2.</span>Selecciona tu app en el menú superior derecho</li>
                    <li className="flex gap-2"><span className="font-bold">3.</span>En "User or Page" selecciona <strong>User Token</strong></li>
                    <li className="flex gap-2"><span className="font-bold">4.</span>Haz clic en "Generate Access Token" y acepta los permisos</li>
                    <li className="flex gap-2"><span className="font-bold">5.</span>Copia el token y pégalo aquí</li>
                  </ol>
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    El sistema automáticamente lo convierte en un token permanente — no expira.
                  </p>
                  <Input
                    placeholder="Pega tu User Token aquí (EAAxxxx...)"
                    value={manualToken}
                    onChange={e => { setManualToken(e.target.value); setManualError("") }}
                    className="text-xs font-mono"
                  />
                  {manualError && <p className="text-xs text-red-600">{manualError}</p>}
                  <Button onClick={saveManualToken} disabled={savingManual} size="sm" className="w-full">
                    {savingManual ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                    {savingManual ? "Conectando..." : "Guardar y conectar"}
                  </Button>
                </div>
              )}

              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Configuración única en Meta for Developers
                </p>
                <p className="text-sm text-amber-700">
                  En{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Meta for Developers
                  </a>{" "}
                  → tu app → Webhooks:
                </p>
                <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex gap-2">
                    <span className="text-amber-600 font-sans font-semibold min-w-[110px]">Callback URL:</span>
                    <span className="text-gray-700 break-all">{webhookUrl}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-600 font-sans font-semibold min-w-[110px]">Verify Token:</span>
                    <span className="text-gray-500 font-sans italic">valor de FB_VERIFY_TOKEN en Railway</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-600 font-sans font-semibold min-w-[110px]">Fields:</span>
                    <span className="text-gray-700">leadgen ✓</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600">
                  También necesitas <code className="bg-amber-100 px-1 rounded">FACEBOOK_APP_ID</code> y{" "}
                  <code className="bg-amber-100 px-1 rounded">FACEBOOK_APP_SECRET</code> en Railway Variables.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {fbAccounts.map((account) => (
                <div key={account.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">{account.accountName}</p>
                        <p className="text-xs text-gray-400">Page ID: {account.pageId}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect(account.pageId)}
                      disabled={disconnecting === account.pageId}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {disconnecting === account.pageId
                        ? <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                        : <XCircle className="w-3 h-3 mr-1" />}
                      Desconectar
                    </Button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-gray-400" />
                        Formularios de Lead Ads
                        {account.forms.filter(f => f.leads_count > 0).length > 0 && <span className="text-xs font-normal text-gray-400">({account.forms.filter(f => f.leads_count > 0).length})</span>}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => { setRefreshing(true); loadStatus() }} disabled={refreshing} className="h-7 text-xs text-gray-500">
                        <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                        Actualizar
                      </Button>
                    </div>

                    {account.forms.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                        No se encontraron formularios activos. Crea un anuncio de <strong>"Generación de leads"</strong> en Ads Manager.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {account.forms.filter(f => f.leads_count > 0).map((form) => (
                          <div key={form.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{form.name}</p>
                              <p className="text-xs text-gray-400">{form.leads_count ? `${form.leads_count} leads recibidos` : "Sin leads aún"}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <Badge className={form.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                                {form.status === "ACTIVE" ? "Activo" : form.status}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs px-2"
                                disabled={syncingForm === form.id}
                                onClick={() => syncFormLeads(form.id, form.name)}
                              >
                                {syncingForm === form.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Importar"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coming soon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { name: "Google Ads Lead Forms", color: "#4285F4", letter: "G", desc: "Captura leads de Google Ads" },
          { name: "Zillow Premier Agent", color: "#006AFF", letter: "Z", desc: "Importa leads de Zillow" },
        ].map((item) => (
          <Card key={item.name} className="border-0 shadow-sm opacity-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color }}>
                  <span className="text-white font-bold text-sm">{item.letter}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs flex-shrink-0">Próximamente</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
