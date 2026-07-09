"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Plus, GitBranch, DollarSign, Settings,
  MoreVertical, Phone, Mail, Calendar, ChevronDown,
  Pencil, Trash2, Check, Loader2, CheckSquare, Square,
  MoveRight, UserPlus, Search, X, Clock, Flame, SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import HelpPanel from "@/components/help-panel"

interface PipelineClientProps {
  pipeline: any
  allPipelines: any[]
}

function ManageStages({
  pipelineId,
  stages: parentStages,
  onSaved,
}: {
  pipelineId: string
  stages: any[]
  onSaved: (stages: any[]) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [stages, setStages] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setStages(parentStages.map(s => ({ ...s })))
      setEditingId(null)
      setEditName("")
      setNewName("")
    } else {
      onSaved(stages)
    }
    setOpen(v)
  }

  const startEdit = (stage: any) => { setEditingId(stage.id); setEditName(stage.name) }

  const saveRename = async (id: string) => {
    if (!editName.trim()) return
    setSaving(id)
    try {
      const res = await fetch(`/api/pipeline/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) throw new Error()
      setStages(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim() } : s))
      setEditingId(null)
      toast({ title: "Stage renamed" })
    } catch {
      toast({ title: "Failed to rename stage", variant: "destructive" })
    } finally { setSaving(null) }
  }

  const deleteStage = async (id: string) => {
    if (!confirm("Delete this stage? Leads in it will also be removed from the pipeline.")) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/pipeline/stages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setStages(prev => prev.filter(s => s.id !== id))
      toast({ title: "Stage deleted" })
    } catch {
      toast({ title: "Failed to delete stage", variant: "destructive" })
    } finally { setDeleting(null) }
  }

  const addStage = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, name: newName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setStages(prev => [...prev, { ...data, leads: [] }])
      setNewName("")
      toast({ title: "Stage added" })
    } catch (e: any) {
      toast({ title: e.message || "Failed to add stage", variant: "destructive" })
    } finally { setAdding(false) }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" /> Manage Stages
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Stages</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              {editingId === stage.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveRename(stage.id)}
                  className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-800">{stage.name}</span>
              )}
              <span className="text-xs text-gray-400 flex-shrink-0">{stage.leads?.length ?? 0} leads</span>
              {editingId === stage.id ? (
                <button type="button" onClick={() => saveRename(stage.id)} disabled={!!saving} className="p-1 text-green-600 hover:bg-green-50 rounded-lg">
                  {saving === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <button type="button" onClick={() => startEdit(stage)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={() => deleteStage(stage.id)} disabled={deleting === stage.id} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                {deleting === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Add new stage</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addStage()}
              placeholder="Stage name…"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <Button type="button" onClick={addStage} disabled={adding || !newName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Contacts Dialog ───────────────────────────────────────────────────────
function AddContactsDialog({ stageId, stageName, onAdded }: {
  stageId: string
  stageName: string
  onAdded: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&limit=20`)
      const data = await res.json()
      setResults(data.contacts || data || [])
    } catch { setResults([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleAdd = async () => {
    if (!selected.size) return
    setAdding(true)
    try {
      const res = await fetch("/api/pipeline/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selected), stageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `${data.added} contact${data.added !== 1 ? "s" : ""} added to ${stageName}` })
      setOpen(false)
      setSelected(new Set())
      setQuery("")
      onAdded()
    } catch (e: any) {
      toast({ title: e.message || "Failed to add contacts", variant: "destructive" })
    } finally { setAdding(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setQuery(""); setResults([]); setSelected(new Set()) } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-7 h-7" title="Add contacts to stage">
          <UserPlus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contacts to "{stageName}"</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
          {searching && <p className="text-sm text-gray-400 text-center py-4"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Searching…</p>}
          {!searching && query && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No contacts found</p>
          )}
          {!searching && !query && (
            <p className="text-sm text-gray-400 text-center py-4">Type a name, email or phone to search</p>
          )}
          {results.map(c => (
            <button key={c.id} type="button" onClick={() => toggle(c.id)}
              className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors", selected.has(c.id) ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50 border border-transparent")}>
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", selected.has(c.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300")}>
                {selected.has(c.id) && <Check className="w-3 h-3 text-white" />}
              </div>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(`${c.firstName} ${c.lastName}`)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{c.email || c.phone || ""}</p>
              </div>
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">{selected.size} selected</span>
            <Button onClick={handleAdd} disabled={adding} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to {stageName}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function daysAgo(date: string | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

// Where a lead came from → a short label + brand color, so you can tell a fresh
// Facebook lead from a website or imported one at a glance (no tag-filtering).
function sourceBadge(source: string | null | undefined): { label: string; bg: string; color: string } {
  const s = (source || "").toUpperCase()
  if (s.includes("FACEBOOK") || s === "FB") return { label: "Facebook", bg: "#E7F0FF", color: "#1877F2" }
  if (s.includes("INSTAGRAM") || s === "IG") return { label: "Instagram", bg: "#FCE7F3", color: "#C2185B" }
  if (s.includes("GOOGLE")) return { label: "Google", bg: "#FCE8E6", color: "#D93025" }
  if (s.includes("IDX") || s.includes("HOMES")) return { label: "Website", bg: "#E6F4EA", color: "#137333" }
  if (s.includes("WEBSITE") || s === "WEB") return { label: "Import", bg: "#F1F5F9", color: "#475569" }
  if (s.includes("ZAPIER")) return { label: "Zapier", bg: "#FEEFE6", color: "#EA580C" }
  if (s.includes("MANYCHAT")) return { label: "ManyChat", bg: "#E0F2FE", color: "#0369A1" }
  if (s.includes("WHATSAPP")) return { label: "WhatsApp", bg: "#E6F4EA", color: "#128C7E" }
  if (s.includes("SMS") || s.includes("TEXT")) return { label: "SMS", bg: "#EDE9FE", color: "#6D28D9" }
  if (s.includes("IMPORT") || s.includes("CSV")) return { label: "Import", bg: "#F1F5F9", color: "#475569" }
  if (s.includes("REFERRAL")) return { label: "Referral", bg: "#FEF3C7", color: "#B45309" }
  if (!s || s === "MANUAL") return { label: "Manual", bg: "#F1F5F9", color: "#64748B" }
  return { label: source!.charAt(0) + source!.slice(1).toLowerCase(), bg: "#F1F5F9", color: "#475569" }
}

// Compact arrival date: "Today", "Yesterday", or "Jul 8"
function arrivalLabel(date: string | null | undefined): string | null {
  if (!date) return null
  const d = daysAgo(date)
  if (d === null) return null
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function LeadEditPanel({ lead, onClose, onSaved }: {
  lead: any
  onClose: () => void
  onSaved: (updated: any) => void
}) {
  const { toast } = useToast()
  const [value, setValue] = useState<string>(lead.value != null ? String(lead.value) : "")
  const [probability, setProbability] = useState<string>(lead.probability != null ? String(lead.probability) : "")
  const [expectedClose, setExpectedClose] = useState<string>(lead.expectedClose ? lead.expectedClose.slice(0, 10) : "")
  const [notes, setNotes] = useState<string>(lead.notes || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/pipeline/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: value !== "" ? Number(value) : null,
          probability: probability !== "" ? Number(probability) : null,
          expectedClose: expectedClose ? new Date(expectedClose).toISOString() : null,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved({
        ...lead,
        value: value !== "" ? Number(value) : null,
        probability: probability !== "" ? Number(probability) : null,
        expectedClose: expectedClose ? new Date(expectedClose).toISOString() : null,
        notes: notes || null,
      })
      toast({ title: "Deal updated" })
      onClose()
    } catch {
      toast({ title: "Failed to save deal", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const inStage = daysAgo(lead.enteredAt)
  const lastSeen = daysAgo(lead.contact.lastContacted)

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-lofty-100 text-lofty-700 text-sm">
                {getInitials(`${lead.contact.firstName} ${lead.contact.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900">{lead.contact.firstName} {lead.contact.lastName}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 font-normal mt-0.5">
                {inStage !== null && (
                  <span className={cn("flex items-center gap-1", inStage > 14 && "text-amber-500 font-medium")}>
                    <Clock className="w-3 h-3" />{inStage}d in stage
                  </span>
                )}
                {lastSeen !== null && (
                  <span className={cn("flex items-center gap-1", lastSeen > 7 && "text-red-400 font-medium")}>
                    <Flame className="w-3 h-3" />{lastSeen === 0 ? "Contacted today" : `Last contact ${lastSeen}d ago`}
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal Value</label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Probability — <span className="text-indigo-600">{probability || 0}%</span>
            </label>
            <input
              type="range" min="0" max="100"
              value={probability || 0}
              onChange={e => setProbability(e.target.value)}
              className="w-full mt-2 accent-indigo-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected Close Date</label>
            <input
              type="date"
              value={expectedClose}
              onChange={e => setExpectedClose(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this deal…"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-between items-center pt-1">
            <a
              href={`/contacts/${lead.contact.id}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              View full contact →
            </a>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PipelineClient({ pipeline, allPipelines }: PipelineClientProps) {
  const { toast } = useToast()
  const [stages, setStages] = useState(pipeline?.stages || [])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [bulkMoving, setBulkMoving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("ALL")
  const [fbNewOnly, setFbNewOnly] = useState(false)
  const [editLead, setEditLead] = useState<any>(null)

  // Distinct sources present across all leads → drives the "Source" filter chips
  const availableSources: string[] = Array.from(
    new Set(stages.flatMap((s: any) => s.leads.map((l: any) => sourceBadge(l.contact.source).label)) as string[])
  ).sort()

  // The "New Leads" stage — where brand-new (unworked) leads land
  const isNewLeadsStage = (s: any) => /new\s*lead/i.test(s?.name || "")

  const q = searchQuery.trim().toLowerCase()
  const filteredStages = (q || sourceFilter !== "ALL" || fbNewOnly)
    ? stages
        // "Facebook · New" shortcut → show only the New Leads column
        .filter((s: any) => !fbNewOnly || isNewLeadsStage(s))
        .map((s: any) => ({
          ...s,
          leads: s.leads.filter((l: any) => {
            const src = sourceBadge(l.contact.source).label
            const matchesSearch = !q ||
              `${l.contact.firstName} ${l.contact.lastName}`.toLowerCase().includes(q) ||
              (l.contact.email || "").toLowerCase().includes(q) ||
              (l.contact.phone || "").includes(searchQuery)
            const matchesSource = sourceFilter === "ALL" || src === sourceFilter
            const matchesFbNew = !fbNewOnly || src === "Facebook"
            return matchesSearch && matchesSource && matchesFbNew
          }),
        }))
    : stages

  const handleLeadUpdated = (updated: any) => {
    setStages((prev: any[]) =>
      prev.map((stage: any) => ({
        ...stage,
        leads: stage.leads.map((l: any) => l.id === updated.id ? { ...l, ...updated } : l),
      }))
    )
  }

  const toggleSelect = (id: string) => setSelectedLeads(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectAll = () => {
    const all = stages.flatMap((s: any) => s.leads.map((l: any) => l.id))
    setSelectedLeads(new Set(all))
  }

  const selectAllInStage = (stageId: string) => {
    const stage = stages.find((s: any) => s.id === stageId)
    if (!stage) return
    const ids = stage.leads.map((l: any) => l.id)
    setSelectedLeads(prev => {
      const next = new Set(prev)
      ids.forEach((id: string) => next.add(id))
      return next
    })
  }

  const clearSelection = () => { setSelectedLeads(new Set()); setSelectMode(false) }

  const bulkMove = async (stageId: string) => {
    if (!selectedLeads.size) return
    setBulkMoving(true)
    try {
      const res = await fetch("/api/pipeline/leads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedLeads), stageId }),
      })
      if (!res.ok) throw new Error()
      const targetStage = stages.find((s: any) => s.id === stageId)
      setStages((prev: any[]) => prev.map((stage: any) => {
        const movedLeads = stage.leads.filter((l: any) => selectedLeads.has(l.id))
        const keptLeads = stage.leads.filter((l: any) => !selectedLeads.has(l.id))
        if (stage.id === stageId) return { ...stage, leads: [...stage.leads.filter((l: any) => !selectedLeads.has(l.id)), ...movedLeads.map((l: any) => ({ ...l, stageId }))] }
        return { ...stage, leads: keptLeads }
      }))
      toast({ title: `${selectedLeads.size} leads moved to ${targetStage?.name}` })
      clearSelection()
    } catch {
      toast({ title: "Failed to move leads", variant: "destructive" })
    } finally { setBulkMoving(false) }
  }

  const bulkDelete = async () => {
    if (!selectedLeads.size) return
    if (!confirm(`Remove ${selectedLeads.size} lead${selectedLeads.size !== 1 ? "s" : ""} from the pipeline?`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch("/api/pipeline/leads/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedLeads) }),
      })
      if (!res.ok) throw new Error()
      setStages((prev: any[]) => prev.map((stage: any) => ({
        ...stage,
        leads: stage.leads.filter((l: any) => !selectedLeads.has(l.id)),
      })))
      toast({ title: `${selectedLeads.size} leads removed from pipeline` })
      clearSelection()
    } catch {
      toast({ title: "Failed to delete leads", variant: "destructive" })
    } finally { setBulkDeleting(false) }
  }

  const reloadPipeline = () => window.location.reload()

  const totalValue = stages.reduce((sum: number, stage: any) =>
    sum + stage.leads.reduce((s: number, l: any) => s + (l.value || 0), 0), 0)
  const totalLeads = stages.reduce((sum: number, stage: any) => sum + stage.leads.length, 0)

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDragging(leadId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(stageId)
  }

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault()
    if (!dragging) return
    setDragOver(null)

    let leadToMove: any = null
    let sourceStageId: string | null = null
    for (const stage of stages) {
      const lead = stage.leads.find((l: any) => l.id === dragging)
      if (lead) { leadToMove = lead; sourceStageId = stage.id; break }
    }
    if (!leadToMove || sourceStageId === targetStageId) return

    setStages((prev: any[]) =>
      prev.map((stage: any) => {
        if (stage.id === sourceStageId) return { ...stage, leads: stage.leads.filter((l: any) => l.id !== dragging) }
        if (stage.id === targetStageId) return { ...stage, leads: [...stage.leads, { ...leadToMove, stageId: targetStageId }] }
        return stage
      })
    )

    try {
      await fetch(`/api/pipeline/leads/${dragging}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: targetStageId }),
      })
      toast({ title: "Lead moved successfully" })
    } catch {
      toast({ title: "Failed to move lead", variant: "destructive" })
    }
    setDragging(null)
  }

  if (!pipeline) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No pipeline configured</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{pipeline.name}</h1>
            <Button variant="ghost" size="icon" className="w-7 h-7">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalLeads} leads · {formatCurrency(totalValue)} total value
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <HelpPanel section="pipeline" />
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            className={cn("gap-2", selectMode && "bg-indigo-600 hover:bg-indigo-700 text-white")}
            onClick={() => { setSelectMode(v => !v); setSelectedLeads(new Set()) }}
          >
            <CheckSquare className="w-4 h-4" />
            {selectMode ? "Cancel Select" : "Select"}
          </Button>
          {selectMode && (
            <Button variant="outline" size="sm" onClick={selectAll} className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              Select All ({totalLeads})
            </Button>
          )}
          <ManageStages
            pipelineId={pipeline.id}
            stages={stages}
            onSaved={(updated) => setStages(updated)}
          />
        </div>
      </div>

      {/* Search bar + one-click Facebook-new shortcut */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search leads…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFbNewOnly(v => !v)}
          title="Show only new Facebook leads in the New Leads stage"
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border transition-colors whitespace-nowrap",
            fbNewOnly
              ? "bg-[#1877F2] text-white border-[#1877F2]"
              : "bg-white text-[#1877F2] border-[#1877F2]/30 hover:bg-[#E7F0FF]"
          )}
        >
          🔵 New Facebook leads
          {fbNewOnly && <X className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Source filter — show only leads from a given channel (e.g. Facebook) */}
      {availableSources.length > 1 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Source:
          </span>
          <button
            onClick={() => setSourceFilter("ALL")}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              sourceFilter === "ALL" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            All
          </button>
          {availableSources.map((label: string) => {
            const b = sourceBadge(label)
            const active = sourceFilter === label
            return (
              <button
                key={label}
                onClick={() => setSourceFilter(active ? "ALL" : label)}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", active ? "border-transparent font-semibold" : "border-gray-200 hover:bg-gray-50")}
                style={active ? { backgroundColor: b.color, color: "#fff" } : { backgroundColor: b.bg, color: b.color }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Stage summary pills */}
      <div className="flex gap-3 mb-5 overflow-x-auto pb-2">
        {stages.map((stage: any) => {
          const stageValue = stage.leads.reduce((s: number, l: any) => s + (l.value || 0), 0)
          return (
            <div key={stage.id} className="flex-shrink-0 bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
              <div>
                <p className="text-xs font-medium text-gray-700">{stage.name}</p>
                <p className="text-xs text-gray-400">{stage.leads.length} leads · {formatCurrency(stageValue)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {filteredStages.map((stage: any) => (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-72 bg-gray-50 rounded-xl border border-gray-200 kanban-column transition-colors flex flex-col max-h-[calc(100vh-260px)]",
              dragOver === stage.id && "border-lofty-400 bg-lofty-50"
            )}
            onDragOver={(e) => !selectMode && handleDragOver(e, stage.id)}
            onDrop={(e) => !selectMode && handleDrop(e, stage.id)}
            onDragLeave={() => setDragOver(null)}
          >
            {/* Column header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-sm font-semibold text-gray-800">{stage.name}</span>
                <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{stage.leads.length}</span>
              </div>
              <div className="flex items-center gap-1">
                {selectMode && stage.leads.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50" onClick={() => selectAllInStage(stage.id)}>
                    All
                  </Button>
                )}
                <AddContactsDialog
                  stageId={stage.id}
                  stageName={stage.name}
                  onAdded={reloadPipeline}
                />
              </div>
            </div>

            {/* Lead cards — scroll within the column so you can reach every lead */}
            <div className="p-2 space-y-2 min-h-16 flex-1 overflow-y-auto">
              {stage.leads.map((lead: any) => {
                const isSelected = selectedLeads.has(lead.id)
                return (
                  <div
                    key={lead.id}
                    draggable={!selectMode}
                    onDragStart={(e) => !selectMode && handleDragStart(e, lead.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => selectMode ? toggleSelect(lead.id) : setEditLead(lead)}
                    className={cn(
                      "bg-white rounded-lg border p-3 transition-all",
                      selectMode ? "cursor-pointer" : "cursor-pointer hover:shadow-md hover:border-indigo-200",
                      dragging === lead.id && "opacity-50",
                      isSelected ? "border-indigo-400 bg-indigo-50 shadow-sm" : "border-gray-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {selectMode ? (
                          <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white")}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        ) : (
                          <Avatar className="w-7 h-7 flex-shrink-0">
                            <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xs">
                              {getInitials(`${lead.contact.firstName} ${lead.contact.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <Link
                          href={`/contacts/${lead.contact.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-lofty-600 truncate"
                          onClick={(e) => { if (selectMode) e.preventDefault(); e.stopPropagation() }}
                        >
                          {lead.contact.firstName} {lead.contact.lastName}
                        </Link>
                      </div>
                      {!selectMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/contacts/${lead.contact.id}`}>View Contact</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={async () => {
                              if (!confirm("Remove from pipeline?")) return
                              await fetch("/api/pipeline/leads/bulk", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [lead.id] }) })
                              setStages((prev: any[]) => prev.map((s: any) => ({ ...s, leads: s.leads.filter((l: any) => l.id !== lead.id) })))
                              toast({ title: "Lead removed from pipeline" })
                            }}>Remove from Pipeline</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Source + arrival date — tell where each lead came from and when */}
                    {(() => {
                      const badge = sourceBadge(lead.contact.source)
                      const arrived = arrivalLabel(lead.contact.createdAt)
                      const daysSince = daysAgo(lead.contact.createdAt)
                      // Only mark NEW while the lead is still in the New Leads column —
                      // once dragged to another stage it's been worked.
                      const isNew = daysSince !== null && daysSince <= 2 && /new\s*lead/i.test(stage.name || "")
                      return (
                        <div className="flex items-center flex-wrap gap-1.5 mt-2">
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                          {arrived && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{arrived}
                            </span>
                          )}
                          {isNew && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-wide">
                              New
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    {lead.contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {lead.contact.tags.slice(0, 2).map((ct: any) => (
                          <span key={ct.tagId} className="text-xs px-1.5 py-0 rounded-full" style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                            {ct.tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Days in stage + last contacted */}
                    {(() => {
                      const inStage = daysAgo(lead.enteredAt)
                      const lastSeen = daysAgo(lead.contact.lastContacted)
                      return (inStage !== null || lastSeen !== null) ? (
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                          {inStage !== null && (
                            <span className={cn("flex items-center gap-1", inStage > 14 && "text-amber-500 font-medium")}>
                              <Clock className="w-3 h-3" />{inStage}d
                            </span>
                          )}
                          {lastSeen !== null && (
                            <span className={cn("flex items-center gap-1", lastSeen > 7 && "text-red-400 font-medium")}>
                              <Flame className="w-3 h-3" />{lastSeen === 0 ? "Today" : `${lastSeen}d`}
                            </span>
                          )}
                        </div>
                      ) : null
                    })()}

                    {lead.value && (
                      <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-green-600">
                        <DollarSign className="w-3.5 h-3.5" />
                        {formatCurrency(lead.value)}
                      </div>
                    )}

                    {lead.probability != null && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
                          <span>Probability</span><span>{lead.probability}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1">
                          <div className="h-1 rounded-full bg-lofty-500 transition-all" style={{ width: `${lead.probability}%` }} />
                        </div>
                      </div>
                    )}

                    {lead.expectedClose && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(lead.expectedClose)}</span>
                      </div>
                    )}

                    {!selectMode && (
                      <div className="mt-2 flex gap-2">
                        {lead.contact.phone && (
                          <a href={`/dialer?contactId=${lead.contact.id}`} className="text-gray-400 hover:text-lofty-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.contact.email && (
                          <a href={`mailto:${lead.contact.email}`} className="text-gray-400 hover:text-lofty-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {stage.leads.length === 0 && (
                <div className="h-16 flex items-center justify-center">
                  <p className="text-xs text-gray-300">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lead edit panel */}
      {editLead && (
        <LeadEditPanel
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => { handleLeadUpdated(updated); setEditLead(null) }}
        />
      )}

      {/* Bulk action bar */}
      {selectMode && selectedLeads.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-fade-in">
          <span className="text-sm font-semibold whitespace-nowrap">{selectedLeads.size} selected</span>
          <div className="w-px h-5 bg-white/20" />

          {/* Move to stage */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20" disabled={bulkMoving}>
                {bulkMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoveRight className="w-4 h-4" />}
                Move to…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {stages.map((s: any) => (
                <DropdownMenuItem key={s.id} onClick={() => bulkMove(s.id)} className="gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete */}
          <Button size="sm" className="gap-2 bg-red-500 hover:bg-red-600 text-white" onClick={bulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove
          </Button>

          <button type="button" onClick={clearSelection} className="text-white/60 hover:text-white ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
