"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users, Plus, Search, Download, Upload,
  Phone, Mail, ChevronLeft, ChevronRight, MoreVertical,
  Trash2, Edit, Eye, MessageSquare, X, Send, CheckSquare,
  FileText, AlertCircle, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate, formatPhone, getInitials, getLeadScoreColor, getStatusColor } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

const STATUSES = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE_CLIENT", label: "Active Client" },
  { value: "PAST_CLIENT", label: "Past Client" },
  { value: "SPHERE_OF_INFLUENCE", label: "Sphere" },
]

const SOURCES = [
  "WEBSITE", "REFERRAL", "ZILLOW", "REALTOR", "FACEBOOK",
  "INSTAGRAM", "GOOGLE", "OPEN_HOUSE", "COLD_CALL", "OTHER",
]

interface ContactsClientProps {
  contacts: any[]
  total: number
  page: number
  pageSize: number
  tags: any[]
  filters: { status?: string; search?: string; source?: string }
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const { toast } = useToast()

  const SAMPLE_CSV = `first_name,last_name,email,phone,status,source,type,budget,area,bedrooms,notes
Maria,Garcia,maria@email.com,305-555-0101,lead,zillow,buyer,450000,Coral Gables,3,Looking for single family
Carlos,Rodriguez,carlos@email.com,786-555-0202,prospect,referral,seller,,Brickell,,Wants to sell condo
Ana,Martinez,ana@email.com,305-555-0303,lead,facebook,buyer,650000,Coconut Grove,4,Needs pool`

