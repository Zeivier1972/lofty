"use client"

import { useState } from "react"
import {
  Zap, Plus, Mail, MessageSquare, CheckSquare, Clock,
  Play, Pause, Users, MoreVertical, ArrowDown,
  Edit, Trash2, X, Save, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface Step {
  id?: string
  order: number
  type: "EMAIL" | "SMS" | "WAIT" | "TASK"
  delay: number
  subject?: string
  content?: string
  taskTitle?: string
  taskType?: string
}

interface Plan {
  id: string
  name: string
  description?: string
  trigger: string
  isActive: boolean
  steps: Step[]
  _count: { enrollments: number }
}

const TRIGGERS = [
  { value: "CONTACT_CREATED", label: "Lead Created" },
  { value: "CONTACT_TAGGED", label: "Contact Tagged" },
  { value: "PIPELINE_STAGE_CHANGED", label: "Pipeline Stage Changed" },
  { value: "MANUAL", label: "Manual Enrollment" },
]

const STEP_TYPES = [
  { type: "SMS" as const, label: "Auto Text", icon: MessageSquare, color: "bg-green-500", textColor: "text-green-700", bg: "bg-green-50 border-green-200" },
  { type: "EMAIL" as const, label: "Auto Email", icon: Mail, color: "bg-blue-500", textColor: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  { type: "WAIT" as const, label: "Wait", icon: Clock, color: "bg-amber-500", textColor: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { type: "TASK" as const, label: "Create Task", icon: CheckSquare, color: "bg-purple-500", textColor: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
]

function StepNode({ step, index, onEdit, onDelete }: {
  step: Step; index: number; onEdit: () => void; onDelete: () => void
}) {
  const def = STEP_TYPES.find(s => s.type === step.type)!
  const Icon = def.icon
  return (
    <div className="flex flex-col items-center">
      <div className={cn("w-full max-w-sm rounded-xl border-2 p-4 relative group shadow-sm", def.bg)}>
        <div className="flex items-start gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", def.color)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {step.type === "WAIT" ? "RULES" : "DO"}
              </span>
              <span className={cn("text-sm font-semibold", def.textColor)}>{def.label}</span>
              <span className="text-xs bg-white border rounded-full px-2 py-0.5 text-gray-500 ml-auto">
                Step {index + 1}
              </span>
            </div>
            {step.type === "WAIT" && (
              <p className="text-sm text-gray-600 mt-1">
                Wait for <span className="font-semibold text-amber-600">{step.delay} day{step.delay !== 1 ? "s" : ""}</span>
              </p>
            )}
            {step.type === "SMS" && step.content && (
              <p className="text-sm text-gray-600 mt-1 truncate">{step.content}</p>
            )}
            {step.type === "EMAIL" && (
              <p className="text-sm text-gray-600 mt-1 truncate">{step.subject || "(no subject)"}</p>
            )}
            {step.type === "TASK" && (
              <p className="text-sm text-gray-600 mt-1 truncate">{step.taskTitle || "(no title)"}</p>
            )}
          </div>
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 hover:bg-white rounded-lg"><Edit className="w-3.5 h-3.5 text-gray-500" /></button>
          <button onClick={onDelete} className="p-1 hover:bg-white rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
        </div>
      </div>
      <div className="w-0.5 h-6 bg-gray-300" />
      <div className="w-2 h-2 bg-gray-300 rounded-full" />
      <div className="w-0.5 h-4 bg-gray-300" />
    </div>
  )
}

function StepEditor({ step, onChange, onSave, onCancel }: {
  step: Step; onChange: (s: Step) => void; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="bg-white border-2 border-lofty-500 rounded-xl p-4 shadow-lg max-w-sm w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-gray-900">Edit Step</span>
        <button onClick={onCancel}><X className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Step Type</label>
          <div className="grid grid-cols-2 gap-2">
            {STEP_TYPES.map(t => (
              <button key={t.type} onClick={() => onChange({ ...step, type: t.type })}
                className={cn("flex items-center gap-2 p-2 rounded-lg border text-sm font-medium transition-colors",
                  step.type === t.type ? `${t.bg} border-current ${t.textColor}` : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>
        {step.type === "WAIT" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Wait Duration (days)</label>
            <input type="number" min={1} value={step.delay}
              onChange={e => onChange({ ...step, delay: +e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
          </div>
        )}
        {step.type === "EMAIL" && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email Subject</label>
              <input type="text" value={step.subject || ""}
                onChange={e => onChange({ ...step, subject: e.target.value })}
                placeholder="Subject line..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email Body</label>
              <textarea value={step.content || ""}
                onChange={e => onChange({ ...step, content: e.target.value })}
                rows={4} placeholder="Email content..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none" />
            </div>
          </>
        )}
        {step.type === "SMS" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Text Message</label>
            <textarea value={step.content || ""}
              onChange={e => onChange({ ...step, content: e.target.value })}
              rows={3} placeholder="Message text..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none" />
          </div>
        )}
        {step.type === "TASK" && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Task Title</label>
              <input type="text" value={step.taskTitle || ""}
                onChange={e => onChange({ ...step, taskTitle: e.target.value })}
                placeholder="Task description..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Delay (days after enrollment)</label>
              <input type="number" min={0} value={step.delay}
                onChange={e => onChange({ ...step, delay: +e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={onSave} size="sm" className="flex-1 bg-lofty-600 hover:bg-lofty-700">
          <Save className="w-3.5 h-3.5 mr-1.5" />Save Step
        </Button>
        <Button onClick={onCancel} size="sm" variant="outline" className="flex-1">Cancel</Button>
      </div>
    </div>
  )
}

function PlanBuilder({ initial, tags, onSave, onClose }: {
  initial?: Plan; tags: { id: string; name: string; color: string }[]; onSave: (plan: any) => void; onClose: () => void
}) {
  // trigger may be "CONTACT_TAGGED:tagId" — split it
  const [triggerBase, triggerTagId] = (initial?.trigger || "CONTACT_CREATED").split(":")
  const [name, setName] = useState(initial?.name || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [trigger, setTrigger] = useState(triggerBase)
  const [selectedTagId, setSelectedTagId] = useState(triggerTagId || "")
  const [steps, setSteps] = useState<Step[]>(initial?.steps || [])
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [editingStepData, setEditingStepData] = useState<Step | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  function addStep(type: Step["type"]) {
    const newStep: Step = {
      order: steps.length,
      type,
      delay: type === "WAIT" ? 1 : 0,
      subject: type === "EMAIL" ? "" : undefined,
      content: type === "SMS" || type === "EMAIL" ? "" : undefined,
      taskTitle: type === "TASK" ? "" : undefined,
    }
    setSteps(prev => [...prev, newStep])
    setEditingStep(steps.length)
    setEditingStepData(newStep)
  }

  function saveStep() {
    if (editingStep === null || !editingStepData) return
    setSteps(prev => prev.map((s, i) => i === editingStep ? editingStepData : s))
    setEditingStep(null)
    setEditingStepData(null)
  }

  function deleteStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })))
  }

  async function handleSave() {
    if (!name.trim()) { toast({ title: "Plan name is required", variant: "destructive" }); return }
    const fullTrigger = trigger === "CONTACT_TAGGED" && selectedTagId
      ? `CONTACT_TAGGED:${selectedTagId}`
      : trigger
    setSaving(true)
    try {
      const method = initial?.id ? "PATCH" : "POST"
      const url = initial?.id ? `/api/smart-plans/${initial.id}` : "/api/smart-plans"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, trigger: fullTrigger, steps }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const plan = await res.json()
      onSave(plan)
      toast({ title: initial?.id ? "Plan updated" : "Plan created!" })
    } catch {
      toast({ title: "Error saving plan", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{initial?.id ? "Edit Smart Plan" : "Create Smart Plan"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Build an automated follow-up sequence</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Plan settings */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Plan Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. New Lead Spanish Follow-up"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this plan do?"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-lofty-500 outline-none" />
            </div>
          </div>

          {/* Visual Flow */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Flow Builder</h3>
            <div className="flex flex-col items-center">
              {/* WHEN trigger node */}
              <div className="w-full max-w-sm rounded-xl border-2 border-lofty-200 bg-lofty-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide bg-lofty-600 text-white px-2 py-0.5 rounded">WHEN</span>
                  <span className="text-sm font-semibold text-lofty-700">Trigger</span>
                </div>
                <select value={trigger} onChange={e => { setTrigger(e.target.value); setSelectedTagId("") }}
                  className="w-full border border-lofty-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-lofty-500 outline-none">
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {trigger === "CONTACT_TAGGED" && (
                  <div className="mt-2">
                    <label className="text-xs text-lofty-600 mb-1 block">Which tag?</label>
                    {tags.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        No tags yet — create tags in Settings → Tags first.
                      </p>
                    ) : (
                      <select value={selectedTagId} onChange={e => setSelectedTagId(e.target.value)}
                        className="w-full border border-lofty-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-lofty-500 outline-none">
                        <option value="">Any tag</option>
                        {tags.map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {steps.length > 0 && <><div className="w-0.5 h-6 bg-gray-300" /><div className="w-2 h-2 bg-gray-300 rounded-full" /><div className="w-0.5 h-4 bg-gray-300" /></>}

              {/* Steps */}
              {steps.map((step, idx) => (
                editingStep === idx ? (
                  <div key={idx} className="flex flex-col items-center">
                    <StepEditor
                      step={editingStepData!}
                      onChange={setEditingStepData}
                      onSave={saveStep}
                      onCancel={() => { setEditingStep(null); setEditingStepData(null) }}
                    />
                    <div className="w-0.5 h-6 bg-gray-300" />
                    <div className="w-2 h-2 bg-gray-300 rounded-full" />
                    <div className="w-0.5 h-4 bg-gray-300" />
                  </div>
                ) : (
                  <StepNode key={idx} step={step} index={idx}
                    onEdit={() => { setEditingStep(idx); setEditingStepData({ ...step }) }}
                    onDelete={() => deleteStep(idx)}
                  />
                )
              ))}

              {/* Add step buttons */}
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 w-full max-w-sm">
                <p className="text-xs text-gray-400 text-center mb-3">Add a step</p>
                <div className="grid grid-cols-2 gap-2">
                  {STEP_TYPES.map(t => (
                    <button key={t.type} onClick={() => addStep(t.type)}
                      className={cn("flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors hover:shadow-sm", t.bg, t.textColor)}>
                      <t.icon className="w-3.5 h-3.5" />{t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-lofty-600 hover:bg-lofty-700">
            {saving ? "Saving..." : initial?.id ? "Update Plan" : "Create Plan"}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default function SmartPlansClient({ plans: initial, tags }: { plans: Plan[]; tags: { id: string; name: string; color: string }[] }) {
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>(initial)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | undefined>()
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  const togglePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId)!
    const newState = !plan.isActive
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, isActive: newState } : p))
    try {
      await fetch(`/api/smart-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newState }),
      })
      toast({ title: newState ? "Plan activated" : "Plan paused" })
    } catch {
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, isActive: !newState } : p))
      toast({ title: "Error updating plan", variant: "destructive" })
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm("Delete this plan?")) return
    try {
      await fetch(`/api/smart-plans/${planId}`, { method: "DELETE" })
      setPlans(prev => prev.filter(p => p.id !== planId))
      toast({ title: "Plan deleted" })
    } catch {
      toast({ title: "Error deleting plan", variant: "destructive" })
    }
  }

  function handleSaved(plan: Plan) {
    setPlans(prev => {
      const exists = prev.find(p => p.id === plan.id)
      if (exists) return prev.map(p => p.id === plan.id ? { ...plan, _count: p._count } : p)
      return [{ ...plan, _count: { enrollments: 0 } }, ...prev]
    })
    setShowBuilder(false)
    setEditingPlan(undefined)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {(showBuilder || editingPlan) && (
        <PlanBuilder
          initial={editingPlan}
          tags={tags}
          onSave={handleSaved}
          onClose={() => { setShowBuilder(false); setEditingPlan(undefined) }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Plans</h1>
          <p className="text-gray-500 text-sm mt-0.5">Automated follow-up sequences</p>
        </div>
        <Button onClick={() => setShowBuilder(true)} size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Plans", value: plans.length, color: "text-blue-600" },
          { label: "Active Plans", value: plans.filter(p => p.isActive).length, color: "text-green-600" },
          { label: "Total Enrollments", value: plans.reduce((s, p) => s + p._count.enrollments, 0), color: "text-purple-600" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No smart plans yet</p>
          <p className="text-gray-400 text-sm mt-1">Create automated follow-up sequences for your leads</p>
          <Button onClick={() => setShowBuilder(true)} className="mt-4 bg-lofty-600 hover:bg-lofty-700">
            <Plus className="w-4 h-4 mr-2" /> Create Your First Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <Card key={plan.id} className={cn("border-0 shadow-sm overflow-hidden", !plan.isActive && "opacity-75")}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
                      plan.isActive ? "bg-green-100" : "bg-gray-100")}>
                      <Zap className={cn("w-4 h-4", plan.isActive ? "text-green-600" : "text-gray-400")} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{plan.name}</span>
                        <Badge className={cn("text-xs", plan.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                          {plan.isActive ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <span>{(() => {
                          const [base, tagId] = plan.trigger.split(":")
                          const label = TRIGGERS.find(t => t.value === base)?.label || base
                          if (tagId) { const tag = tags.find((t: any) => t.id === tagId); return tag ? `${label}: ${tag.name}` : label }
                          return label
                        })()}</span>
                        <span>·</span>
                        <span>{plan.steps.length} steps</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{plan._count.enrollments}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={plan.isActive} onCheckedChange={() => togglePlan(plan.id)}
                      onClick={e => e.stopPropagation()} />
                    <button onClick={e => { e.stopPropagation(); setEditingPlan(plan); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deletePlan(plan.id) }}
                      className="p-1.5 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {expandedPlan === plan.id && plan.steps.length > 0 && (
                  <div className="border-t bg-gray-50 px-5 py-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {/* WHEN chip */}
                      <div className="flex-shrink-0 bg-lofty-100 text-lofty-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-lofty-200">
                        WHEN: {(() => {
                          const [base, tagId] = plan.trigger.split(":")
                          const label = TRIGGERS.find(t => t.value === base)?.label || base
                          if (tagId) { const tag = tags.find((t: any) => t.id === tagId); return tag ? `${label}: ${tag.name}` : label }
                          return label
                        })()}
                      </div>
                      {plan.steps.map((step, i) => {
                        const def = STEP_TYPES.find(s => s.type === step.type)!
                        return (
                          <div key={i} className="flex items-center gap-2 flex-shrink-0">
                            <ArrowDown className="w-3 h-3 text-gray-300 rotate-[-90deg]" />
                            <div className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border", def.bg, def.textColor)}>
                              <def.icon className="w-3 h-3" />
                              {step.type === "WAIT" ? `Wait ${step.delay}d` : def.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
