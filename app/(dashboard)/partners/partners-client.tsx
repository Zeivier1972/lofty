"use client"

import { useState, useEffect, useCallback } from "react"
import { Landmark, Plus, Loader2, Copy, Check, DollarSign, Users, TrendingUp, KeyRound, Trash2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface Partner {
  id: string
  name: string
  email: string
  company: string | null
  phone: string | null
  isActive: boolean
  monthlyFee: number
  subscriptionStatus: string
  subscriptionEndDate: string | null
  totalShares: number
  paidShares: number
  legacyRevenue: number
}

const SUB_STATUS: Record<string, { label: string; color: string; Icon: any }> = {
  active:   { label: "Activa",    color: "text-green-600 bg-green-50 border-green-200", Icon: CheckCircle2 },
  past_due: { label: "Vencida",   color: "text-red-600 bg-red-50 border-red-200",       Icon: AlertCircle },
  canceled: { label: "Cancelada", color: "text-gray-500 bg-gray-50 border-gray-200",    Icon: XCircle },
  inactive: { label: "Inactiva",  color: "text-gray-400 bg-gray-50 border-gray-200",    Icon: XCircle },
}

export default function PartnersClient() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string; url: string } | null>(null)
  const { toast } = useToast()

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partners")
      const data = await res.json()
      setPartners(data.partners || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  async function toggleActive(p: Partner) {
    await fetch(`/api/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    fetchPartners()
  }

  async function updateFee(p: Partner, fee: number) {
    await fetch(`/api/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyFee: fee }),
    })
    fetchPartners()
    toast({ title: "Cuota actualizada", description: `$${fee}/mes para ${p.name}` })
  }

  async function cancelSubscription(p: Partner) {
    if (!confirm(`¿Cancelar la suscripción de ${p.name}? Perderá acceso al finalizar el período.`)) return
    await fetch(`/api/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelSubscription: true }),
    })
    fetchPartners()
    toast({ title: "Suscripción cancelada" })
  }

  async function resetPassword(p: Partner) {
    const res = await fetch(`/api/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    })
    const data = await res.json()
    if (data.tempPassword) {
      setCredentials({ email: p.email, password: data.tempPassword, url: `${window.location.origin}/lender/login` })
    }
  }

  async function deletePartner(p: Partner) {
    if (!confirm(`¿Eliminar a ${p.name}? Se borrarán también sus leads compartidos.`)) return
    await fetch(`/api/partners/${p.id}`, { method: "DELETE" })
    fetchPartners()
  }

  const activeCount = partners.filter(p => p.subscriptionStatus === "active").length
  const monthlyRevenue = partners
    .filter(p => p.subscriptionStatus === "active")
    .reduce((s, p) => s + p.monthlyFee, 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" />
            Loan Officers
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Suscripción mensual por acceso al portal de leads</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" /> Agregar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <Users className="w-4 h-4 text-indigo-500 mb-1.5" />
          <p className="text-xl font-bold text-gray-900">{partners.length}</p>
          <p className="text-xs text-gray-400">Partners</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <CheckCircle2 className="w-4 h-4 text-green-500 mb-1.5" />
          <p className="text-xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-400">Suscritos activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <DollarSign className="w-4 h-4 text-green-500 mb-1.5" />
          <p className="text-xl font-bold text-gray-900">${monthlyRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Ingresos/mes</p>
        </div>
      </div>

      {/* Partner list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Landmark className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Agrega tu primer loan officer para empezar a compartir leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => {
            const sub = SUB_STATUS[p.subscriptionStatus] || SUB_STATUS.inactive
            return (
              <div key={p.id} className={cn("bg-white rounded-2xl border p-4", p.isActive ? "border-gray-100" : "border-gray-100 opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.name}
                        {!p.isActive && <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">INACTIVO</span>}
                      </p>
                      <span className={cn("flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5", sub.color)}>
                        <sub.Icon className="w-3 h-3" /> {sub.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{p.email}{p.company ? ` · ${p.company}` : ""}</p>
                    {p.subscriptionEndDate && p.subscriptionStatus === "active" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Renueva: {new Date(p.subscriptionEndDate).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{p.totalShares} leads compartidos</span>
                    <span className="text-indigo-600 font-semibold">${p.monthlyFee}/mes</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                  <label className="text-xs text-gray-400">Cuota mensual:</label>
                  <input
                    type="number"
                    defaultValue={p.monthlyFee}
                    onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== p.monthlyFee) updateFee(p, v) }}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <div className="flex-1" />
                  {p.subscriptionStatus !== "active" && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/partners/${p.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ subscriptionStatus: "active" }),
                        })
                        fetchPartners()
                        toast({ title: "Acceso activado", description: `${p.name} ahora tiene acceso completo` })
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium"
                    >
                      Dar acceso gratis
                    </button>
                  )}
                  {p.subscriptionStatus === "active" && (
                    <button onClick={() => cancelSubscription(p)} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Cancelar suscripción
                    </button>
                  )}
                  <button onClick={() => resetPassword(p)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
                    <KeyRound className="w-3.5 h-3.5" /> Reset clave
                  </button>
                  <button onClick={() => toggleActive(p)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {p.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => deletePartner(p)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddPartnerModal onClose={() => setShowAdd(false)} onCreated={(c) => { setCredentials(c); fetchPartners() }} />}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  )
}

function AddPartnerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { email: string; password: string; url: string }) => void }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", monthlyFee: "99" })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function handleSave() {
    if (!form.name || !form.email) return
    setSaving(true)
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.tempPassword) {
        onCreated({ email: data.partner.email, password: data.tempPassword, url: data.portalUrl })
        onClose()
      } else {
        toast({ title: "Error", description: data.error || "No se pudo crear", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-gray-900">Nuevo Loan Officer</p>
        {[
          { key: "name",       label: "Nombre completo *",        type: "text" },
          { key: "email",      label: "Email *",                  type: "email" },
          { key: "company",    label: "Compañía",                 type: "text" },
          { key: "phone",      label: "Teléfono",                 type: "tel" },
          { key: "monthlyFee", label: "Cuota mensual (USD)",      type: "number" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
            <input
              type={f.type}
              value={(form as any)[f.key]}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.email} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CredentialsModal({ credentials, onClose }: { credentials: { email: string; password: string; url: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = `Portal de Leads — Catherine Gomez Realtor\n${credentials.url}\nEmail: ${credentials.email}\nContraseña: ${credentials.password}`

  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-gray-900">🔑 Credenciales de acceso</p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Guarda esta contraseña ahora — no se volverá a mostrar. Envíasela al loan officer.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 font-mono">
          <p className="text-gray-500 text-xs">{credentials.url}</p>
          <p><span className="text-gray-400">Email:</span> {credentials.email}</p>
          <p><span className="text-gray-400">Clave:</span> <span className="font-bold">{credentials.password}</span></p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copiado" : "Copiar todo"}
          </Button>
          <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">Listo</Button>
        </div>
      </div>
    </div>
  )
}