  async function handleImport() {
    if (!csv.trim()) return
    setImporting(true)
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      if (data.imported > 0) onImported()
    } catch (e: any) {
      toast({ title: e.message || "Import failed", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCsv(ev.target?.result as string)
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lofty-100 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-lofty-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bulk Import Leads</h2>
              <p className="text-xs text-gray-500">Upload CSV — IDX search profiles auto-assigned from lead data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Import Complete</p>
                <p className="text-sm text-green-700">{result.imported} imported · {result.skipped} skipped (duplicates)</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-700 mb-1">Errors ({result.errors.length}):</p>
                {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <Button onClick={onClose} className="w-full bg-lofty-600 hover:bg-lofty-700">Done</Button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 mb-1">Upload CSV file</p>
              <p className="text-xs text-gray-400 mb-3">Supports: first_name, last_name, email, phone, status, source, type, budget, area, bedrooms</p>
              <label className="cursor-pointer">
                <span className="bg-lofty-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-lofty-700 transition-colors">Choose File</span>
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Or paste CSV data</label>
                <button onClick={() => setCsv(SAMPLE_CSV)} className="text-xs text-lofty-600 hover:text-lofty-700 font-medium">
                  Load sample
                </button>
              </div>
              <textarea
                value={csv}
                onChange={e => setCsv(e.target.value)}
                rows={8}
                placeholder="first_name,last_name,email,phone,status,source,type,budget,area..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <strong>IDX auto-assign:</strong> The <code>type</code> (buyer/seller), <code>budget</code>, <code>area</code>, and <code>bedrooms</code> columns will automatically set each contact's search profile for IDX matching once connected.
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={importing || !csv.trim()} className="flex-1 bg-lofty-600 hover:bg-lofty-700">
                {importing ? "Importing..." : "Import Contacts"}
              </Button>
              <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BulkSMSModal({ contactIds, onClose }: { contactIds: string[]; onClose: () => void }) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  async function send() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/bulk/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `Text sent to ${data.sent} contact${data.sent !== 1 ? "s" : ""}` })
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Failed to send", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bulk Text Message</h2>
              <p className="text-xs text-gray-500">{contactIds.length} recipients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Type your message here..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={send} disabled={sending || !message.trim()} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : `Send to ${contactIds.length}`}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function BulkEmailModal({ contactIds, onClose }: { contactIds: string[]; onClose: () => void }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  async function send() {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/bulk/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `Email sent to ${data.sent} contact${data.sent !== 1 ? "s" : ""}` })
      onClose()
    } catch (e: any) {
      toast({ title: e.message || "Failed to send", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bulk Email</h2>
              <p className="text-xs text-gray-500">{contactIds.length} recipients · Use {"{first_name}"} for personalization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-lofty-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={7}
              placeholder={"Hi {first_name},\n\nYour message here..."}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-lofty-500 outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()} className="flex-1 bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : `Send to ${contactIds.length}`}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default function ContactsClient({ contacts, total, page, pageSize, tags, filters }: ContactsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState(filters.search || "")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkSMS, setShowBulkSMS] = useState(false)
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const totalPages = Math.ceil(total / pageSize)
  const allSelected = contacts.length > 0 && contacts.every(c => selected.has(c.id))
  const someSelected = selected.size > 0

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(contacts.map(c => c.id)))
  }

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams()
    if (filters.search) params.set("search", filters.search)
    if (filters.status) params.set("status", filters.status)
    if (filters.source) params.set("source", filters.source)
    if (value && value !== "ALL") params.set(key, value)
    else params.delete(key)
    params.delete("page")
    router.push(`/contacts?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (filters.status) params.set("status", filters.status)
    if (filters.source) params.set("source", filters.source)
    router.push(`/contacts?${params.toString()}`)
  }

  const selectedIds = Array.from(selected)

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => router.refresh()} />}
      {showBulkSMS && <BulkSMSModal contactIds={selectedIds} onClose={() => setShowBulkSMS(false)} />}
      {showBulkEmail && <BulkEmailModal contactIds={selectedIds} onClose={() => setShowBulkEmail(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Link href="/contacts/new">
              <Plus className="w-4 h-4" /> Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="bg-lofty-600 text-white rounded-xl px-5 py-3 flex items-center gap-4 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            <span className="font-semibold text-sm">{selected.size} selected</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              onClick={() => setShowBulkSMS(true)}
              className="bg-white text-green-700 hover:bg-green-50 gap-1.5 font-semibold"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Bulk Text
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBulkEmail(true)}
              className="bg-white text-blue-700 hover:bg-blue-50 gap-1.5 font-semibold"
            >
              <Mail className="w-3.5 h-3.5" /> Bulk Email
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="text-white hover:bg-lofty-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </form>

        <Select value={filters.status || "ALL"} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.source || "ALL"} onValueChange={(v) => updateFilter("source", v)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[40px_2fr_1.5fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 text-lofty-600 focus:ring-lofty-500 cursor-pointer"
            />
          </div>
          <div>Contact</div>
          <div>Contact Info</div>
          <div>Status</div>
          <div>Source</div>
          <div>Lead Score</div>
          <div></div>
        </div>

        {contacts.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No contacts found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new contact</p>
            <Button asChild className="mt-4 bg-lofty-600 hover:bg-lofty-700">
              <Link href="/contacts/new"><Plus className="w-4 h-4 mr-2" />Add Contact</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={cn(
                  "grid grid-cols-[40px_2fr_1.5fr_1fr_1fr_1fr_80px] gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center",
                  selected.has(contact.id) && "bg-lofty-50 hover:bg-lofty-50"
                )}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="w-4 h-4 rounded border-gray-300 text-lofty-600 focus:ring-lofty-500 cursor-pointer"
                  />
                </div>

                {/* Name + Tags */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarFallback className="bg-lofty-100 text-lofty-700 text-sm font-medium">
                      {getInitials(`${contact.firstName} ${contact.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-gray-900 hover:text-lofty-600 transition-colors truncate block"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {contact.tags.slice(0, 2).map((ct: any) => (
                        <span
                          key={ct.tagId}
                          className="inline-flex items-center px-1.5 py-0 text-xs rounded-full font-medium"
                          style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}
                        >
                          {ct.tag.name}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="text-xs text-gray-400">+{contact.tags.length - 2}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="min-w-0">
                  {contact.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{formatPhone(contact.phone)}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <Badge className={cn("text-xs font-medium", getStatusColor(contact.status))}>
                    {contact.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Source */}
                <div className="text-sm text-gray-500">
                  {contact.source ? contact.source.replace(/_/g, " ") : "—"}
                </div>

                {/* Lead Score */}
                <div>
                  <span className={cn("text-sm font-bold px-2.5 py-0.5 rounded-full", getLeadScoreColor(contact.leadScore))}>
                    {contact.leadScore}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2">
                          <Eye className="w-4 h-4" /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/contacts/${contact.id}/edit`} className="flex items-center gap-2">
                          <Edit className="w-4 h-4" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => router.push(`/contacts?page=${page - 1}`)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => router.push(`/contacts?page=${p}`)}
                  className={p === page ? "bg-lofty-600 hover:bg-lofty-700" : ""}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => router.push(`/contacts?page=${page + 1}`)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
