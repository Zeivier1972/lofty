"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Settings, User, Bell, Shield, Tag, GitBranch, Mail,
  Phone, Globe, Save, Loader2, Plus, Trash2, Edit, Palette,
  Database, CheckCircle, AlertCircle, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { getInitials } from "@/lib/utils"

const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
})

interface SettingsClientProps {
  user: any
  tags: any[]
  pipelines: any[]
}

export default function SettingsClient({ user, tags: initialTags, pipelines }: SettingsClientProps) {
  const { toast } = useToast()
  const [tags, setTags] = useState(initialTags)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3B82F6")
  const [idxConfig, setIdxConfig] = useState({
    provider: "miami_mls",
    serverUrl: "",
    username: "",
    password: "",
    loginUrl: "https://rets.miami-mls.com/rets/login",
    mlsId: "",
    autoImport: false,
    autoAssignSearch: true,
  })
  const [idxSaving, setIdxSaving] = useState(false)
  const [idxConnected, setIdxConnected] = useState(false)

  const saveIdx = async () => {
    setIdxSaving(true)
    try {
      await fetch("/api/settings/idx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idxConfig),
      })
      setIdxConnected(true)
      toast({ title: "IDX settings saved" })
    } catch {
      toast({ title: "Error saving IDX settings", variant: "destructive" })
    } finally {
      setIdxSaving(false)
    }
  }

  const { register, handleSubmit, formState: { isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      title: user?.title || "",
      bio: user?.bio || "",
      timezone: user?.timezone || "America/New_York",
    },
  })

  const saveProfile = async (data: any) => {
    try {
      await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      toast({ title: "Profile updated successfully" })
    } catch {
      toast({ title: "Error saving profile", variant: "destructive" })
    }
  }

  const addTag = async () => {
    if (!newTagName.trim()) return
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      })
      const tag = await res.json()
      setTags([...tags, tag])
      setNewTagName("")
      toast({ title: "Tag created" })
    } catch {
      toast({ title: "Error creating tag", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account and CRM preferences</p>
      </div>

      <Tabs defaultValue="profile" orientation="vertical" className="flex gap-6">
        {/* Tab list */}
        <div className="w-48 flex-shrink-0">
          <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1">
            {[
              { value: "profile", label: "Profile", icon: User },
              { value: "notifications", label: "Notifications", icon: Bell },
              { value: "tags", label: "Tags", icon: Tag },
              { value: "pipeline", label: "Pipeline", icon: GitBranch },
              { value: "idx", label: "IDX / MLS", icon: Database },
              { value: "integrations", label: "Integrations", icon: Globe },
              { value: "security", label: "Security", icon: Shield },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="w-full justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-lofty-50 data-[state=active]:text-lofty-700 rounded-lg"
              >
                <Icon className="w-4 h-4" />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1">
          {/* Profile */}
          <TabsContent value="profile">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-lofty-100 text-lofty-700 text-xl font-bold">
                      {getInitials(user?.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <Button variant="outline" size="sm">Change Photo</Button>
                </div>

                <form onSubmit={handleSubmit(saveProfile)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input {...register("name")} className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input {...register("email")} type="email" className="mt-1" />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input {...register("phone")} className="mt-1" />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input {...register("title")} className="mt-1" placeholder="Real Estate Agent" />
                    </div>
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea {...register("bio")} className="mt-1" rows={3} />
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <Input {...register("timezone")} className="mt-1" placeholder="America/New_York" />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-lofty-600 hover:bg-lofty-700"
                  >
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "New lead notifications", desc: "Get notified when a new lead is created" },
                  { label: "Task reminders", desc: "Receive reminders for upcoming tasks" },
                  { label: "Appointment alerts", desc: "Alerts before scheduled appointments" },
                  { label: "Pipeline updates", desc: "Notifications when leads move through pipeline" },
                  { label: "Email replies", desc: "When contacts reply to your emails" },
                  { label: "Smart plan updates", desc: "Status updates on automated plans" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags */}
          <TabsContent value="tags">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Contact Tags</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add tag */}
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="New tag name..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Button onClick={addTag} size="sm" className="bg-lofty-600 hover:bg-lofty-700">
                    <Plus className="w-4 h-4 mr-1" />Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium group"
                      style={{ backgroundColor: tag.color + "20", color: tag.color }}
                    >
                      {tag.name}
                      <button className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline */}
          <TabsContent value="pipeline">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Pipeline Stages</CardTitle>
              </CardHeader>
              <CardContent>
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{pipeline.name}</h3>
                      {pipeline.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                    </div>
                    <div className="space-y-2">
                      {pipeline.stages.map((stage: any) => (
                        <div key={stage.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                          <span className="text-sm flex-1">{stage.name}</span>
                          <Button variant="ghost" size="icon" className="w-7 h-7">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IDX / MLS */}
          <TabsContent value="idx">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">IDX / MLS Integration</CardTitle>
                  {idxConnected && (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Miami MLS highlight */}
                <div className="bg-lofty-50 border border-lofty-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-lofty-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lofty-900 text-sm">Miami Association of Realtors (MIAMI MLS)</p>
                    <p className="text-xs text-lofty-600 mt-0.5">Connect to access live MLS listings, import properties, and auto-assign buyer search profiles</p>
                    <a href="https://www.miamire.com/idx" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-lofty-600 hover:text-lofty-700 mt-1 font-medium">
                      Get IDX credentials from MIAMI MLS <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">MLS Provider</Label>
                  <select
                    value={idxConfig.provider}
                    onChange={e => setIdxConfig(c => ({ ...c, provider: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lofty-500 outline-none"
                  >
                    <option value="miami_mls">Miami Association of Realtors (MIAMI MLS)</option>
                    <option value="mls_florida">Florida MLS</option>
                    <option value="bright_mls">Bright MLS</option>
                    <option value="custom">Custom RETS / RESO</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">RETS Login URL</Label>
                    <Input
                      value={idxConfig.loginUrl}
                      onChange={e => setIdxConfig(c => ({ ...c, loginUrl: e.target.value }))}
                      placeholder="https://rets.miami-mls.com/rets/login"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">MLS Agent ID</Label>
                    <Input
                      value={idxConfig.mlsId}
                      onChange={e => setIdxConfig(c => ({ ...c, mlsId: e.target.value }))}
                      placeholder="Your MLS member ID"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">RETS Username</Label>
                    <Input
                      value={idxConfig.username}
                      onChange={e => setIdxConfig(c => ({ ...c, username: e.target.value }))}
                      placeholder="IDX username"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">RETS Password</Label>
                    <Input
                      type="password"
                      value={idxConfig.password}
                      onChange={e => setIdxConfig(c => ({ ...c, password: e.target.value }))}
                      placeholder="IDX password"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Automation Settings</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Auto-assign search profile on import</p>
                      <p className="text-xs text-gray-400">Infer buyer/seller search criteria from imported lead data</p>
                    </div>
                    <Switch
                      checked={idxConfig.autoAssignSearch}
                      onCheckedChange={v => setIdxConfig(c => ({ ...c, autoAssignSearch: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Auto-import new MLS leads</p>
                      <p className="text-xs text-gray-400">Automatically create contacts from IDX lead captures</p>
                    </div>
                    <Switch
                      checked={idxConfig.autoImport}
                      onCheckedChange={v => setIdxConfig(c => ({ ...c, autoImport: v }))}
                    />
                  </div>
                </div>

                <Button onClick={saveIdx} disabled={idxSaving} className="bg-lofty-600 hover:bg-lofty-700">
                  {idxSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save IDX Settings</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Zillow", desc: "Import leads from Zillow", connected: false },
                  { name: "Realtor.com", desc: "Sync contacts from Realtor.com", connected: false },
                  { name: "Twilio", desc: "Send SMS messages", connected: false },
                  { name: "SendGrid", desc: "Email delivery service", connected: false },
                  { name: "Google Calendar", desc: "Sync appointments", connected: false },
                  { name: "Docusign", desc: "Electronic signatures for transactions", connected: false },
                  { name: "MLS / IDX", desc: "Live property data integration", connected: false },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{integration.name}</p>
                      <p className="text-sm text-gray-500">{integration.desc}</p>
                    </div>
                    <Button size="sm" variant={integration.connected ? "outline" : "default"} className={!integration.connected ? "bg-lofty-600 hover:bg-lofty-700" : ""}>
                      {integration.connected ? "Connected" : "Connect"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Current Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <Button className="bg-lofty-600 hover:bg-lofty-700">
                  <Save className="w-4 h-4 mr-2" />Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
