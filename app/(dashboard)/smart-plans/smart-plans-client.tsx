"use client"

import { useState } from "react"
import {
  Zap, Plus, Mail, MessageSquare, CheckSquare, Clock,
  Play, Pause, Settings, Users, MoreVertical, ArrowRight,
  Edit, Trash2, Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface SmartPlansClientProps {
  plans: any[]
}

const STEP_ICONS: Record<string, any> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  TASK: CheckSquare,
  WAIT: Clock,
}

const STEP_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-100 text-blue-600",
  SMS: "bg-green-100 text-green-600",
  TASK: "bg-purple-100 text-purple-600",
  WAIT: "bg-gray-100 text-gray-500",
}

const TRIGGER_LABELS: Record<string, string> = {
  CONTACT_CREATED: "New Contact Created",
  CONTACT_TAGGED: "Contact Tagged",
  PIPELINE_STAGE_CHANGED: "Pipeline Stage Changed",
  MANUAL: "Manual Enrollment",
}

export default function SmartPlansClient({ plans }: SmartPlansClientProps) {
  const { toast } = useToast()
  const [planStates, setPlanStates] = useState<Record<string, boolean>>(
    plans.reduce((acc, plan) => ({ ...acc, [plan.id]: plan.isActive }), {})
  )

  const togglePlan = async (planId: string) => {
    const newState = !planStates[planId]
    setPlanStates((prev) => ({ ...prev, [planId]: newState }))
    try {
      await fetch(`/api/smart-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newState }),
      })
      toast({ title: newState ? "Plan activated" : "Plan paused" })
    } catch {
      setPlanStates((prev) => ({ ...prev, [planId]: !newState }))
      toast({ title: "Error updating plan", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Plans</h1>
          <p className="text-gray-500 text-sm mt-0.5">Automated follow-up sequences for your contacts</p>
        </div>
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Plans", value: plans.length, color: "text-blue-600 bg-blue-50" },
          { label: "Active Plans", value: plans.filter((p) => p.isActive).length, color: "text-green-600 bg-green-50" },
          { label: "Total Enrollments", value: plans.reduce((sum, p) => sum + p._count.enrollments, 0), color: "text-purple-600 bg-purple-50" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={cn("text-3xl font-bold", stat.color.split(" ")[0])}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No smart plans yet</p>
          <p className="text-gray-400 text-sm mt-1">Create automated follow-up sequences for your leads</p>
          <Button className="mt-4 bg-lofty-600 hover:bg-lofty-700">
            <Plus className="w-4 h-4 mr-2" /> Create Your First Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={cn("border-0 shadow-sm", !planStates[plan.id] && "opacity-75")}>
              <CardContent className="p-5">
                {/* Plan header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      planStates[plan.id] ? "bg-green-100" : "bg-gray-100"
                    )}>
                      <Zap className={cn("w-5 h-5", planStates[plan.id] ? "text-green-600" : "text-gray-400")} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                        <Badge className={cn("text-xs", planStates[plan.id] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                          {planStates[plan.id] ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      {plan.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>Trigger: {TRIGGER_LABELS[plan.trigger] || plan.trigger}</span>
                        <span>·</span>
                        <span>{plan.steps.length} steps</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />{plan._count.enrollments} enrolled
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Switch
                      checked={planStates[plan.id]}
                      onCheckedChange={() => togglePlan(plan.id)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2"><Edit className="w-4 h-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><Copy className="w-4 h-4" />Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-red-600"><Trash2 className="w-4 h-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Step visualization */}
                <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
                  {plan.steps.map((step: any, idx: number) => {
                    const Icon = STEP_ICONS[step.type] || CheckSquare
                    return (
                      <div key={step.id} className="flex items-center gap-1">
                        <div className={cn("flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium", STEP_COLORS[step.type])}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{step.type}</span>
                          {step.delay > 0 && (
                            <span className="text-gray-400">+{step.delay}d</span>
                          )}
                        </div>
                        {idx < plan.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
