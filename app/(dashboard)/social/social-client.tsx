"use client"

import { useState, useEffect } from "react"
import {
  Facebook, Instagram, Linkedin, Youtube,
  Sparkles, Send, Clock, CheckCircle2, XCircle,
  Plus, Settings, Eye, Heart, MessageCircle, Share2,
  BarChart3, Pencil, Trash2, Calendar, Globe,
  TrendingUp, Image, FileText, DollarSign, Home, Users,
  RefreshCw, ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SocialAccount {
  id: string
  platform: string
  accountName: string | null
  isConnected: boolean
  pageId: string | null
}

interface SocialPost {
  id: string
  platform: string
  content: string
  mediaUrl: string | null
  postType: string
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  aiGenerated: boolean
  createdAt: string
  account: { accountName: string | null } | null
}

interface Props {
  accounts: SocialAccount[]
  posts: SocialPost[]
}

const PLATFORMS = [
  { id: "FACEBOOK", label: "Facebook", color: "#1877F2", bg: "bg-blue-600", icon: Facebook, connectUrl: "https://developers.facebook.com/apps" },
  { id: "INSTAGRAM", label: "Instagram", color: "#E1306C", bg: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400", icon: Instagram, connectUrl: "https://developers.facebook.com/apps" },
  { id: "TIKTOK", label: "TikTok", color: "#000000", bg: "bg-black", icon: () => <span className="text-xs font-black">TT</span>, connectUrl: "https://developers.tiktok.com" },
  { id: "LINKEDIN", label: "LinkedIn", color: "#0A66C2", bg: "bg-blue-700", icon: Linkedin, connectUrl: "https://developer.linkedin.com" },
  { id: "GOOGLE_BUSINESS", label: "Google Business", color: "#4285F4", bg: "bg-blue-500", icon: Globe, connectUrl: "https://business.google.com" },
  { id: "YOUTUBE", label: "YouTube", color: "#FF0000", bg: "bg-red-600", icon: Youtube, connectUrl: "https://console.developers.google.com" },
]

const CONTENT_TYPES = [
  { id: "property_showcase", label: "Property Showcase", icon: Home, color: "text-lofty-600" },
  { id: "market_update", label: "Market Update", icon: TrendingUp, color: "text-green-600" },
  { id: "buyer_tips", label: "Buyer Tips", icon: Users, color: "text-blue-600" },
  { id: "seller_tips", label: "Seller Tips", icon: DollarSign, color: "text-amber-600" },
  { id: "neighborhood_spotlight", label: "Neighborhood Spotlight", icon: Globe, color: "text-purple-600" },
  { id: "investment_tip", label: "Investment Tips", icon: BarChart3, color: "text-emerald-600" },
  { id: "success_story", label: "Success Story", icon: CheckCircle2, color: "text-pink-600" },
  { id: "market_stats", label: "Market Stats", icon: FileText, color: "text-orange-600" },
]

const POST_TYPE_LABELS: Record<string, string> = {
  POST: "Post", STORY: "Story", REEL: "Reel/Short", AD: "Ad"
}

export default function SocialClient({ accounts: initialAccounts, posts: initialPosts }: Props) {
  const [accounts, setAccounts] = useState<SocialAccount[]>(initialAccounts)
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts)
  const [activeTab, setActiveTab] = useState<"composer" | "calendar" | "analytics" | "accounts">("composer")
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false)
  const [autoPilotLoading, setAutoPilotLoading] = useState(false)

  // Load auto-pilot state on mount
  useEffect(() => {
    fetch("/api/social/autopilot-config")
      .then(r => r.json())
      .then(d => setAutoPilotEnabled(d.isEnabled ?? false))
      .catch(() => {})
  }, [])

  // Composer state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["FACEBOOK"])
  const [postContent, setPostContent] = useState("")
  const [postType, setPostType] = useState("POST")
  const [mediaUrl, setMediaUrl] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)

  // AI generator state
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiContentType, setAiContentType] = useState("market_update")
  const [aiDetails, setAiDetails] = useState("")
  const [aiPlatform, setAiPlatform] = useState("FACEBOOK")
  const [generatedContent, setGeneratedContent] = useState("")

  // Account connect state
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [connectForm, setConnectForm] = useState({ accountName: "", accessToken: "", pageId: "" })

  const connectedPlatforms = new Set(accounts.filter(a => a.isConnected).map(a => a.platform))

  async function generateContent() {
    setGenerating(true)
    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: aiPlatform, contentType: aiContentType, details: aiDetails }),
      })
      const data = await res.json()
      setGeneratedContent(data.content)
    } finally {
      setGenerating(false)
    }
  }

  function useGeneratedContent() {
    setPostContent(generatedContent)
    setSelectedPlatforms([aiPlatform])
    setShowAIPanel(false)
    setGeneratedContent("")
  }

  async function submitPost(publish = false) {
    if (!postContent.trim()) return
    setPosting(true)
    try {
      for (const platform of selectedPlatforms) {
        const account = accounts.find(a => a.platform === platform && a.isConnected)
        const res = await fetch("/api/social/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            content: postContent,
            mediaUrl: mediaUrl || undefined,
            postType,
            scheduledAt: scheduledAt || undefined,
            accountId: account?.id,
            aiGenerated: false,
          }),
        })
        const post = await res.json()
        setPosts(prev => [post, ...prev])

        if (publish && account) {
          await fetch("/api/social/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: post.id }),
          })
        }
      }
      setPostContent("")
      setMediaUrl("")
      setScheduledAt("")
    } finally {
      setPosting(false)
    }
  }

  async function connectAccount(platform: string) {
    const res = await fetch("/api/social/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, ...connectForm }),
    })
    const account = await res.json()
    setAccounts(prev => {
      const filtered = prev.filter(a => a.platform !== platform)
      return [...filtered, account]
    })
    setConnectingPlatform(null)
    setConnectForm({ accountName: "", accessToken: "", pageId: "" })
  }

  async function disconnectAccount(platform: string) {
    await fetch("/api/social/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    })
    setAccounts(prev => prev.map(a => a.platform === platform ? { ...a, isConnected: false } : a))
  }

  async function publishPost(postId: string) {
    const res = await fetch("/api/social/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
    const updated = await res.json()
    setPosts(prev => prev.map(p => p.id === postId ? updated : p))
  }

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    DRAFT: { color: "bg-gray-100 text-gray-600", icon: <Pencil className="w-3 h-3" />, label: "Draft" },
    SCHEDULED: { color: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" />, label: "Scheduled" },
    PUBLISHED: { color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" />, label: "Published" },
    FAILED: { color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" />, label: "Failed" },
  }

  const publishedPosts = posts.filter(p => p.status === "PUBLISHED")
  const totalReach = publishedPosts.reduce((a, p) => a + (p.reach || 0), 0)
  const totalLikes = publishedPosts.reduce((a, p) => a + (p.likes || 0), 0)
  const totalEngagement = publishedPosts.reduce((a, p) => a + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Social Media Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered content for Facebook, Instagram, TikTok &amp; more</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connected account pills */}
            {PLATFORMS.filter(p => connectedPlatforms.has(p.id)).map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
                <CheckCircle2 className="w-3 h-3" />
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: "composer", label: "Composer", icon: Pencil },
            { id: "calendar", label: "Scheduled", icon: Calendar },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
            { id: "accounts", label: "Accounts", icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id ? "bg-lofty-600 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── COMPOSER ── */}
        {activeTab === "composer" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* AI Generator Panel */}
            <div className="bg-gradient-to-r from-lofty-600 to-lofty-800 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <h2 className="font-semibold text-lg">AI Content Generator</h2>
                </div>
                <button
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium"
                >
                  {showAIPanel ? "Close" : "Generate Content"}
                </button>
              </div>
              {!showAIPanel && (
                <p className="text-lofty-200 text-sm">
                  Let AI write platform-optimized posts: property showcases, market updates, buyer/seller tips, neighborhood spotlights, and more.
                </p>
              )}
              {showAIPanel && (
                <div className="space-y-4">
                  {/* Platform selector */}
                  <div>
                    <label className="text-xs font-semibold text-lofty-200 mb-2 block">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.slice(0, 5).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setAiPlatform(p.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            aiPlatform === p.id ? "bg-white text-lofty-700" : "bg-white/20 hover:bg-white/30 text-white"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content type */}
                  <div>
                    <label className="text-xs font-semibold text-lofty-200 mb-2 block">Content Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CONTENT_TYPES.map(ct => (
                        <button
                          key={ct.id}
                          onClick={() => setAiContentType(ct.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                            aiContentType === ct.id ? "bg-white text-lofty-700 font-semibold" : "bg-white/15 hover:bg-white/25 text-white"
                          )}
                        >
                          <ct.icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs">{ct.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <label className="text-xs font-semibold text-lofty-200 mb-1 block">Details (optional)</label>
                    <input
                      type="text"
                      value={aiDetails}
                      onChange={e => setAiDetails(e.target.value)}
                      placeholder="e.g. 3bd/2ba home just listed in Miami at $450K, pool, modern kitchen..."
                      className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-lofty-300 focus:outline-none focus:border-white"
                    />
                  </div>

                  {/* Generated output */}
                  {generatedContent && (
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-sm text-white whitespace-pre-wrap">{generatedContent}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={useGeneratedContent}
                          className="flex items-center gap-1.5 px-4 py-2 bg-white text-lofty-700 rounded-lg text-sm font-semibold hover:bg-lofty-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Use This Content
                        </button>
                        <button
                          onClick={generateContent}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm text-white"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={generateContent}
                    disabled={generating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-lofty-700 rounded-xl font-semibold hover:bg-lofty-50 disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generating ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
              )}
            </div>

            {/* Post Composer */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Create Post</h2>

              {/* Platform selector */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Post to</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => {
                    const isSelected = selectedPlatforms.includes(p.id)
                    const isConnected = connectedPlatforms.has(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlatforms(prev =>
                          prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                        )}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                          isSelected ? "border-lofty-500 bg-lofty-50 text-lofty-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0", p.bg)}>
                          <p.icon className="w-3 h-3" />
                        </div>
                        {p.label}
                        {!isConnected && <span className="text-xs text-orange-500 ml-1">(not connected)</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Content</label>
                <textarea
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder="What's on your mind? Share a market update, new listing, or real estate tip..."
                  rows={6}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lofty-500 resize-none"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">{postContent.length} characters</span>
                  {postContent.length > 280 && (
                    <span className="text-xs text-amber-600">Long for Twitter/X — ideal for Facebook/LinkedIn</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Media URL */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Media URL (image/video)</label>
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                  />
                </div>
                {/* Post type */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Post Type</label>
                  <select
                    value={postType}
                    onChange={e => setPostType(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                  >
                    {Object.entries(POST_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Schedule (leave blank to post now)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                />
              </div>

              {/* Preview */}
              {postContent && (
                <div className="mb-5 p-4 bg-gray-50 rounded-xl border-l-4 border-lofty-400">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Preview</div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{postContent}</p>
                  {mediaUrl && (
                    <div className="mt-2 w-full h-24 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">
                      <Image className="w-4 h-4 mr-1" /> Media attached
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => submitPost(false)}
                  disabled={!postContent.trim() || posting}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-lofty-500 text-lofty-700 rounded-xl font-semibold hover:bg-lofty-50 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" /> Save as Draft
                </button>
                <button
                  onClick={() => submitPost(true)}
                  disabled={!postContent.trim() || posting || selectedPlatforms.every(p => !connectedPlatforms.has(p))}
                  className="flex items-center gap-2 px-6 py-2.5 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  {scheduledAt ? "Schedule Post" : "Publish Now"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULED/RECENT POSTS ── */}
        {activeTab === "calendar" && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Auto-Pilot toggle */}
            <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${autoPilotEnabled ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{autoPilotEnabled ? "🤖" : "⏸️"}</span>
                <div>
                  <p className={`text-sm font-semibold ${autoPilotEnabled ? "text-green-800" : "text-gray-700"}`}>
                    Auto-Pilot {autoPilotEnabled ? "Activo" : "Pausado"}
                  </p>
                  <p className={`text-xs ${autoPilotEnabled ? "text-green-700" : "text-gray-500"}`}>
                    {autoPilotEnabled
                      ? "2 publicaciones diarias a las 9am y 6pm ET — IA genera contenido en español automáticamente"
                      : connectedPlatforms.size === 0
                        ? "Conecta una cuenta en la pestaña Accounts para poder activarlo"
                        : "Actívalo para publicar 2 veces al día automáticamente"}
                  </p>
                </div>
              </div>
              <button
                disabled={autoPilotLoading || connectedPlatforms.size === 0}
                onClick={async () => {
                  setAutoPilotLoading(true)
                  try {
                    const res = await fetch("/api/social/autopilot-config", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isEnabled: !autoPilotEnabled }),
                    })
                    const d = await res.json()
                    setAutoPilotEnabled(d.isEnabled)
                  } finally {
                    setAutoPilotLoading(false)
                  }
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${autoPilotEnabled ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${autoPilotEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">All Posts ({posts.length})</h2>
            </div>
            {posts.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No posts yet. Create your first post in the Composer.</p>
              </div>
            ) : (
              posts.map(post => {
                const platform = PLATFORMS.find(p => p.id === post.platform)
                const sc = statusConfig[post.status] || statusConfig.DRAFT
                return (
                  <div key={post.id} className="bg-white rounded-xl border p-4 flex gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0", platform?.bg || "bg-gray-400")}>
                      {platform && <platform.icon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">{platform?.label}</span>
                        <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", sc.color)}>
                          {sc.icon} {sc.label}
                        </span>
                        {post.aiGenerated && (
                          <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <Sparkles className="w-3 h-3" /> AI
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {post.scheduledAt
                            ? `Scheduled: ${new Date(post.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                            : post.publishedAt
                            ? `Published: ${new Date(post.publishedAt).toLocaleDateString()}`
                            : new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{post.content}</p>
                      {post.status === "PUBLISHED" && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {post.reach != null && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.reach.toLocaleString()}</span>}
                          {post.likes != null && <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes.toLocaleString()}</span>}
                          {post.comments != null && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments.toLocaleString()}</span>}
                          {post.shares != null && <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {post.shares.toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                    {post.status === "DRAFT" && (
                      <button
                        onClick={() => publishPost(post.id)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-medium hover:bg-lofty-700"
                      >
                        <Send className="w-3 h-3" /> Publish
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === "analytics" && (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Posts Published", value: publishedPosts.length, icon: CheckCircle2, color: "text-green-600" },
                { label: "Total Reach", value: totalReach.toLocaleString(), icon: Eye, color: "text-blue-600" },
                { label: "Total Engagement", value: totalEngagement.toLocaleString(), icon: TrendingUp, color: "text-lofty-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border p-5">
                  <div className={cn("w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center mb-3", color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-sm text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Per-platform breakdown */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Platform Breakdown</h3>
              <div className="space-y-3">
                {PLATFORMS.map(p => {
                  const platformPosts = publishedPosts.filter(post => post.platform === p.id)
                  if (platformPosts.length === 0) return null
                  const reach = platformPosts.reduce((a, post) => a + (post.reach || 0), 0)
                  const engagement = platformPosts.reduce((a, post) => a + (post.likes || 0) + (post.comments || 0) + (post.shares || 0), 0)
                  return (
                    <div key={p.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0", p.bg)}>
                        <p.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900">{p.label}</span>
                          <span className="text-gray-500">{platformPosts.length} posts</span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>{reach.toLocaleString()} reach</span>
                          <span>{engagement.toLocaleString()} engagements</span>
                          {reach > 0 && <span>{((engagement / reach) * 100).toFixed(1)}% engagement rate</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {publishedPosts.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">No published posts yet. Start creating content to see analytics.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ACCOUNTS ── */}
        {activeTab === "accounts" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <strong>Setup required:</strong> Connect your social accounts using their API credentials. Each platform requires an access token from their developer portal.
            </div>

            {PLATFORMS.map(platform => {
              const account = accounts.find(a => a.platform === platform.id)
              const isConnected = account?.isConnected
              const isConnecting = connectingPlatform === platform.id

              return (
                <div key={platform.id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0", platform.bg)}>
                      <platform.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{platform.label}</h3>
                        {isConnected ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Connected as {account.accountName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not connected</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">Posts: {posts.filter(p => p.platform === platform.id).length}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={platform.connectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-lofty-700"
                      >
                        <ExternalLink className="w-3 h-3" /> Dev Portal
                      </a>
                      {isConnected ? (
                        <button
                          onClick={() => disconnectAccount(platform.id)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => setConnectingPlatform(isConnecting ? null : platform.id)}
                          className="px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-medium hover:bg-lofty-700"
                        >
                          {isConnecting ? "Cancel" : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isConnecting && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Account Name</label>
                          <input
                            type="text"
                            value={connectForm.accountName}
                            onChange={e => setConnectForm(f => ({ ...f, accountName: e.target.value }))}
                            placeholder="My Business Page"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                          />
                        </div>
                        {(platform.id === "FACEBOOK" || platform.id === "INSTAGRAM") && (
                          <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Page ID</label>
                            <input
                              type="text"
                              value={connectForm.pageId}
                              onChange={e => setConnectForm(f => ({ ...f, pageId: e.target.value }))}
                              placeholder="123456789"
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Access Token</label>
                        <input
                          type="password"
                          value={connectForm.accessToken}
                          onChange={e => setConnectForm(f => ({ ...f, accessToken: e.target.value }))}
                          placeholder="Paste your access token..."
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-lofty-500 font-mono"
                        />
                      </div>
                      <button
                        onClick={() => connectAccount(platform.id)}
                        disabled={!connectForm.accountName || !connectForm.accessToken}
                        className="px-5 py-2 bg-lofty-600 text-white rounded-lg text-sm font-medium hover:bg-lofty-700 disabled:opacity-40"
                      >
                        Save & Connect
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
