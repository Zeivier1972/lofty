"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plus, GitBranch, DollarSign, Settings,
  MoreVertical, Phone, Mail, Calendar, ChevronDown,
  X, Pencil, Trash2, Check, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface PipelineClientProps {
  pipeline: any
  allPipelines: any[]
}

// ── Manage Stages Modal ────────────────────────────────────────────────────────
function ManageStagesModal({
  pipelineId,
  initialStages,
  onClose,
  onSaved,
}: {
  pipelineId: string
  initialStages: any[]
  onClose: () => void
  onSaved: (stages: any[]) => void
}) {
  const { toast } = useToast()
  const [stages, setStages] = useState(initialStages.map(s => ({ ...s })))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const startEdit = (stage: any) => {
    setEditingId(stage.id)
    setEditName(stage.name)
  }

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
    } finally {
      setSaving(null)
    }
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
    } finally {
      setDeleting(null)
    }
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
      if (!res.ok) throw new Error()
      const stage = await res.json()
      setStages(prev => [...prev, { ...stage, leads: [] }])
      setNewName("")
      toast({ title: "Stage added" })
    } catch {
      toast({ title: "Failed to add stage", variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Manage Stages</h2>
          <button onClick={() => { onSaved(stages); onClose() }} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2 max-h-80 overflow-y-auto">
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
                <button
                  onClick={() => saveRename(stage.id)}
                  disabled={!!saving}
                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  {saving === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <button onClick={() => startEdit(stage)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => deleteStage(stage.id)}
                disabled={deleting === stage.id}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                {deleting === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Add new stage</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addStage()}
              placeholder="Stage name…"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <Button onClick={addStage} disabled={adding || !newName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PipelineClient({ pipeline, allPipelines }: PipelineClientProps) {
  const { toast } = useToast()
  const [stages, setStages] = useState(pipeline?.stages || [])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [showManageStages, setShowManageStages] = useState(false)

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

    // Find the lead and current stage
    let leadToMove: any = null
    let sourceStageId: string | null = null

    for (const stage of stages) {
      const lead = stage.leads.find((l: any) => l.id === dragging)
      if (lead) {
        leadToMove = lead
        sourceStageId = stage.id
        break
      }
    }

    if (!leadToMove || sourceStageId === targetStageId) return

    // Optimistic update
    setStages((prev: any[]) =>
      prev.map((stage: any) => {
        if (stage.id === sourceStageId) {
          return { ...stage, leads: stage.leads.filter((l: any) => l.id !== dragging) }
        }
        if (stage.id === targetStageId) {
          return { ...stage, leads: [...stage.leads, { ...leadToMove, stageId: targetStageId }] }
        }
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
    <div className="p-6 animate-fade-in">
      {showManageStages && pipeline && (
        <ManageStagesModal
          pipelineId={pipeline.id}
          initialStages={stages}
          onClose={() => setShowManageStages(false)}
          onSaved={(updated) => setStages(updated)}
        />
      )}

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowManageStages(true)}>
            <Settings className="w-4 h-4" /> Manage Stages
          </Button>
          <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Plus className="w-4 h-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Pipeline summary */}
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
        {stages.map((stage: any) => (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-72 bg-gray-50 rounded-xl border border-gray-200 kanban-column transition-colors",
              dragOver === stage.id && "border-lofty-400 bg-lofty-50"
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDrop={(e) => handleDrop(e, stage.id)}
            onDragLeave={() => setDragOver(null)}
          >
            {/* Column header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-sm font-semibold text-gray-800">{stage.name}</span>
                <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{stage.leads.length}</span>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-16">
              {stage.leads.map((lead: any) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cn(
                    "bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all",
                    dragging === lead.id && "opacity-50 dragging"
                  )}
                >
                  {/* Contact header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="w-7 h-7 flex-shrink-0">
                        <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xs">
                          {getInitials(`${lead.contact.firstName} ${lead.contact.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <Link
                        href={`/contacts/${lead.contact.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-lofty-600 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.contact.firstName} {lead.contact.lastName}
                      </Link>
                    </div>
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
                        <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Remove from Pipeline</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tags */}
                  {lead.contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {lead.contact.tags.slice(0, 2).map((ct: any) => (
                        <span
                          key={ct.tagId}
                          className="text-xs px-1.5 py-0 rounded-full"
                          style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}
                        >
                          {ct.tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Value */}
                  {lead.value && (
                    <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-green-600">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(lead.value)}
                    </div>
                  )}

                  {/* Probability */}
                  {lead.probability != null && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
                        <span>Probability</span>
                        <span>{lead.probability}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-lofty-500 transition-all"
                          style={{ width: `${lead.probability}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expected close */}
                  {lead.expectedClose && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(lead.expectedClose)}</span>
                    </div>
                  )}

                  {/* Contact info */}
                  <div className="mt-2 flex gap-2">
                    {lead.contact.phone && (
                      <a
                        href={`tel:${lead.contact.phone}`}
                        className="text-gray-400 hover:text-lofty-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {lead.contact.email && (
                      <a
                        href={`mailto:${lead.contact.email}`}
                        className="text-gray-400 hover:text-lofty-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {stage.leads.length === 0 && (
                <div className="h-16 flex items-center justify-center">
                  <p className="text-xs text-gray-300">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
