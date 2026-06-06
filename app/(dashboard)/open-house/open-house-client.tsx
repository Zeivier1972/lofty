"use client"

import { useState } from "react"
import {
  Home, Plus, Users, Clock, CheckCircle2, MapPin,
  Phone, Mail, DollarSign, X, QrCode, Download,
  TrendingUp, Calendar, Star, UserCheck, ChevronDown, ChevronUp,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface Property {
  id: string
  address: string
  city: string
  price: number
}

interface OpenHouseVisitor {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  preApproved: boolean
  notes: string | null
  createdAt: string
}

interface OpenHouse {
  id: string
  address: string
  date: string
  endTime: string | null
  notes: string | null
  status: string
  property: Property | null
  visitors: OpenHouseVisitor[]
}

interface Props {
  openHouses: OpenHouse[]
  properties: Property[]
}

export default function OpenHouseClient({ openHouses: initial, properties }: Props) {
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>(initial)
  const [activeOH, setActiveOH] = useState<OpenHouse | null>(null)
  const [showNewOH, setShowNewOH] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [expandedOH, setExpandedOH] = useState<string | null>(null)

  const [newOH, setNewOH] = useState({
    address: "", date: "", endTime: "", notes: "", propertyId: "",
  })

  const [visitorForm, setVisitorForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", preApproved: false, notes: "",
  })
  const [submittingVisitor, setSubmittingVisitor] = useState(false)
  const [visitorSubmitted, setVisitorSubmitted] = useState(false)

  async function createOpenHouse(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/open-house", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOH),
    })
    const oh = await res.json()
    setOpenHouses(prev => [oh, ...prev])
    setShowNewOH(false)
    setNewOH({ address: "", date: "", endTime: "", notes: "", propertyId: "" })
    setActiveOH(oh)
  }

  async function submitVisitor(e: React.FormEvent) {
    e.preventDefault()
    if (!activeOH) return
    setSubmittingVisitor(true)
    try {
      const res = await fetch(`/api/open-house/${activeOH.id}/visitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visitorForm),
      })
      const visitor = await res.json()
      setOpenHouses(prev => prev.map(oh =>
        oh.id === activeOH.id
          ? { ...oh, visitors: [...oh.visitors, visitor] }
          : oh
      ))
      setActiveOH(prev => prev ? { ...prev, visitors: [...prev.visitors, visitor] } : prev)
      setVisitorSubmitted(true)
      setVisitorForm({ firstName: "", lastName: "", email: "", phone: "", preApproved: false, notes: "" })
      setTimeout(() => setVisitorSubmitted(false), 2000)
    } finally {
      setSubmittingVisitor(false)
    }
  }

  const upcoming = openHouses.filter(oh => oh.status === "UPCOMING" || new Date(oh.date) >= new Date())
  const past = openHouses.filter(oh => oh.status !== "UPCOMING" && new Date(oh.date) < new Date())
  const totalVisitors = openHouses.reduce((a, oh) => a + oh.visitors.length, 0)
  const preApprovedCount = openHouses.reduce((a, oh) => a + oh.visitors.filter(v => v.preApproved).length, 0)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Open House Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Digital sign-in, visitor tracking, AI follow-up</p>
        </div>
        <button
          onClick={() => setShowNewOH(true)}
          className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Schedule Open House
        </button>
      </div>

      {/* Stats row */}
      <div className="bg-white border-b px-6 py-4 grid grid-cols-4 gap-4">
        {[
          { label: "Total Open Houses", value: openHouses.length, icon: Home, color: "text-lofty-600" },
          { label: "Upcoming", value: upcoming.length, icon: Calendar, color: "text-blue-600" },
          { label: "Total Visitors", value: totalVisitors, icon: Users, color: "text-green-600" },
          { label: "Pre-Approved Buyers", value: preApprovedCount, icon: UserCheck, color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center", color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Open house list */}
        <div className="w-96 bg-white border-r overflow-y-auto flex-shrink-0">
          {upcoming.length > 0 && (
            <div>
              <div className="px-4 py-3 border-b bg-green-50">
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Upcoming</span>
              </div>
              {upcoming.map(oh => (
                <OpenHouseCard
                  key={oh.id}
                  oh={oh}
                  isActive={activeOH?.id === oh.id}
                  isExpanded={expandedOH === oh.id}
                  onSelect={() => setActiveOH(oh)}
                  onExpand={() => setExpandedOH(expandedOH === oh.id ? null : oh.id)}
                  onSignIn={() => { setActiveOH(oh); setShowSignIn(true) }}
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="px-4 py-3 border-b bg-gray-50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Past</span>
              </div>
              {past.map(oh => (
                <OpenHouseCard
                  key={oh.id}
                  oh={oh}
                  isActive={activeOH?.id === oh.id}
                  isExpanded={expandedOH === oh.id}
                  onSelect={() => setActiveOH(oh)}
                  onExpand={() => setExpandedOH(expandedOH === oh.id ? null : oh.id)}
                  onSignIn={null}
                />
              ))}
            </div>
          )}
          {openHouses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Home className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No open houses yet. Click "Schedule Open House" to create your first.</p>
            </div>
          )}
        </div>

        {/* Right: Detail / Sign-in panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeOH ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Open House header */}
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{activeOH.address}</h2>
                    <div className="flex items-center gap-2 mt-1 text-gray-500 text-sm">
                      <Calendar className="w-4 h-4" />
                      {new Date(activeOH.date).toLocaleDateString("en-US", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                      })}
                      {activeOH.endTime && (
                        <>
                          <span>—</span>
                          <Clock className="w-4 h-4" />
                          {new Date(activeOH.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </>
                      )}
                    </div>
                    {activeOH.property && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Home className="w-4 h-4 text-lofty-500" />
                        <span className="text-lofty-700 font-medium">{formatCurrency(activeOH.property.price)}</span>
                        <span className="text-gray-500">{activeOH.property.city}</span>
                      </div>
                    )}
                    {activeOH.notes && <p className="text-sm text-gray-500 mt-2">{activeOH.notes}</p>}
                  </div>
                  <button
                    onClick={() => setShowSignIn(!showSignIn)}
                    className="flex items-center gap-2 px-4 py-2 bg-lofty-600 text-white rounded-lg hover:bg-lofty-700 text-sm font-medium"
                  >
                    <UserCheck className="w-4 h-4" />
                    {showSignIn ? "Close Sign-In" : "Open Sign-In"}
                  </button>
                </div>
              </div>

              {/* Sign-in form */}
              {showSignIn && (
                <div className="bg-gradient-to-br from-lofty-600 to-lofty-900 rounded-2xl p-6 text-white shadow-xl">
                  <div className="text-center mb-5">
                    <QrCode className="w-8 h-8 mx-auto mb-2 opacity-80" />
                    <h3 className="text-xl font-bold">Welcome!</h3>
                    <p className="text-lofty-200 text-sm mt-1">Please sign in to receive property updates and exclusive listings</p>
                    <p className="text-lofty-200 text-xs mt-0.5">¡Bienvenido! Por favor regístrese para recibir actualizaciones de propiedades</p>
                  </div>
                  {visitorSubmitted ? (
                    <div className="bg-green-400/20 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
                      <p className="font-semibold">Signed in! Welcome!</p>
                      <p className="text-sm opacity-80">You'll receive a follow-up shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={submitVisitor} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-lofty-200 mb-1 block">First Name / Nombre *</label>
                          <input
                            required
                            value={visitorForm.firstName}
                            onChange={e => setVisitorForm(f => ({ ...f, firstName: e.target.value }))}
                            className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-lofty-300 focus:outline-none focus:border-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-lofty-200 mb-1 block">Last Name / Apellido *</label>
                          <input
                            required
                            value={visitorForm.lastName}
                            onChange={e => setVisitorForm(f => ({ ...f, lastName: e.target.value }))}
                            className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-lofty-300 focus:outline-none focus:border-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-lofty-200 mb-1 block">Email</label>
                        <input
                          type="email"
                          value={visitorForm.email}
                          onChange={e => setVisitorForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-lofty-300 focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-lofty-200 mb-1 block">Phone / Teléfono</label>
                        <input
                          type="tel"
                          value={visitorForm.phone}
                          onChange={e => setVisitorForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-lofty-300 focus:outline-none focus:border-white"
                        />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visitorForm.preApproved}
                          onChange={e => setVisitorForm(f => ({ ...f, preApproved: e.target.checked }))}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-lofty-200">I am pre-approved / Estoy pre-aprobado</span>
                      </label>
                      <button
                        type="submit"
                        disabled={submittingVisitor}
                        className="w-full py-3 bg-white text-lofty-700 rounded-xl font-bold hover:bg-lofty-50 transition-colors disabled:opacity-60"
                      >
                        {submittingVisitor ? "Signing in..." : "Sign In / Registrarse"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Visitor list */}
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    Visitors ({activeOH.visitors.length})
                  </h3>
                  {activeOH.visitors.filter(v => v.preApproved).length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                      {activeOH.visitors.filter(v => v.preApproved).length} pre-approved
                    </span>
                  )}
                </div>
                {activeOH.visitors.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No visitors yet. Use the sign-in form to check in guests.</p>
                ) : (
                  <div className="space-y-2">
                    {activeOH.visitors.map(v => (
                      <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                        <div className="w-9 h-9 bg-lofty-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-lofty-700">{v.firstName[0]}{v.lastName[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{v.firstName} {v.lastName}</span>
                            {v.preApproved && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Pre-approved</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            {v.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</span>}
                            {v.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Home className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Select an open house</h3>
              <p className="text-sm text-gray-500">Choose from the list or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* New Open House Modal */}
      {showNewOH && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Schedule Open House</h2>
              <button onClick={() => setShowNewOH(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createOpenHouse} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Property</label>
                <select
                  value={newOH.propertyId}
                  onChange={e => {
                    const prop = properties.find(p => p.id === e.target.value)
                    setNewOH(f => ({ ...f, propertyId: e.target.value, address: prop ? `${prop.address}, ${prop.city}` : f.address }))
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                >
                  <option value="">— Select a property —</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.address}, {p.city} — {formatCurrency(p.price)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Address *</label>
                <input
                  required
                  value={newOH.address}
                  onChange={e => setNewOH(f => ({ ...f, address: e.target.value }))}
                  placeholder="123 Main St, Miami, FL 33101"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={newOH.date}
                    onChange={e => setNewOH(f => ({ ...f, date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">End Time</label>
                  <input
                    type="datetime-local"
                    value={newOH.endTime}
                    onChange={e => setNewOH(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea
                  rows={2}
                  value={newOH.notes}
                  onChange={e => setNewOH(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Parking notes, entry instructions..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewOH(false)} className="flex-1 py-2.5 border rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 text-sm">
                  Create Open House
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function OpenHouseCard({ oh, isActive, isExpanded, onSelect, onExpand, onSignIn }: {
  oh: OpenHouse
  isActive: boolean
  isExpanded: boolean
  onSelect: () => void
  onExpand: () => void
  onSignIn: (() => void) | null
}) {
  return (
    <div
      className={cn(
        "border-b cursor-pointer hover:bg-gray-50 transition-colors",
        isActive && "bg-lofty-50 border-l-2 border-l-lofty-600"
      )}
      onClick={onSelect}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-lofty-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-lofty-700">
              {new Date(oh.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
            </span>
            <span className="text-lg font-black text-lofty-800 leading-none">
              {new Date(oh.date).getDate()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{oh.address}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(oh.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {oh.endTime && ` — ${new Date(oh.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Users className="w-3 h-3" /> {oh.visitors.length}
              </span>
              {oh.visitors.filter(v => v.preApproved).length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  {oh.visitors.filter(v => v.preApproved).length} pre-approved
                </span>
              )}
            </div>
          </div>
          {onSignIn && (
            <button
              onClick={e => { e.stopPropagation(); onSignIn() }}
              className="flex-shrink-0 px-2.5 py-1 bg-lofty-600 text-white rounded text-xs font-medium hover:bg-lofty-700"
            >
              Sign-in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
