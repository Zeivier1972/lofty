"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CheckSquare, Plus, Phone, Mail, ChevronDown, ChevronUp,
  Calendar, Clock, MoreVertical, Check, Square, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatDate, formatPhone, getPriorityColor, getStatusColor, TASK_TYPES } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { format, isToday, isTomorrow, isPast } from "date-fns"
import HelpPanel from "@/components/help-panel"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]

interface TasksClientProps {
  tasks: any[]
  counts: any[]
  filters: { status?: string; priority?: string }
}

export default function TasksClient({ tasks: initialTasks, counts, filters }: TasksClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [tasks, setTasks] = useState(initialTasks)

  const pendingCount = counts.find((c: any) => c.status === "PENDING")?._count || 0
  const completedCount = counts.find((c: any) => c.status === "COMPLETED")?._count || 0

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams()
    if (filters.status) params.set("status", filters.status)
    if (filters.priority) params.set("priority", filters.priority)
    if (value && value !== "ALL") params.set(key, value)
    else params.delete(key)
    router.push(`/tasks?${params.toString()}`)
  }

  const completeTask = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: "COMPLETED", completedAt: new Date().toISOString() } : t)
    )
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", completedAt: new Date().toISOString() }),
      })
      toast({ title: "Task completed!" })
    } catch {
      toast({ title: "Failed to update task", variant: "destructive" })
    }
  }

  const groupedTasks = {
    overdue: tasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))),
    today: tasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && isToday(new Date(t.dueDate))),
    tomorrow: tasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && isTomorrow(new Date(t.dueDate))),
    upcoming: tasks.filter((t) => t.status !== "COMPLETED" && (!t.dueDate || (!isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && !isTomorrow(new Date(t.dueDate))))),
    completed: tasks.filter((t) => t.status === "COMPLETED"),
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pendingCount} pending · {completedCount} completed</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel section="tasks" />
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Link href="/tasks/new"><Plus className="w-4 h-4" />New Task</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Overdue", count: groupedTasks.overdue.length, color: "text-red-600 bg-red-50" },
          { label: "Due Today", count: groupedTasks.today.length, color: "text-orange-600 bg-orange-50" },
          { label: "Upcoming", count: groupedTasks.upcoming.length + groupedTasks.tomorrow.length, color: "text-blue-600 bg-blue-50" },
          { label: "Completed", count: groupedTasks.completed.length, color: "text-green-600 bg-green-50" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-xl p-4 text-center", stat.color)}>
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-sm font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filters.priority || "ALL"} onValueChange={(v) => updateFilter("priority", v)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || "ALL"} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Task groups */}
      <div className="space-y-4">
        {Object.entries(groupedTasks).map(([group, groupTasks]) => {
          if (group === "completed" && groupTasks.length === 0) return null
          if (group !== "completed" && groupTasks.length === 0) return null

          const groupLabels: Record<string, { label: string; color: string }> = {
            overdue: { label: "Overdue", color: "text-red-600" },
            today: { label: "Due Today", color: "text-orange-600" },
            tomorrow: { label: "Due Tomorrow", color: "text-blue-600" },
            upcoming: { label: "Upcoming", color: "text-gray-600" },
            completed: { label: "Completed", color: "text-gray-400" },
          }

          const { label, color } = groupLabels[group]

          return (
            <div key={group}>
              <h3 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", color)}>
                {label}
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{groupTasks.length}</span>
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm divide-y divide-gray-100">
                {(groupTasks as any[]).map((task: any) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors",
                      task.status === "COMPLETED" && "opacity-60"
                    )}
                  >
                    {/* Complete button */}
                    <button
                      onClick={() => task.status !== "COMPLETED" && completeTask(task.id)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                        task.status === "COMPLETED"
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 hover:border-lofty-400"
                      )}
                    >
                      {task.status === "COMPLETED" && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Priority indicator */}
                    <div className={cn("w-1.5 h-full min-h-5 rounded-full flex-shrink-0", {
                      "bg-red-500": task.priority === "URGENT",
                      "bg-orange-400": task.priority === "HIGH",
                      "bg-blue-400": task.priority === "MEDIUM",
                      "bg-gray-300": task.priority === "LOW",
                    })} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn("font-medium text-gray-900", task.status === "COMPLETED" && "line-through text-gray-400")}>
                            {task.title}
                          </p>
                          {task.contact && (
                            <Link href={`/contacts/${task.contact.id}`} className="text-sm text-lofty-600 hover:text-lofty-700 mt-0.5 inline-block">
                              {task.contact.firstName} {task.contact.lastName}
                            </Link>
                          )}
                          {task.description && (
                            <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {TASK_TYPES.find((t) => t.value === task.type)?.label || task.type}
                          </Badge>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-8 h-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => completeTask(task.id)}>Mark Complete</DropdownMenuItem>
                              <DropdownMenuItem>Edit Task</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Date/time */}
                      {task.dueDate && (
                        <div className={cn("flex items-center gap-1 text-xs mt-1.5", {
                          "text-red-500": group === "overdue",
                          "text-orange-500": group === "today",
                          "text-blue-500": group === "tomorrow",
                          "text-gray-400": group === "upcoming" || group === "completed",
                        })}>
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                          {task.dueTime && <span>at {task.dueTime}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {tasks.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No tasks yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first task to get started</p>
            <Button asChild className="mt-4 bg-lofty-600 hover:bg-lofty-700">
              <Link href="/tasks/new"><Plus className="w-4 h-4 mr-2" />Add Task</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
