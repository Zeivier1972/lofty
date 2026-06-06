"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Phone, Mail, MapPin, Edit, ArrowLeft, Star, Tag, Plus,
  MessageSquare, Calendar, FileText, Home, GitBranch,
  CheckSquare, Zap, Clock, Pin, Trash2, Send, MoreVertical,
  Building, Briefcase, Globe, Facebook, Instagram, Linkedin, Twitter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  cn, formatDate, formatRelativeTime, formatPhone, formatCurrency,
  getInitials, getStatusColor, getPriorityColor, getLeadScoreColor,
} from "@/lib/utils"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

const ACTIVITY_ICONS: Record<string, string> = {
  CONTACT_CREATED: "👤", EMAIL_SENT: "📧", CALL_MADE: "📞",
  TASK_COMPLETED: "✅", NOTE_ADDED: "📝", PROPERTY_VIEWED: "🏠",
  PIPELINE_MOVED: "📊", APPOINTMENT_SCHEDULED: "📅", TRANSACTION_UPDATED: "📋",
  EMAIL_OPENED: "👁️", SMS_SENT: "💬",
}

export default function ContactDetailClient({ contact }: { contact: any }) {
  const { toast } = useToast()
  const [newNote, setNewNote] = useState("")
  const [notes, setNotes] = useState(contact.notes)
  const [isAddingNote, setIsAddingNote] = useState(false)

  const addNote = async () => {
    if (!newNote.trim()) return
    setIsAddingNote(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      })
      const note = await res.json()
      setNotes([note, ...notes])
      setNewNote("")
      toast({ title: "Note added" })
    } catch {
      toast({ title: "Error adding note", variant: "destructive" })
    } finally {
      setIsAddingNote(false)
    }
  }

  const fullName = `${contact.firstName} ${contact.lastName}`

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-gray-500">
          <Link href="/contacts"><ArrowLeft className="w-4 h-4 mr-1" />Back to Contacts</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Phone className="w-4 h-4" /> Call
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="w-4 h-4" /> Email
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" /> SMS
          </Button>
          <Button asChild size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
            <Link href={`/contacts/${contact.id}/edit`}>
              <Edit className="w-4 h-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: Contact info */}
        <div className="space-y-4">
          {/* Header card */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto">
                  <AvatarFallback className="bg-lofty-100 text-lofty-700 text-2xl font-bold">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold text-gray-900 mt-3">{fullName}</h2>
                {contact.jobTitle && (
                  <p className="text-sm text-gray-500">{contact.jobTitle}{contact.company && ` at ${contact.company}`}</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <Badge className={cn("text-xs", getStatusColor(contact.status))}>
                    {contact.status.replace(/_/g, " ")}
                  </Badge>
                  <span className={cn("text-sm font-bold px-2.5 py-0.5 rounded-full", getLeadScoreColor(contact.leadScore))}>
                    {contact.leadScore}
                  </span>
                </div>
                {/* Tags */}
                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {contact.tags.map((ct: any) => (
                      <span
                        key={ct.tagId}
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}
                      >
                        {ct.tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2.5">
                {contact.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a href={`tel:${contact.phone}`} className="text-gray-700 hover:text-lofty-600">
                      {formatPhone(contact.phone)}
                    </a>
                  </div>
                )}
                {contact.phone2 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a href={`tel:${contact.phone2}`} className="text-gray-500">
                      {formatPhone(contact.phone2)}
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a href={`mailto:${contact.email}`} className="text-gray-700 hover:text-lofty-600 truncate">
                      {contact.email}
                    </a>
                  </div>
                )}
                {(contact.city || contact.state) && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">
                      {[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {contact.source && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{contact.source.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>

              {/* Social */}
              {(contact.socialFacebook || contact.socialInstagram || contact.socialLinkedin) && (
                <>
                  <Separator className="my-3" />
                  <div className="flex gap-2 justify-center">
                    {contact.socialFacebook && <a href={contact.socialFacebook} target="_blank" rel="noopener" className="text-gray-400 hover:text-blue-600"><Facebook className="w-5 h-5" /></a>}
                    {contact.socialInstagram && <a href={contact.socialInstagram} target="_blank" rel="noopener" className="text-gray-400 hover:text-pink-600"><Instagram className="w-5 h-5" /></a>}
                    {contact.socialLinkedin && <a href={contact.socialLinkedin} target="_blank" rel="noopener" className="text-gray-400 hover:text-blue-700"><Linkedin className="w-5 h-5" /></a>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Buyer/Seller details */}
          {(contact.buyerBudgetMin || contact.sellerAddress) && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {contact.buyerBudgetMin ? "Buyer Profile" : "Seller Profile"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {contact.buyerBudgetMin && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Budget</span>
                      <span className="font-medium">{formatCurrency(contact.buyerBudgetMin)} – {formatCurrency(contact.buyerBudgetMax)}</span>
                    </div>
                    {contact.buyerBedroomsMin && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Bedrooms</span>
                        <span className="font-medium">{contact.buyerBedroomsMin}+ beds</span>
                      </div>
                    )}
                    {contact.buyerLocation && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Area</span>
                        <span className="font-medium">{contact.buyerLocation}</span>
                      </div>
                    )}
                  </>
                )}
                {contact.sellerAddress && (
                  <>
                    <div className="text-sm">
                      <span className="text-gray-500 block">Property</span>
                      <span className="font-medium">{contact.sellerAddress}</span>
                    </div>
                    {contact.sellerEstimatedValue && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Est. Value</span>
                        <span className="font-medium text-green-600">{formatCurrency(contact.sellerEstimatedValue)}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pipeline */}
          {contact.pipelineLeads.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {contact.pipelineLeads.map((lead: any) => (
                  <div key={lead.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{lead.stage.name}</span>
                      {lead.value && <span className="text-sm text-green-600 font-medium">{formatCurrency(lead.value)}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{lead.stage.pipeline.name}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Smart Plan Enrollments */}
          {contact.enrollments.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Zap className="w-4 h-4" />Smart Plans
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {contact.enrollments.map((enr: any) => (
                  <div key={enr.id} className="flex items-center justify-between">
                    <span className="text-sm">{enr.plan.name}</span>
                    <Badge className={cn("text-xs", enr.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                      Step {enr.currentStep}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Meta */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Added</span>
                <span className="text-gray-600">{formatDate(contact.createdAt)}</span>
              </div>
              {contact.lastContacted && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Last contacted</span>
                  <span className="text-gray-600">{formatDate(contact.lastContacted)}</span>
                </div>
              )}
              {contact.assignedTo && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Assigned to</span>
                  <span className="text-gray-600">{contact.assignedTo.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="timeline">
            <TabsList className="w-full justify-start h-10 bg-white border-b border-gray-200 rounded-none px-0">
              <TabsTrigger value="timeline" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <Clock className="w-4 h-4" />Timeline
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <FileText className="w-4 h-4" />Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <CheckSquare className="w-4 h-4" />Tasks ({contact.tasks.length})
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <Mail className="w-4 h-4" />Emails ({contact.emails.length})
              </TabsTrigger>
              <TabsTrigger value="properties" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <Home className="w-4 h-4" />Properties ({contact.propertyInterests.length})
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-lofty-600 rounded-none">
                <FileText className="w-4 h-4" />Transactions ({contact.transactions.length})
              </TabsTrigger>
            </TabsList>

            {/* Timeline */}
            <TabsContent value="timeline" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {contact.activities.map((activity: any) => (
                        <div key={activity.id} className="flex gap-4 relative">
                          <div className="w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-base">
                            {ACTIVITY_ICONS[activity.type] || "📌"}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-gray-500 mt-0.5">{activity.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(activity.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                      {contact.activities.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-4 space-y-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Add a note about this contact..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={addNote}
                      disabled={isAddingNote || !newNote.trim()}
                      size="sm"
                      className="bg-lofty-600 hover:bg-lofty-700 gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {notes.map((note: any) => (
                <Card key={note.id} className={cn("border-0 shadow-sm", note.isPinned && "border-l-4 border-l-yellow-400")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex gap-1 flex-shrink-0">
                        {note.isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
                        <Button variant="ghost" size="icon" className="w-7 h-7">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      {note.author && <span>{note.author.name}</span>}
                      <span>·</span>
                      <span>{formatRelativeTime(note.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Tasks */}
            <TabsContent value="tasks" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-0 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Tasks</CardTitle>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Task
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {contact.tasks.map((task: any) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", {
                        "bg-red-500": task.priority === "URGENT",
                        "bg-orange-500": task.priority === "HIGH",
                        "bg-blue-500": task.priority === "MEDIUM",
                        "bg-gray-400": task.priority === "LOW",
                      })} />
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", task.status === "COMPLETED" && "line-through text-gray-400")}>
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p className={cn("text-xs mt-0.5", new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "text-red-500" : "text-gray-400")}>
                            Due {formatDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <Badge className={cn("text-xs", getPriorityColor(task.priority))}>{task.priority}</Badge>
                    </div>
                  ))}
                  {contact.tasks.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No tasks for this contact</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emails */}
            <TabsContent value="emails" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {contact.emails.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No emails sent to this contact</p>
                  ) : (
                    <div className="space-y-3">
                      {contact.emails.map((email: any) => (
                        <div key={email.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium">{email.subject}</p>
                            <Badge className={cn("text-xs ml-2", getStatusColor(email.status))}>{email.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{formatDate(email.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Properties */}
            <TabsContent value="properties" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {contact.propertyInterests.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No properties associated with this contact</p>
                  ) : (
                    <div className="space-y-3">
                      {contact.propertyInterests.map((interest: any) => (
                        <div key={interest.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Home className="w-8 h-8 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">{interest.property.address}</p>
                            <p className="text-xs text-gray-500">{interest.property.city}, {interest.property.state} · {formatCurrency(interest.property.price)}</p>
                          </div>
                          <Badge className="ml-auto text-xs bg-blue-100 text-blue-700">{interest.type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transactions */}
            <TabsContent value="transactions" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {contact.transactions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No transactions for this contact</p>
                  ) : (
                    <div className="space-y-3">
                      {contact.transactions.map((transaction: any) => (
                        <Link key={transaction.id} href={`/transactions/${transaction.id}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <FileText className="w-8 h-8 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{transaction.title}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(transaction.salePrice || transaction.listPrice)}</p>
                          </div>
                          <Badge className={cn("text-xs", getStatusColor(transaction.status))}>
                            {transaction.status.replace(/_/g, " ")}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
