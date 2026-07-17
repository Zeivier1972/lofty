"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  Sparkles, Search, Image, FileText, Loader2,
  Copy, Check, ExternalLink, Download, Globe,
  TrendingUp, Video, BarChart2, Users, Home, DollarSign,
  BookOpen, RefreshCw, Send, ImageIcon, BedDouble, Bath, Maximize2,
  List, Pencil, Trash2, Eye, EyeOff, X, Save, Clapperboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import HelpPanel from "@/components/help-panel"

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "blog" | "images" | "research" | "posts" | "video" | "listing"

const AUDIENCES = [
  { id: "buyers", label: "Buyers", icon: Home },
  { id: "investors", label: "International Investors", icon: Globe },
  { id: "sellers", label: "Sellers", icon: DollarSign },
  { id: "renters", label: "Renters", icon: Users },
  { id: "first_time", label: "First-Time Buyers", icon: BookOpen },
  { id: "luxury", label: "Luxury Market", icon: TrendingUp },
]

const IMAGE_STYLES = [
  { id: "luxury", label: "Luxury" },
  { id: "modern", label: "Modern" },
  { id: "warm", label: "Warm & Inviting" },
  { id: "professional", label: "Professional" },
  { id: "social", label: "Social Media" },
  { id: "aerial", label: "Aerial / Drone" },
]

const IMAGE_SIZES = [
  { id: "square", label: "Square (1024×1024)", ratio: "1:1" },
]

const RESEARCH_TYPES = [
  { id: "market", label: "Market Trends", icon: TrendingUp },
  { id: "video", label: "Video Ideas", icon: Video },
  { id: "content", label: "Content Ideas", icon: FileText },
  { id: "seo", label: "SEO Keywords", icon: Search },
  { id: "investors", label: "Investor Trends", icon: BarChart2 },
  { id: "competition", label: "Competitor Analysis", icon: Users },
]

const BLOG_TOPIC_SUGGESTIONS: Record<string, string[]> = {
  buyers: [
    "How to Buy a Home in Miami with $0 Down Payment Programs",
    "Miami vs Fort Lauderdale: Where Should You Buy in 2025?",
    "5 Mistakes First-Time Buyers in Miami Must Avoid",
  ],
  investors: [
    "Best Pre-Construction Projects in Miami for International Investors",
    "How to Buy Miami Real Estate from Latin America: Step-by-Step Guide",
    "Miami Cap Rates vs Rental Yields: What International Investors Need to Know",
  ],
  sellers: [
    "How to Sell Your Miami Home for Top Dollar in 2025",
    "When is the Best Time to Sell a Home in South Florida?",
    "Home Staging Tips That Get Miami Homes Sold Faster",
  ],
  renters: [
    "Renting vs Buying in Miami: What Makes More Sense Right Now?",
    "How Miami Renters Can Buy Their First Home in 12 Months",
    "Miami Rent is Too High — Here's How to Get Out of the Rental Trap",
  ],
  first_time: [
    "The Complete Guide to Buying Your First Home in Miami",
    "FHA Loans in Florida: Everything First-Time Buyers Need to Know",
    "How to Get Pre-Approved for a Mortgage in Miami",
  ],
  luxury: [
    "Brickell vs Miami Beach: Which Luxury Market is Right for You?",
    "Hidden Costs of Buying a Luxury Condo in Miami",
    "Why International Buyers Choose Miami for Luxury Real Estate",
  ],
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ContentStudioClient() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") as Tab) || "blog"
  const campaignParam = searchParams.get("campaign") || ""
  const [tab, setTab] = useState<Tab>(initialTab)
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Content Studio
            </h1>
            <p className="text-gray-500 mt-1">AI-powered blog writing, image generation, market research, and video ads</p>
          </div>
          <HelpPanel section="content-studio" />
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-8 w-fit shadow-sm">
          {[
            { id: "blog" as Tab, label: "Blog Writer", icon: FileText },
            { id: "images" as Tab, label: "Image Generator", icon: Image },
            { id: "research" as Tab, label: "Research", icon: Search },
            { id: "posts" as Tab, label: "My Posts", icon: List },
            { id: "video" as Tab, label: "Video Ads", icon: Clapperboard },
            { id: "listing" as Tab, label: "Listing Video", icon: Home },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                tab === id ? "bg-purple-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100")}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "blog" && <BlogWriter toast={toast} />}
        {tab === "images" && <ImageGenerator toast={toast} />}
        {tab === "research" && <ResearchTool toast={toast} />}
        {tab === "posts" && <PostsManager toast={toast} />}
        {tab === "video" && <VideoStudio toast={toast} campaignKeyword={campaignParam} />}
        {tab === "listing" && <ListingVideoStudio toast={toast} />}
      </div>
    </div>
  )
}

// ── Blog Writer ──────────────────────────────────────────────────────────────

function BlogWriter({ toast }: { toast: any }) {
  const [audience, setAudience] = useState("buyers")
  const [topic, setTopic] = useState("")
  const [language, setLanguage] = useState<"es" | "en" | "both">("es")
  const [loading, setLoading] = useState(false)
  const [post, setPost] = useState<any>(null)
  const [featuredImage, setFeaturedImage] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [relatedListings, setRelatedListings] = useState<any[]>([])
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [copied, setCopied] = useState(false)

  const suggestions = BLOG_TOPIC_SUGGESTIONS[audience] || []

  const fetchRelatedListings = async (aud: string, tags: string[]) => {
    try {
      const res = await fetch("/api/properties/blog-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: aud, tags }),
      })
      const data = await res.json()
      if (res.ok) setRelatedListings(data.properties || [])
    } catch { /* listings are optional */ }
  }

  const generateImage = async (title: string) => {
    setImageLoading(true)
    try {
      const res = await fetch("/api/ai/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Professional real estate marketing photo for a blog post titled: "${title}"`,
          style: "professional",
          size: "square",
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) setFeaturedImage(data.url)
    } catch {
      // image is optional, don't block the blog
    } finally {
      setImageLoading(false)
    }
  }

  const generate = async () => {
    if (!topic.trim()) { toast({ title: "Enter a topic", variant: "destructive" }); return }
    setLoading(true); setPost(null); setPublished(false); setFeaturedImage(null); setRelatedListings([])
    try {
      const res = await fetch("/api/ai/blog-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPost(data)
      // auto-generate featured image and fetch related listings in background
      generateImage(data.title)
      fetchRelatedListings(audience, data.tags)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const publish = async () => {
    if (!post) return
    setPublishing(true)
    try {
      const res = await fetch("/api/ai/blog-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, language, publish: true, coverImage: featuredImage, ...post }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPublished(true)
      toast({ title: "Published!", description: "Post is live on your website" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setPublishing(false) }
  }

  const copyHtml = () => {
    if (!post) return
    navigator.clipboard.writeText(post.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadImage = async () => {
    if (!featuredImage) return
    try {
      const res = await fetch(featuredImage)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "featured-image.png"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(featuredImage, "_blank")
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">1. Choose your audience</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AUDIENCES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setAudience(id); setTopic("") }}
              className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                audience === id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50")}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">2. Enter or choose a topic</h2>
        <div className="flex gap-2 mb-3">
          {(["es", "en", "both"] as const).map(l => (
            <button key={l} onClick={() => setLanguage(l)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                language === l ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
              {l === "es" ? "Español" : l === "en" ? "English" : "Bilingual"}
            </button>
          ))}
        </div>
        <textarea value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="What should this blog post be about? Be specific — e.g. 'How Colombian families can buy a home in Doral with FHA'"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-3" />
        {suggestions.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Suggested topics:</p>
            <div className="space-y-1">
              {suggestions.map(s => (
                <button key={s} onClick={() => setTopic(s)}
                  className="block text-left text-xs text-purple-600 hover:text-purple-800 hover:underline">
                  → {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={generate} disabled={loading || !topic.trim()}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing post...</> : <><Sparkles className="w-4 h-4" /> Generate SEO Blog Post</>}
        </button>
      </div>

      {post && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Featured image */}
          <div className="relative bg-gray-100 border-b border-gray-200">
            {imageLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Generating featured image…</span>
              </div>
            ) : featuredImage ? (
              <div className="relative group">
                <img src={featuredImage} alt="Featured" className="w-full max-h-72 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button onClick={downloadImage}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-lg text-sm font-medium shadow-lg hover:bg-gray-50">
                    <Download className="w-4 h-4" /> Download Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-300">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">
            {/* Title + meta */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-snug">{post.title}</h2>
              <p className="text-sm text-gray-500 mt-2 italic">{post.metaDescription}</p>
              {post.tags && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {(Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags || "[]")).map((t: string) => (
                    <span key={t} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-sm text-purple-800 italic">
              {post.excerpt}
            </div>

            {/* Full content with typography */}
            <div
              className="prose prose-gray prose-headings:font-bold prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none border border-gray-100 rounded-xl p-6"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Related MLS Listings */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-500" />
                Related Listings
                <span className="text-xs font-normal text-gray-400 ml-1">— auto-matched from MLS</span>
              </h3>
              {relatedListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {relatedListings.map(p => (
                    <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-32 bg-gray-100 relative overflow-hidden">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.address} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-300">
                            <Home className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5">
                          <span className="text-white text-xs font-bold">${p.price?.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.address}</p>
                        <p className="text-xs text-gray-400 truncate">{p.city}</p>
                        <div className="flex gap-2 mt-1.5 text-xs text-gray-500">
                          {p.bedrooms && <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{p.bedrooms}bd</span>}
                          {p.bathrooms && <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{p.bathrooms}ba</span>}
                          {p.sqft && <span className="flex items-center gap-0.5"><Maximize2 className="w-3 h-3" />{p.sqft?.toLocaleString()}ft²</span>}
                        </div>
                        {p.mlsId && <p className="text-xs text-purple-500 mt-1">MLS# {p.mlsId}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                  <Home className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                  MLS listings will appear here automatically once your MLS feed is connected
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-2">
              <button onClick={copyHtml}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                {copied ? <><Check className="w-4 h-4 text-green-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy HTML</>}
              </button>
              {published ? (
                <a href="/site/blog" target="_blank"
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  <ExternalLink className="w-4 h-4" /> View on Site
                </a>
              ) : (
                <button onClick={publish} disabled={publishing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {publishing ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4" /> Publish to Website</>}
                </button>
              )}
              <button onClick={generate} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Image Generator ──────────────────────────────────────────────────────────

function ImageGenerator({ toast }: { toast: any }) {
  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("professional")
  const [size, setSize] = useState("square")
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([])

  const generate = async () => {
    if (!prompt.trim()) { toast({ title: "Describe the image you want", variant: "destructive" }); return }
    setLoading(true)
    try {
      const res = await fetch("/api/ai/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, size }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImages(prev => [{ url: data.url, prompt: data.prompt }, ...prev])
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const copy = (url: string) => {
    navigator.clipboard.writeText(url)
    toast({ title: "URL copied!" })
  }

  const download = async (url: string, index: number) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `lofty-image-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(url, "_blank")
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Describe your image</h2>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. 'A beautiful waterfront condo in Brickell with Miami skyline at sunset' or 'Happy Latino family getting keys to their first home in Doral'"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-4" />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Style</p>
            <div className="space-y-1">
              {IMAGE_STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                    style === s.id ? "bg-purple-100 text-purple-700 font-medium" : "text-gray-600 hover:bg-gray-50")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Size</p>
            <div className="space-y-1">
              {IMAGE_SIZES.map(s => (
                <button key={s.id} onClick={() => setSize(s.id)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                    size === s.id ? "bg-purple-100 text-purple-700 font-medium" : "text-gray-600 hover:bg-gray-50")}>
                  {s.label}
                  <span className="text-xs text-gray-400 ml-1">({s.ratio})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating (30-60 sec)...</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
        </button>
      </div>

      {images.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Generated Images</h2>
          {images.map((img, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <img src={img.url} alt="Generated" className="w-full object-cover" />
              <div className="p-4 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-400 flex-1 truncate">{img.prompt}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => copy(img.url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
                    <Copy className="w-3.5 h-3.5" /> Copy URL
                  </button>
                  <button onClick={() => download(img.url, i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Posts Manager ─────────────────────────────────────────────────────────────

function PostsManager({ toast }: { toast: any }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/blog")
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: "Failed to load posts", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startEdit = (post: any) => {
    setEditingId(post.id)
    setEditForm({
      title: post.title,
      excerpt: post.excerpt || "",
      content: post.content,
      coverImage: post.coverImage || "",
      published: post.published,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const save = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/blog/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error("Save failed")
      toast({ title: "Post updated" })
      setEditingId(null)
      await load()
    } catch {
      toast({ title: "Error saving post", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/blog/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Post deleted" })
      setConfirmDeleteId(null)
      await load()
    } catch {
      toast({ title: "Error deleting post", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading posts…
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No posts yet</p>
        <p className="text-sm text-gray-400 mt-1">Use the Blog Writer tab to create and publish your first post.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
        <a href="/site/blog" target="_blank"
          className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium">
          <ExternalLink className="w-3.5 h-3.5" /> View Blog
        </a>
      </div>

      {posts.map(post => (
        <div key={post.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {editingId === post.id ? (
            /* ── Edit form ── */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-800">Edit Post</h3>
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Title</label>
                <input value={editForm.title}
                  onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Excerpt</label>
                <textarea value={editForm.excerpt}
                  onChange={e => setEditForm((f: any) => ({ ...f, excerpt: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Cover Image URL</label>
                <input value={editForm.coverImage}
                  onChange={e => setEditForm((f: any) => ({ ...f, coverImage: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Content (HTML)</label>
                <textarea value={editForm.content}
                  onChange={e => setEditForm((f: any) => ({ ...f, content: e.target.value }))}
                  rows={12}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditForm((f: any) => ({ ...f, published: !f.published }))}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                    editForm.published
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {editForm.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {editForm.published ? "Published" : "Draft"}
                </button>
                <div className="flex gap-2 ml-auto">
                  <button onClick={cancelEdit}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── List row ── */
            <div className="flex gap-4 p-4 items-start">
              {post.coverImage && (
                <img src={post.coverImage} alt="" className="w-20 h-16 object-cover rounded-xl flex-shrink-0 bg-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{post.title}</h3>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                    post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {post.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {post.published ? "Published" : "Draft"}
                  </span>
                </div>
                {post.excerpt && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
                <p className="text-xs text-gray-400 mt-1.5">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {post.published && (
                  <a href={`/site/blog/${post.slug}`} target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                )}
                <button onClick={() => startEdit(post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {confirmDeleteId === post.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => confirmDelete(post.id)} disabled={deletingId === post.id}
                      className="flex items-center gap-1 px-2 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                      {deletingId === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Video Studio ─────────────────────────────────────────────────────────────

const CAMPAIGN_SCRIPTS: Record<string, string> = {
  BRICKELL: "¡Hola! Soy Catherine Gomez, Realtor en Miami. Brickell es el corazón financiero de Miami — condos de lujo, vida cosmopolita y una de las mejores rentabilidades del mercado. Tengo unidades de preconstrucción disponibles hoy con solo el 10% de depósito. ¿Te interesa invertir en Brickell? El enlace para agendar tu consulta gratuita está en mi perfil. ¡Hablemos!",
  FAMILIA: "¡Hola! Soy Catherine Gomez, tu Realtor de confianza en Miami. Si buscas el hogar perfecto para tu familia en el Sur de Florida, estás en el lugar correcto. Tengo opciones increíbles en Doral, Miramar y Pembroke Pines — con escuelas A, seguridad y espacio para crecer. Agenda tu consulta gratuita hoy, es en español y sin costo. ¡Nos vemos pronto!",
  DOLARES: "¡Hola! Soy Catherine Gomez, Realtor en Miami. ¿Quieres proteger tus ahorros de la devaluación y generar ingresos pasivos en dólares? Comprar propiedad en Florida es la respuesta. No necesitas residencia — solo tu pasaporte. Yo te guío en cada paso. Agenda tu consulta gratuita hoy mismo. El enlace está en mi perfil.",
}

const RATIO_OPTIONS = [
  { id: "16:9", label: "Horizontal", desc: "Facebook Feed / YouTube", w: 32, h: 18 },
  { id: "9:16", label: "Vertical",   desc: "Reels / Stories / TikTok", w: 18, h: 32 },
  { id: "1:1",  label: "Cuadrado",   desc: "Instagram Square", w: 24, h: 24 },
]

const VIDEO_STYLES = [
  {
    id: "none",
    name: "Sin fondo",
    desc: "Avatar sin fondo adicional",
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
  {
    id: "cinematic",
    name: "Lujo Miami",
    desc: "Casa de lujo, hora dorada",
    bg: "bg-amber-900",
    border: "border-amber-600",
    text: "text-amber-100",
    dot: "bg-amber-300",
  },
  {
    id: "thriller",
    name: "High-Rise Noche",
    desc: "Edificio de lujo nocturno",
    bg: "bg-slate-900",
    border: "border-slate-600",
    text: "text-slate-200",
    dot: "bg-blue-400",
  },
  {
    id: "retro_tech",
    name: "Arquitectura Moderna",
    desc: "Minimalista y contemporáneo",
    bg: "bg-zinc-800",
    border: "border-zinc-500",
    text: "text-zinc-100",
    dot: "bg-white",
  },
  {
    id: "pop_culture",
    name: "Miami Beach",
    desc: "Frente al mar, South Florida",
    bg: "bg-cyan-600",
    border: "border-cyan-300",
    text: "text-white",
    dot: "bg-yellow-300",
  },
  {
    id: "modern",
    name: "Casa Blanca Moderna",
    desc: "Propiedad limpia y elegante",
    bg: "bg-gray-200",
    border: "border-gray-400",
    text: "text-gray-800",
    dot: "bg-gray-600",
  },
  {
    id: "warm",
    name: "Hogar Familiar",
    desc: "Casa suburbana cálida",
    bg: "bg-orange-100",
    border: "border-orange-400",
    text: "text-orange-900",
    dot: "bg-orange-500",
  },
  {
    id: "handmade",
    name: "Piscina & Jardín",
    desc: "Home con piscina de lujo",
    bg: "bg-emerald-700",
    border: "border-emerald-400",
    text: "text-white",
    dot: "bg-emerald-200",
  },
  {
    id: "iconic",
    name: "Penthouse Interior",
    desc: "Interior de lujo, primer plano",
    bg: "bg-neutral-800",
    border: "border-yellow-500",
    text: "text-yellow-200",
    dot: "bg-yellow-400",
  },
  {
    id: "print",
    name: "Exterior Dramático",
    desc: "Fachada arquitectónica bold",
    bg: "bg-stone-800",
    border: "border-stone-400",
    text: "text-stone-100",
    dot: "bg-stone-300",
  },
]

const SCRIPT_TEMPLATES = [
  {
    label: "Hook: $0 inicial — Miami",
    script: `¿Sabías que hay un programa del gobierno de Florida que te da hasta $25,000 para tu pago inicial — y el 90% de las familias hispanas no lo sabe?

Cada mes que sigues pagando renta, estás pagando la hipoteca de tu casero. Mientras tanto, las propiedades en South Florida siguen subiendo y tu oportunidad se va reduciendo.

Soy Catherine Gomez, Realtor en Miami con más de 15 años ayudando a familias hispanas a comprar su primera casa en Florida. He cerrado más de 200 transacciones con compradores colombianos, venezolanos y cubanos usando exactamente este programa.

Comenta 'CASA' abajo y te mando GRATIS los requisitos para calificar hoy mismo.`,
  },
  {
    label: "Hook: Inversión desde Colombia",
    script: `El 70% de los colombianos que compraron en Brickell hace 5 años ya duplicaron su inversión — sin salir de Colombia.

El error más grande que cometen los inversores latinoamericanos es esperar a tener la residencia para comprar. Solo necesitas tu pasaporte y el dinero de entrada — yo me encargo del resto.

Soy Catherine Gomez, Realtor en Miami. He ayudado a más de 150 familias colombianas a invertir en propiedades en South Florida. Miami ha valorizado más del 60% en los últimos 5 años y los precios siguen subiendo cada trimestre.

Comenta 'COLOMBIA' abajo y te mando el paso a paso de cómo comprar en Miami desde el exterior.`,
  },
  {
    label: "Hook: Airbnb Orlando $4K/mes",
    script: `Orlando recibe 75 millones de turistas al año — y una sola propiedad puede generarte entre $3,000 y $5,000 al mes con Airbnb.

La mayoría cree que necesita estar físicamente en Florida para manejar un Airbnb. La realidad: con los servicios de administración correctos, puedes generar ingresos pasivos en dólares desde Colombia, sin pisar el país.

Soy Catherine Gomez, Realtor en Florida. Especializada en propiedades de renta vacacional en Orlando y South Florida. El retorno de inversión promedio supera el 12% anual — más que cualquier banco o CDT.

Comenta 'ORLANDO' abajo y te mando los números reales: precio, renta mensual y ROI de propiedades disponibles hoy.`,
  },
  {
    label: "Hook: Por qué no esperar",
    script: `Cada mes que esperas para comprar en Miami, estás perdiendo dinero. Las propiedades en South Florida subieron 9% en promedio este año — eso es $36,000 más en una propiedad de $400,000.

El mercado no espera. Y las tasas de interés, aunque altas hoy, bajarán — y cuando bajen, todos van a querer comprar al mismo tiempo.

Soy Catherine Gomez, Realtor en Miami. He visto este ciclo tres veces en 15 años. Los que compraron cuando todos tenían miedo son los que hoy tienen patrimonio real en dólares.

Comenta 'LISTO' abajo y agendamos tu consulta gratuita esta semana — completamente en español.`,
  },
]

function VideoStudio({ toast, campaignKeyword }: { toast: any; campaignKeyword?: string }) {
  const [avatars, setAvatars] = useState<any[]>([])
  const [voices, setVoices] = useState<any[]>([])
  const [avatarId, setAvatarId] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [script, setScript] = useState("")
  const [ratio, setRatio] = useState("9:16")
  const [styleId, setStyleId] = useState("none")
  const [broll, setBroll] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [researchingScript, setResearchingScript] = useState(false)
  const [researchBrief, setResearchBrief] = useState<{ topic?: string; hook?: string } | null>(null)
  const [heygenPrompt, setHeygenPrompt] = useState("")
  const [status, setStatus] = useState<"idle" | "processing" | "captions" | "completed" | "failed">("idle")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [pasteUrl, setPasteUrl] = useState("")
  const [generatingGuide, setGeneratingGuide] = useState(false)
  const [guideUrl, setGuideUrl] = useState<string | null>(null)
  const [postPlatform, setPostPlatform] = useState("INSTAGRAM")
  const [postCaption, setPostCaption] = useState("")
  const [generatingCaption, setGeneratingCaption] = useState(false)
  // External content → SEO + AIO + PDF
  const [extContent, setExtContent] = useState("")
  const [extPlatform, setExtPlatform] = useState("INSTAGRAM")
  const [extLoading, setExtLoading] = useState(false)
  const [extResult, setExtResult] = useState<any | null>(null)
  const [extPdfLoading, setExtPdfLoading] = useState(false)
  const [extPdfUrl, setExtPdfUrl] = useState<string | null>(null)
  const [extKeyword, setExtKeyword] = useState("")
  const [extPdfConflict, setExtPdfConflict] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<"idle" | "success" | "error">("idle")
  const [publishError, setPublishError] = useState("")
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Remotion state
  const [rConfig, setRConfig] = useState<any>(null)
  const [rLoading, setRLoading] = useState(false)
  const [rCopied, setRCopied] = useState(false)

  useEffect(() => {
    // Pre-fill script from campaign keyword if navigated from a campaign card
    if (campaignKeyword) {
      const kw = campaignKeyword.toUpperCase()
      const preScript = CAMPAIGN_SCRIPTS[kw] || `¡Hola! Soy Catherine Gomez, Realtor en Miami. Tengo propiedades increíbles relacionadas con ${campaignKeyword}. Agenda tu consulta gratuita hoy — el enlace está en mi perfil.`
      setScript(preScript)
    }

    Promise.all([
      fetch("/api/heygen/avatars").then(r => r.json()),
      fetch("/api/heygen/voices").then(r => r.json()),
    ]).then(([avatarData, voiceData]) => {
      const avatarList: any[] = avatarData?.data?.avatars || []
      const allVoices: any[] = voiceData?.data?.voices || []
      // Use exact language match — .includes("es") incorrectly matches Portuguese/Vietnamese/Japanese
      const isSpanishVoice = (v: any) =>
        v.language === "es" || v.locale?.startsWith("es-") || v.locale === "es" ||
        v.name?.toLowerCase().includes("catherine")
      const spanishVoices = allVoices.filter(isSpanishVoice)

      // Catherine's avatars come first (tagged with group:"Catherine Gomez" by the API)
      const catherineAvatars = avatarList.filter((a: any) => a.group === "Catherine Gomez")
      const stockAvatars = avatarList.filter((a: any) => a.group !== "Catherine Gomez")
      setAvatars([...catherineAvatars, ...stockAvatars])
      setVoices(spanishVoices.length > 0 ? spanishVoices : allVoices)

      // Auto-select first Catherine avatar
      if (catherineAvatars[0]) setAvatarId(catherineAvatars[0].avatar_id)
      else if (avatarList[0]) setAvatarId(avatarList[0].avatar_id)

      // Prefer Catalina voice (used in HeyGen for Catherine); fall back to first Spanish
      const catherineVoice = spanishVoices.find((v: any) =>
        v.name?.toLowerCase().includes("catalina") || v.name?.toLowerCase().includes("catherine")
      )
      const firstSpanish = catherineVoice || spanishVoices[0] || allVoices[0]
      if (firstSpanish) setVoiceId(firstSpanish.voice_id)
    }).catch(() => {
      toast({ title: "Error cargando HeyGen", variant: "destructive" })
    }).finally(() => setLoadingData(false))

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [campaignKeyword])

  const pollCaptionsStatus = (renderId: string, fallbackVideoUrl: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/creatomate/status?renderId=${renderId}`)
        const data = await res.json()
        if (data.status === "succeeded" && data.url) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setStatus("completed")
          setVideoUrl(data.url)
          toast({ title: "¡Video con captions listo! 🎬✨" })
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!)
          pollRef.current = null
          // Fall back to raw HeyGen video
          setStatus("completed")
          setVideoUrl(fallbackVideoUrl)
          toast({ title: "Video listo (sin kinetic captions)", variant: "default" })
        }
      } catch { /* keep polling */ }
    }, 5000)
  }

  const pollStatus = (videoId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/heygen/status?videoId=${videoId}`)
        const data = await res.json()
        const s = data?.data?.status
        if (s === "completed") {
          clearInterval(pollRef.current!)
          pollRef.current = null
          const heygenUrl: string = data.data.video_url
          setThumbnailUrl(data.data.thumbnail_url || null)

          // Submit to Creatomate for kinetic captions
          setStatus("captions")
          toast({ title: "Video generado — aplicando kinetic captions... ✨" })
          try {
            const ctRes = await fetch("/api/creatomate/captions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoUrl: heygenUrl, width: 720, height: 1280 }),
            })
            const ctData = await ctRes.json()
            if (ctData.renderId) {
              pollCaptionsStatus(ctData.renderId, heygenUrl)
            } else {
              // Creatomate not available — show raw video
              setStatus("completed")
              setVideoUrl(heygenUrl)
              toast({ title: "¡Video listo! 🎬" })
            }
          } catch {
            setStatus("completed")
            setVideoUrl(heygenUrl)
            toast({ title: "¡Video listo! 🎬" })
          }
        } else if (s === "failed") {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setStatus("failed")
          toast({ title: "Error al generar el video", variant: "destructive" })
        }
      } catch { /* keep polling */ }
    }, 6000)
  }

  const generateCaption = async () => {
    setGeneratingCaption(true)
    setPostCaption("")
    try {
      const res = await fetch("/api/heygen/video-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: postPlatform, script, topic: researchBrief?.topic }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPostCaption(data.content || "")
      toast({ title: "Texto generado con IA ✨" })
    } catch (e: any) {
      toast({ title: "Error generando texto", description: e.message, variant: "destructive" })
    } finally {
      setGeneratingCaption(false)
    }
  }

  const publishVideo = async () => {
    if (!videoUrl || !postCaption.trim()) return
    setPublishing(true)
    setPublishResult("idle")
    setPublishError("")
    try {
      const res = await fetch("/api/heygen/post-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: postPlatform, videoUrl, content: postCaption }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Publicación falló")
      setPublishResult("success")
      toast({ title: `¡Publicado en ${postPlatform}! 🎉` })
    } catch (e: any) {
      setPublishResult("error")
      setPublishError(e.message)
      toast({ title: "Error al publicar", description: e.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  const generateAIScript = async () => {
    setResearchingScript(true)
    setResearchBrief(null)
    setHeygenPrompt("")
    try {
      const res = await fetch("/api/heygen/research")
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const generatedScript = data.script || ""
      setScript(generatedScript)
      if (data.heygenPrompt) setHeygenPrompt(data.heygenPrompt)
      if (data.topic || data.hook) setResearchBrief({ topic: data.topic, hook: data.hook })
      toast({ title: "Guión generado con investigación viral ✨" })
      // Fire-and-forget: generate the lead magnet guide in the background
      if (generatedScript) {
        fetch("/api/ai/generate-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: generatedScript }),
        }).catch(() => undefined)
      }
    } catch (e: any) {
      toast({ title: "Error generando guión", description: e.message, variant: "destructive" })
    } finally {
      setResearchingScript(false)
    }
  }

  const generateGuide = async () => {
    if (!script.trim()) { toast({ title: "Escribe el guión primero", variant: "destructive" }); return }
    setGeneratingGuide(true)
    setGuideUrl(null)
    try {
      const res = await fetch("/api/ai/generate-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGuideUrl(data.guideUrl)
      toast({ title: `Guía creada para "${data.keyword}" ✅`, description: data.title })
    } catch (e: any) {
      toast({ title: "Error creando guía", description: e.message, variant: "destructive" })
    } finally {
      setGeneratingGuide(false)
    }
  }

  const generateExtSeoAio = async () => {
    if (!extContent.trim()) { toast({ title: "Pega el contenido primero", variant: "destructive" }); return }
    setExtLoading(true)
    setExtResult(null)
    setExtPdfUrl(null)
    try {
      const res = await fetch("/api/content/seo-aio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: extContent, platform: extPlatform }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      setExtResult(data)
      toast({ title: `SEO + AIO generado ✨`, description: data.keyword ? `Keyword: ${data.keyword}` : undefined })
    } catch (e: any) {
      toast({ title: "Error generando SEO/AIO", description: e.message, variant: "destructive" })
    } finally {
      setExtLoading(false)
    }
  }

  const generateExtPdf = async (overwrite = false) => {
    if (!extContent.trim()) { toast({ title: "Pega el contenido primero", variant: "destructive" }); return }
    if (!extKeyword.trim()) { toast({ title: "Escribe una palabra clave (trigger) para el PDF", variant: "destructive" }); return }
    setExtPdfLoading(true)
    if (!overwrite) { setExtPdfUrl(null); setExtPdfConflict(null) }
    try {
      const res = await fetch("/api/ai/generate-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: extContent, keyword: extKeyword, overwrite }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Keyword already had a PDF and we didn't overwrite → ask before clobbering.
      if (data.skipped && !overwrite) {
        setExtPdfConflict(data.keyword)
        return
      }
      setExtPdfConflict(null)
      setExtPdfUrl(data.guideUrl)
      toast({ title: `PDF listo para "${data.keyword}" ✅`, description: "Ya aparece en Campañas para Instagram y Facebook." })
    } catch (e: any) {
      toast({ title: "Error creando PDF", description: e.message, variant: "destructive" })
    } finally {
      setExtPdfLoading(false)
    }
  }

  const generate = async () => {
    if (!script.trim()) { toast({ title: "Escribe el guión", variant: "destructive" }); return }
    if (!avatarId) { toast({ title: "Selecciona un avatar", variant: "destructive" }); return }
    if (!voiceId) { toast({ title: "Selecciona una voz", variant: "destructive" }); return }

    if (pollRef.current) clearInterval(pollRef.current)
    setGenerating(true)
    setStatus("idle")
    setVideoUrl(null)
    setThumbnailUrl(null)

    // Fire-and-forget: generate the lead magnet guide from this script
    fetch("/api/ai/generate-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script }),
    }).catch(() => undefined)

    try {
      const res = await fetch("/api/heygen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId, voiceId, script, ratio, styleId: styleId !== "none" ? styleId : undefined, broll }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus("processing")
      pollStatus(data.videoId)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      setStatus("idle")
    } finally {
      setGenerating(false)
    }
  }

  const generateVideoAdConfig = async () => {
    if (!script.trim()) {
      toast({ title: "Escribe el guión primero", variant: "destructive" })
      return
    }
    setRLoading(true)
    setRConfig(null)
    try {
      const res = await fetch("/api/remotion/video-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRConfig(data)
      toast({ title: `Config lista — ${data.meta.sceneCount} escenas, ${data.meta.totalSeconds}s` })
    } catch (e: any) {
      toast({ title: "Error generando config", description: e.message, variant: "destructive" })
    } finally {
      setRLoading(false)
    }
  }

  const downloadVideoAdConfig = () => {
    if (!rConfig) return
    const blob = new Blob([JSON.stringify(rConfig, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `video-ad-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Conectando con HeyGen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Campaign banner */}
      {campaignKeyword && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
          <Clapperboard className="w-4 h-4 flex-shrink-0" />
          Generando video para campaña <strong className="uppercase">{campaignKeyword}</strong> — guión pre-cargado.
        </div>
      )}

      {/* Avatar + Voice */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">1. Avatar y voz</h2>

        {/* Avatar dropdown + preview */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Avatar</label>
          <div className="flex items-start gap-3">
            <select
              value={avatarId}
              onChange={e => setAvatarId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              {(() => {
                const catherineGroup = avatars.filter((a: any) => a.group === "Catherine Gomez")
                const stockGroup = avatars.filter((a: any) => a.group !== "Catherine Gomez")
                return (
                  <>
                    {catherineGroup.length > 0 && (
                      <optgroup label="— Catherine Gomez (tus avatares) —">
                        {catherineGroup.map((a: any) => (
                          <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>
                        ))}
                      </optgroup>
                    )}
                    {stockGroup.length > 0 && (
                      <optgroup label="— Stock Avatars —">
                        {stockGroup.map((a: any) => (
                          <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )
              })()}
            </select>
            {(() => {
              const selected = avatars.find((a: any) => a.avatar_id === avatarId)
              const thumb = selected?.preview_image_url || selected?.thumbnail_url || null
              return thumb ? (
                <img src={thumb} alt={selected?.avatar_name}
                  className="w-16 h-16 rounded-xl object-cover object-top border border-gray-200 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
                  <span className="text-xl">👤</span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Voice dropdown */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Voz (Español)</label>
          <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            {voices.map((v: any) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.name}{v.language ? ` — ${v.language}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Format */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">2. Formato</h2>
        <div className="grid grid-cols-3 gap-3">
          {RATIO_OPTIONS.map(r => (
            <button key={r.id} onClick={() => setRatio(r.id)}
              className={cn("flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-center transition-all",
                ratio === r.id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50")}>
              <div
                className={cn("rounded border-2", ratio === r.id ? "bg-purple-200 border-purple-500" : "bg-gray-200 border-gray-400")}
                style={{ width: r.w, height: r.h }}
              />
              <span className="text-xs font-semibold">{r.label} ({r.id})</span>
              <span className="text-xs text-gray-400">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style / Brand System */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-1">3. Fondo de bienes raíces</h2>
        <p className="text-xs text-gray-400 mb-4">Selecciona la imagen de propiedad que aparecerá detrás de Catherine en el video</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {VIDEO_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setStyleId(s.id)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                s.bg,
                styleId === s.id ? "border-purple-500 ring-2 ring-purple-400 ring-offset-1 scale-[1.03]" : s.border + " opacity-85 hover:opacity-100 hover:scale-[1.01]"
              )}
            >
              <span className={cn("w-3 h-3 rounded-full flex-shrink-0", s.dot)} />
              <span className={cn("text-xs font-semibold leading-tight", s.text)}>{s.name}</span>
              <span className={cn("text-[10px] leading-tight opacity-80", s.text)}>{s.desc}</span>
              {styleId === s.id && (
                <span className="absolute top-1 right-1 bg-purple-500 rounded-full p-0.5">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* B-Roll toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">4. B-Roll (multi-escena)</h2>
            <p className="text-xs text-gray-400 mt-1">
              {broll
                ? "El guión se divide en 2–4 escenas, cada una con una imagen de propiedad diferente — como en HeyGen Studio"
                : "Video de una sola escena con el fondo seleccionado arriba"}
            </p>
          </div>
          <button
            onClick={() => setBroll(b => !b)}
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0",
              broll ? "bg-purple-600" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                broll ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        {broll && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {[
              { label: "Lujo Miami", color: "bg-amber-800" },
              { label: "High-Rise", color: "bg-slate-800" },
              { label: "Moderna", color: "bg-zinc-700" },
              { label: "Miami Beach", color: "bg-cyan-600" },
              { label: "Piscina", color: "bg-emerald-700" },
            ].map(s => (
              <div key={s.label} className={cn("rounded-lg h-8 flex items-center justify-center text-white text-[10px] font-medium", s.color)}>
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External content → SEO + AIO + PDF */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-800">Contenido externo → SEO + AIO + PDF</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">¿Tienes una idea o un texto de otra IA (ChatGPT, etc.)? Pégalo aquí y genero el SEO + AIO listo para publicar en redes, y el PDF con su keyword.</p>

        <textarea
          value={extContent}
          onChange={e => setExtContent(e.target.value)}
          rows={5}
          placeholder="Pega aquí el contenido, idea o borrador generado por otra IA…"
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 mb-3"
        />

        <p className="text-xs font-semibold text-gray-600 mb-2">Plataforma</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[{ id: "INSTAGRAM", label: "Instagram" }, { id: "FACEBOOK", label: "Facebook" }, { id: "YOUTUBE", label: "YouTube" }, { id: "TIKTOK", label: "TikTok" }, { id: "LINKEDIN", label: "LinkedIn" }].map(p => (
            <button
              key={p.id}
              onClick={() => setExtPlatform(p.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", extPlatform === p.id ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={generateExtSeoAio}
          disabled={extLoading || !extContent.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-60 mb-4"
        >
          {extLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando SEO + AIO…</> : <><Sparkles className="w-4 h-4" /> Generar SEO + AIO para {extPlatform}</>}
        </button>

        {/* PDF with its own trigger keyword */}
        <div className="rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-600 mb-1">PDF descargable + trigger de Instagram/Facebook</p>
          <p className="text-[11px] text-gray-400 mb-2">Escribe la palabra clave (trigger). Cuando alguien la comente en tus posts, el bot enviará este PDF. Usa una palabra <strong>nueva</strong> — si repites una ya usada, reemplazará ese PDF.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={extKeyword}
              onChange={e => { setExtKeyword(e.target.value.toUpperCase()); setExtPdfConflict(null) }}
              placeholder="Ej: DSCR, LLC, EXTRANJERO…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase w-48 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <button
              onClick={() => generateExtPdf(false)}
              disabled={extPdfLoading || !extContent.trim() || !extKeyword.trim()}
              className="flex items-center justify-center gap-2 py-2 px-4 bg-white border border-purple-300 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-50 transition-colors disabled:opacity-60"
            >
              {extPdfLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando PDF…</> : <>📄 Crear PDF con keyword</>}
            </button>
          </div>

          {extPdfConflict && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              Ya existe un PDF con la palabra <strong>“{extPdfConflict}”</strong>. Puedes usar otra palabra clave arriba, o reemplazar el PDF anterior con este contenido nuevo.
              <button
                onClick={() => generateExtPdf(true)}
                disabled={extPdfLoading}
                className="ml-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md px-2 py-1 disabled:opacity-60"
              >
                Reemplazar
              </button>
            </div>
          )}

          {extPdfUrl && (
            <div className="mt-2 flex flex-col gap-1">
              <a href={extPdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-700 font-semibold hover:underline">
                <Download className="w-4 h-4" /> Ver / descargar PDF
              </a>
              <p className="text-[11px] text-emerald-600">✓ Guardado en Campañas — trigger “{extKeyword}” activo para Instagram y Facebook.</p>
            </div>
          )}
        </div>

        {extResult && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-purple-700 uppercase mb-2">SEO</p>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-400 text-xs">Keyword principal</span><p className="font-semibold text-gray-800">{extResult.keyword}</p></div>
                {extResult.secondaryKeywords?.length > 0 && <div><span className="text-gray-400 text-xs">Keywords secundarias</span><p className="text-gray-700">{extResult.secondaryKeywords.join(", ")}</p></div>}
                {extResult.title && <div><span className="text-gray-400 text-xs">Título SEO</span><p className="text-gray-800">{extResult.title}</p></div>}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Texto para {extResult.platform}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(extResult.caption || ""); toast({ title: "Copiado" }) }} className="text-xs text-purple-600 hover:underline">Copiar</button>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-2 mt-1">{extResult.caption}</p>
                </div>
                {extResult.hashtags?.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Hashtags</span>
                      <button onClick={() => { navigator.clipboard?.writeText(extResult.hashtags.join(" ")); toast({ title: "Copiado" }) }} className="text-xs text-purple-600 hover:underline">Copiar</button>
                    </div>
                    <p className="text-purple-700 text-xs">{extResult.hashtags.join(" ")}</p>
                  </div>
                )}
              </div>
            </div>

            {extResult.aio && (extResult.aio.question || extResult.aio.answer) && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <p className="text-xs font-bold text-indigo-700 uppercase mb-1">AIO · Optimización para motores de IA</p>
                <p className="text-[11px] text-gray-500 mb-2">Así es como ChatGPT, Perplexity y Google AI pueden citar tu contenido.</p>
                <div className="space-y-2 text-sm">
                  {extResult.aio.question && <div><span className="text-gray-400 text-xs">Pregunta que responde</span><p className="font-semibold text-gray-800">{extResult.aio.question}</p></div>}
                  {extResult.aio.answer && <div><span className="text-gray-400 text-xs">Respuesta directa</span><p className="text-gray-700">{extResult.aio.answer}</p></div>}
                  {extResult.aio.faqs?.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-xs">FAQs</span>
                      <ul className="mt-1 space-y-1.5">
                        {extResult.aio.faqs.map((f: any, i: number) => (
                          <li key={i} className="text-gray-700"><span className="font-semibold">{f.q}</span><br />{f.a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Script */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">5. Guión del video</h2>
          <span className="text-xs text-gray-400">{script.length} / 1500 caracteres</span>
        </div>

        {!campaignKeyword && (
          <div className="mb-3 space-y-3">
            {/* AI Research Button */}
            <button
              onClick={generateAIScript}
              disabled={researchingScript}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-60">
              {researchingScript
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Investigando tendencias virales y generando guión…</>
                : <><Sparkles className="w-4 h-4" /> Generar guión viral con IA — 4 escenas + SEO + CTA</>}
            </button>

            {researchBrief && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-800 space-y-1">
                {researchBrief.topic && <p><strong>Tema:</strong> {researchBrief.topic}</p>}
                {researchBrief.hook && <p><strong>Gancho:</strong> {researchBrief.hook}</p>}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Estructura de 4 escenas (separa con línea en blanco):</p>
              <p>🎯 <strong>Escena 1 — Hook:</strong> Dato sorprendente o pregunta que para el scroll</p>
              <p>💥 <strong>Escena 2 — Problema:</strong> El dolor real del espectador (crea urgencia)</p>
              <p>✅ <strong>Escena 3 — Solución:</strong> Catherine como experta + dato de mercado + keywords SEO</p>
              <p>📣 <strong>Escena 4 — CTA:</strong> "Comenta 'PALABRA' abajo" + qué van a recibir</p>
            </div>
            <p className="text-xs text-gray-400">O usa una plantilla lista:</p>
            <div className="grid grid-cols-2 gap-2">
              {SCRIPT_TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setScript(t.script)}
                  className="text-left px-3 py-2 bg-purple-50 text-purple-700 text-xs rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors leading-snug">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={script}
          onChange={e => { setScript(e.target.value.slice(0, 1500)); setGuideUrl(null) }}
          placeholder="Escribe el guión del video en español. Habla como si estuvieras frente a la cámara..."
          rows={7}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
        />

        <button
          onClick={generateGuide}
          disabled={generatingGuide || !script.trim()}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50">
          {generatingGuide
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando guía con IA…</>
            : <>📄 Crear Guía PDF del guión</>}
        </button>
        {guideUrl && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <span>✅ Guía lista:</span>
            <a href={guideUrl} target="_blank" rel="noreferrer" className="underline font-medium truncate">{guideUrl}</a>
          </div>
        )}

        {/* HeyGen paste-ready prompt — separate from the script, does NOT affect the PDF */}
        {heygenPrompt && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Clapperboard className="w-4 h-4" /> Prompt para HeyGen — copia y pega
              </h3>
              <button
                onClick={() => { navigator.clipboard.writeText(heygenPrompt); toast({ title: "Prompt de HeyGen copiado 📋" }) }}
                className="text-xs px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium">
                Copiar prompt
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">Pega esto en el cuadro “What do you want to create?” de HeyGen (Auto-pilot). Incluye el estilo del video + lo que dice la avatar. No afecta la guía PDF.</p>
            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans leading-relaxed max-h-80 overflow-y-auto">{heygenPrompt}</pre>
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating || !script.trim() || !avatarId || !voiceId || status === "processing" || status === "captions"}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando a HeyGen…</>
            : status === "processing"
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando video… (2–5 min)</>
            : status === "captions"
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando kinetic captions…</>
            : <><Clapperboard className="w-4 h-4" /> Generar Video Ad con HeyGen</>}
        </button>
      </div>

      {/* ── Remotion — Render locally ────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Remotion — Render desde tu terminal</h2>
            <p className="text-xs text-gray-400 mt-0.5">Renderiza el guión como video profesional con captions animados, Ken Burns y B-roll de Pexels.</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 bg-orange-500 text-white rounded-full uppercase tracking-wide">Local</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            ["Captions", "kinéticos estilo Reels"],
            ["B-roll", "Pexels por tema del guión"],
            ["Ken Burns", "en fotos de propiedad"],
            ["Branding", "tu nombre en el CTA final"],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white/5 rounded-xl p-2.5 text-xs">
              <span className="text-orange-400 font-semibold">{title}</span>
              <span className="text-gray-400"> — {desc}</span>
            </div>
          ))}
        </div>

        <button
          onClick={generateVideoAdConfig}
          disabled={rLoading || !script.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50">
          {rLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando config de Remotion…</>
            : <><Video className="w-4 h-4" /> Generar Config (usa el guión escrito arriba)</>}
        </button>

        {rConfig && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-3 text-xs">
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">{rConfig.meta.sceneCount} escenas</span>
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">{rConfig.meta.totalSeconds}s</span>
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">720×1280 · 30fps</span>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {rConfig.scenes.map((s: any, i: number) => (
                <div key={i} className="rounded-lg p-2.5 text-xs bg-white/5 border border-white/10 flex gap-2">
                  <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 bg-orange-600 text-white">
                    {s.asset_type === "video" ? "BROLL" : "FOTO"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-300">{i + 1}. {s.name} <span className="text-gray-500">({s.duration_seconds}s)</span></p>
                    <p className="text-gray-400 leading-snug text-[11px] mt-0.5 line-clamp-2">{s.script}</p>
                    <p className="text-gray-500 mt-0.5">Caption: <strong className="text-gray-400">{s.caption}</strong></p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={downloadVideoAdConfig}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-semibold transition-colors border border-white/20">
              <Download className="w-4 h-4" /> Descargar video-ad-config.json
            </button>

            <div className="bg-black/50 rounded-xl p-4 border border-gray-700">
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Terminal</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs text-green-400 font-mono break-all">
                  node scripts/render-listing.mjs --config video-ad-config.json
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("node scripts/render-listing.mjs --config video-ad-config.json")
                    setRCopied(true)
                    setTimeout(() => setRCopied(false), 2000)
                  }}
                  className="flex-shrink-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                  {rCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Descarga el JSON → ponlo en la raíz del proyecto → corre el comando</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Paste external HeyGen URL ─────────────────────────────────────── */}
      {status === "idle" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">¿Ya tienes un video de HeyGen?</h2>
          <p className="text-xs text-gray-400 mb-3">Pega el link del video para generar el texto SEO y publicarlo directamente.</p>
          <div className="flex gap-2">
            <input
              value={pasteUrl}
              onChange={e => setPasteUrl(e.target.value)}
              placeholder="https://resource.heygen.com/video/..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              disabled={!pasteUrl.trim().startsWith("http")}
              onClick={() => {
                setVideoUrl(pasteUrl.trim())
                setStatus("completed")
                setPasteUrl("")
              }}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40"
            >
              Usar este video
            </button>
          </div>
        </div>
      )}

      {/* Processing — HeyGen rendering */}
      {status === "processing" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="font-semibold text-blue-800">HeyGen está generando tu video…</p>
          <p className="text-sm text-blue-600 mt-1">Esto toma entre 2 y 5 minutos. No cierres esta pantalla.</p>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-blue-500">
            <span className="flex items-center gap-1.5 font-semibold text-blue-700"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />Avatar intro</span>
            <span>→</span>
            <span>B-roll clips</span>
            <span>→</span>
            <span>Avatar outro</span>
          </div>
        </div>
      )}

      {/* Processing — Creatomate kinetic captions */}
      {status === "captions" && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="font-semibold text-purple-800">Aplicando kinetic captions… ✨</p>
          <p className="text-sm text-purple-600 mt-1">Creatomate está agregando captions animadas palabra por palabra.</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
            <span className="w-2 h-2 bg-yellow-400 rounded-full" /> Gold highlight · Montserrat Bold
          </div>
        </div>
      )}

      {/* Result */}
      {status === "completed" && videoUrl && (
        <div className="space-y-4">
          {/* Video player */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-900 flex items-center justify-center p-4">
              <video src={videoUrl} controls poster={thumbnailUrl || undefined}
                className="max-w-full rounded-xl" style={{ maxHeight: 400 }} />
            </div>
            <div className="p-4 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <Check className="w-4 h-4" /> Video listo
              </span>
              <div className="ml-auto flex gap-2">
                <a href={videoUrl} target="_blank"
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Abrir
                </a>
                <a href={videoUrl} download="video-ad.mp4"
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                  <Download className="w-4 h-4" /> Descargar
                </a>
              </div>
            </div>
          </div>

          {/* Publish to social section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              Publicar en redes sociales
            </h3>

            {/* Platform selector */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Plataforma</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "INSTAGRAM", label: "Instagram Reels" },
                  { id: "FACEBOOK",  label: "Facebook Video" },
                  { id: "YOUTUBE",   label: "YouTube Shorts" },
                  { id: "TIKTOK",    label: "TikTok" },
                  { id: "LINKEDIN",  label: "LinkedIn" },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPostPlatform(p.id); setPostCaption(""); setPublishResult("idle") }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      postPlatform === p.id
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption generator */}
            <button
              onClick={generateCaption}
              disabled={generatingCaption}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-60"
            >
              {generatingCaption
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando texto SEO y hashtags…</>
                : <><Sparkles className="w-4 h-4" /> Generar texto con IA para {postPlatform}</>}
            </button>

            {postCaption && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-600">Texto generado — edítalo si quieres</p>
                    <span className="text-xs text-gray-400">{postCaption.length} chars</span>
                  </div>
                  <textarea
                    value={postCaption}
                    onChange={e => setPostCaption(e.target.value)}
                    rows={8}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                  />
                </div>

                {publishResult === "success" ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 font-medium">
                    <Check className="w-4 h-4" /> ¡Publicado exitosamente en {postPlatform}!
                  </div>
                ) : (
                  <>
                    {publishResult === "error" && (
                      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        {publishError}
                      </div>
                    )}
                    <button
                      onClick={publishVideo}
                      disabled={publishing || !postCaption.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {publishing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Publicando en {postPlatform}…</>
                        : <><Send className="w-4 h-4" /> Publicar en {postPlatform}</>}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm">
          Error al generar el video. Verifica el guión e intenta de nuevo.
        </div>
      )}
    </div>
  )
}

// ── Research Tool ────────────────────────────────────────────────────────────

function ResearchTool({ toast }: { toast: any }) {
  const [type, setType] = useState("market")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")
  const [copied, setCopied] = useState(false)

  const QUICK_QUERIES: Record<string, string[]> = {
    market: [
      "What are Miami real estate market trends for 2025?",
      "Which Miami neighborhoods have the best appreciation right now?",
      "How is the Miami condo market performing compared to single family homes?",
    ],
    video: [
      "What real estate video topics are trending on TikTok and Instagram Reels in 2025?",
      "Give me 10 viral hook ideas for real estate videos targeting Latino buyers",
      "What YouTube video formats get the most views for real estate agents?",
    ],
    content: [
      "What content topics resonate most with Latino first-time homebuyers?",
      "Blog post ideas for Miami real estate targeting international investors",
      "Instagram content calendar ideas for a Miami real estate agent",
    ],
    seo: [
      "What are the best long-tail keywords for Miami real estate in Spanish?",
      "Which Miami real estate search terms have high volume and low competition?",
      "SEO strategy for a Miami real estate agent website in 2025",
    ],
    investors: [
      "What are international investors looking for in Miami real estate in 2025?",
      "Best pre-construction projects in Miami for international buyers",
      "What ROI can international investors expect from Miami rental properties?",
    ],
    competition: [
      "What content strategies are top Miami real estate agents using on social media?",
      "How are successful bilingual Miami realtors growing their audience online?",
      "What marketing tactics are winning for real estate agents in the Miami Hispanic market?",
    ],
  }

  const research = async (q?: string) => {
    const finalQuery = q || query
    if (!finalQuery.trim()) { toast({ title: "Enter a research question", variant: "destructive" }); return }
    if (q) setQuery(q)
    setLoading(true); setResult("")
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const copy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Research type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {RESEARCH_TYPES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setType(id)}
              className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                type === id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50")}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">Quick questions:</p>
          <div className="space-y-1">
            {(QUICK_QUERIES[type] || []).map(q => (
              <button key={q} onClick={() => research(q)}
                className="block text-left text-xs text-purple-600 hover:text-purple-800 hover:underline">
                → {q}
              </button>
            ))}
          </div>
        </div>

        <textarea value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Or type your own research question..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-3" />

        <button onClick={() => research()} disabled={loading || !query.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching...</> : <><Search className="w-4 h-4" /> Research</>}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Research Results</h2>
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
          <div className="prose prose-gray prose-headings:font-bold prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none whitespace-pre-wrap text-gray-700">{result}</div>
        </div>
      )}
    </div>
  )
}

// ── Listing Video Studio ──────────────────────────────────────────────────────

const TIMELINE_LABELS = [
  { name: "Hook",         type: "avatar", seconds: "0–3s",   caption_hint: "JUST LISTED" },
  { name: "Exterior",     type: "broll",  seconds: "3–10s",  caption_hint: "STUNNING EXTERIOR" },
  { name: "Living Room",  type: "broll",  seconds: "10–16s", caption_hint: "OPEN CONCEPT LIVING" },
  { name: "Kitchen",      type: "broll",  seconds: "16–21s", caption_hint: "CHEF'S KITCHEN" },
  { name: "Transition",   type: "avatar", seconds: "21–27s", caption_hint: "DESIGNED TO IMPRESS" },
  { name: "Bedroom",      type: "broll",  seconds: "27–31s", caption_hint: "PRIMARY SUITE" },
  { name: "Bathroom",     type: "broll",  seconds: "31–35s", caption_hint: "SPA BATHROOM" },
  { name: "Outdoor",      type: "broll",  seconds: "35–39s", caption_hint: "PRIVATE BACKYARD" },
  { name: "Neighborhood", type: "broll",  seconds: "39–49s", caption_hint: "PRIME LOCATION" },
  { name: "CTA",          type: "avatar", seconds: "49–62s", caption_hint: "CONTACT US TODAY" },
]

function ListingVideoStudio({ toast }: { toast: any }) {
  const [avatars, setAvatars] = useState<any[]>([])
  const [voices, setVoices] = useState<any[]>([])
  const [avatarId, setAvatarId] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [property, setProperty] = useState("")
  const [photoUrlsText, setPhotoUrlsText] = useState("")
  const [agentName, setAgentName] = useState("Catherine Gomez")
  const [agentTitle, setAgentTitle] = useState("Real Estate Agent")
  const [agentPhone, setAgentPhone] = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [price, setPrice] = useState("")
  const [brandColor, setBrandColor] = useState("#FF4D1C")
  const [ratio, setRatio] = useState("9:16")
  const [loadingData, setLoadingData] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const pollRef = useRef<any>(null)

  // Remotion state
  const [rConfig, setRConfig] = useState<any>(null)
  const [rLoading, setRLoading] = useState(false)
  const [rCopied, setRCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/heygen/avatars").then(r => r.json()),
      fetch("/api/heygen/voices").then(r => r.json()),
    ]).then(([avatarData, voiceData]) => {
      const avatarList: any[] = avatarData?.data?.avatars || []
      const allVoices: any[] = voiceData?.data?.voices || []
      const isSpanish = (v: any) =>
        v.language === "es" || v.locale?.startsWith("es-") || v.name?.toLowerCase().includes("catherine")
      const spanishVoices = allVoices.filter(isSpanish)

      const catherineAvatars = avatarList.filter((a: any) => a.group === "Catherine Gomez")
      const stockAvatars = avatarList.filter((a: any) => a.group !== "Catherine Gomez")
      setAvatars([...catherineAvatars, ...stockAvatars])
      setVoices(spanishVoices.length > 0 ? spanishVoices : allVoices)

      if (catherineAvatars[0]) setAvatarId(catherineAvatars[0].avatar_id)
      else if (avatarList[0]) setAvatarId(avatarList[0].avatar_id)

      const catherineVoice = spanishVoices.find((v: any) =>
        v.name?.toLowerCase().includes("catalina") || v.name?.toLowerCase().includes("catherine")
      )
      if (catherineVoice || spanishVoices[0] || allVoices[0]) {
        setVoiceId((catherineVoice || spanishVoices[0] || allVoices[0]).voice_id)
      }
    }).catch(() => toast({ title: "Error cargando avatares", variant: "destructive" }))
      .finally(() => setLoadingData(false))

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const pollStatus = (videoId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/heygen/status?videoId=${videoId}`)
        const data = await res.json()
        const s = data?.data?.status
        if (s === "completed") {
          clearInterval(pollRef.current!)
          setVideoUrl(data.data.video_url)
          setStatus("completed")
          toast({ title: "¡Listing video listo!" })
        } else if (s === "failed") {
          clearInterval(pollRef.current!)
          setStatus("failed")
          toast({ title: "HeyGen falló", description: data.data?.error || "Error desconocido", variant: "destructive" })
        }
      } catch { /* retry on next interval */ }
    }, 8000)
  }

  const generate = async () => {
    if (!property.trim()) { toast({ title: "Describe la propiedad", variant: "destructive" }); return }
    if (!avatarId) { toast({ title: "Selecciona un avatar", variant: "destructive" }); return }
    if (!voiceId) { toast({ title: "Selecciona una voz", variant: "destructive" }); return }

    const photoUrls = photoUrlsText
      .split("\n")
      .map(u => u.trim())
      .filter(u => u.startsWith("http"))

    if (pollRef.current) clearInterval(pollRef.current)
    setGenerating(true)
    setStatus("idle")
    setVideoUrl(null)
    setPlan(null)

    try {
      const res = await fetch("/api/heygen/listing-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, photoUrls, avatarId, voiceId, ratio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlan(data.plan)
      setStatus("processing")
      pollStatus(data.videoId)
      toast({ title: `Plan de ${data.plan.scenes?.length} escenas generado — HeyGen procesando…` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      setStatus("idle")
    } finally {
      setGenerating(false)
    }
  }

  // ── Remotion config handler ───────────────────────────────────────────────

  const generateRemotionConfig = async () => {
    if (!property.trim()) {
      toast({ title: "Describe la propiedad primero", variant: "destructive" })
      return
    }

    const photoUrls = photoUrlsText
      .split("\n")
      .map(u => u.trim())
      .filter(u => u.startsWith("http"))

    setRLoading(true)
    setRConfig(null)

    try {
      const res = await fetch("/api/remotion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          photoUrls,
          agentName,
          agentTitle,
          agentPhone,
          propertyAddress,
          price,
          brandColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRConfig(data)
      toast({ title: `Config de ${data.meta.sceneCount} escenas lista — descarga y renderiza localmente` })
    } catch (e: any) {
      toast({ title: "Error generando config", description: e.message, variant: "destructive" })
    } finally {
      setRLoading(false)
    }
  }

  const downloadRemotionConfig = () => {
    if (!rConfig) return
    const blob = new Blob([JSON.stringify(rConfig, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `listing-video-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loadingData) return <div className="text-center py-20 text-gray-400">Cargando avatares…</div>

  return (
    <div className="space-y-6">
      {/* Timeline overview */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-purple-800 mb-3 uppercase tracking-wide">Timeline — 10 escenas / ~60 segundos</p>
        <div className="flex gap-1 flex-wrap">
          {TIMELINE_LABELS.map((t, i) => (
            <div key={i} className={`px-2 py-1 rounded-lg text-xs font-medium ${t.type === "avatar" ? "bg-purple-600 text-white" : "bg-blue-100 text-blue-800"}`}>
              {i + 1}. {t.name} <span className="opacity-70">{t.seconds}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-purple-700 mt-2">
          Avatar: 3 escenas (Hook + Transición + CTA) · B-Roll: 7 escenas con Pexels o fotos de listing
        </p>
      </div>

      {/* Avatar + Voice */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">1. Avatar y voz</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Avatar</label>
            <select value={avatarId} onChange={e => setAvatarId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              {avatars.filter((a: any) => a.group === "Catherine Gomez").length > 0 && (
                <optgroup label="— Catherine Gomez —">
                  {avatars.filter((a: any) => a.group === "Catherine Gomez").map((a: any) => (
                    <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>
                  ))}
                </optgroup>
              )}
              {avatars.filter((a: any) => a.group !== "Catherine Gomez").length > 0 && (
                <optgroup label="— Stock Avatars —">
                  {avatars.filter((a: any) => a.group !== "Catherine Gomez").map((a: any) => (
                    <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Voz</label>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              {voices.map((v: any) => (
                <option key={v.voice_id} value={v.voice_id}>{v.name}{v.language ? ` — ${v.language}` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Formato</label>
          <div className="flex gap-2">
            {[{ id: "9:16", label: "Reels / TikTok" }, { id: "16:9", label: "YouTube" }, { id: "1:1", label: "Feed" }].map(r => (
              <button key={r.id} onClick={() => setRatio(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${ratio === r.id ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {r.id} — {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Property Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-1">2. Información de la propiedad</h2>
        <p className="text-xs text-gray-500 mb-3">Incluye precio, recámaras, amenidades, barrio y estilo de vida.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Dirección</label>
            <input value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)}
              placeholder="1234 Ocean Drive, Miami Beach, FL"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Precio</label>
            <input value={price} onChange={e => setPrice(e.target.value)}
              placeholder="$1,250,000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
        <textarea
          value={property}
          onChange={e => setProperty(e.target.value)}
          placeholder={"Ej: 3 bed / 2 bath en Brickell, Miami. $750,000. Vista al mar, piscina en rooftop, gym, concierge 24h. A 5 min caminando de Whole Foods y Brickell City Centre. Airbnb permitido, renta proyectada $6,500/mes."}
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
        />
      </div>

      {/* Agent Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3">3. Tu información de contacto</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre</label>
            <input value={agentName} onChange={e => setAgentName(e.target.value)}
              placeholder="Catherine Gomez"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Título</label>
            <input value={agentTitle} onChange={e => setAgentTitle(e.target.value)}
              placeholder="Real Estate Agent"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
            <input value={agentPhone} onChange={e => setAgentPhone(e.target.value)}
              placeholder="(305) 555-0100"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Color de marca</label>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <span className="text-xs text-gray-400 font-mono">{brandColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Listing Photos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-1">4. Fotos de la propiedad <span className="text-gray-400 font-normal">(opcional)</span></h2>
        <p className="text-xs text-gray-500 mb-3">
          Pega URLs de fotos del MLS o Zillow — una por línea.<br />
          <strong>Orden ideal:</strong> Exterior · Sala · Cocina · Recámara · Baño · Jardín · Piscina · Aéreo
        </p>
        <textarea
          value={photoUrlsText}
          onChange={e => setPhotoUrlsText(e.target.value)}
          placeholder={"https://photos.zillowstatic.com/exterior.jpg\nhttps://photos.zillowstatic.com/living-room.jpg\nhttps://photos.zillowstatic.com/kitchen.jpg\n..."}
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
        />
        {photoUrlsText.split("\n").filter(u => u.trim().startsWith("http")).length > 0 && (
          <p className="text-xs text-green-700 mt-2">
            ✓ {photoUrlsText.split("\n").filter(u => u.trim().startsWith("http")).length} fotos detectadas
          </p>
        )}
      </div>

      {/* ── Remotion — Render in Terminal ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Remotion — Video con efectos profesionales</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Genera el config con IA y renderiza desde tu terminal. Ken Burns · captions animados · transiciones.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 bg-orange-500 text-white rounded-full uppercase tracking-wide">Nuevo</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            ["Ken Burns", "zoom/pan en cada foto"],
            ["Captions", "animados estilo Reels"],
            ["Transiciones", "flash profesional"],
            ["Branding", "tu nombre + teléfono en CTA"],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white/5 rounded-xl p-2.5 text-xs">
              <span className="text-orange-400 font-semibold">{title}</span>
              <span className="text-gray-400"> — {desc}</span>
            </div>
          ))}
        </div>

        <button
          onClick={generateRemotionConfig}
          disabled={rLoading || !property.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50">
          {rLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Claude generando guión + Pexels B-roll…</>
            : <><Video className="w-4 h-4" /> Generar Config de Remotion (10 escenas)</>}
        </button>

        {rConfig && (
          <div className="mt-4 space-y-3">
            {/* Stats */}
            <div className="flex gap-3 text-xs">
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">{rConfig.meta.sceneCount} escenas</span>
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">{rConfig.meta.totalSeconds}s de video</span>
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-lg">{rConfig.meta.totalFrames} frames @ 30fps</span>
            </div>

            {/* Scene preview */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {rConfig.scenes.map((s: any, i: number) => (
                <div key={i} className={`rounded-lg p-2.5 text-xs flex gap-2 ${s.avatar_present ? "bg-purple-900/40 border border-purple-700/40" : "bg-blue-900/40 border border-blue-700/40"}`}>
                  <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 ${s.avatar_present ? "bg-purple-600 text-white" : "bg-blue-600 text-white"}`}>
                    {s.avatar_present ? "CAM" : s.asset_type === "video" ? "VIDEO" : "FOTO"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-300">{i + 1}. {s.name} <span className="text-gray-500">({s.duration_seconds}s)</span></p>
                    <p className="text-gray-400 leading-snug truncate">{s.script}</p>
                    <p className="text-gray-500 mt-0.5">Caption: <strong className="text-gray-400">{s.caption}</strong></p>
                  </div>
                </div>
              ))}
            </div>

            {/* Download + Terminal command */}
            <button
              onClick={downloadRemotionConfig}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-semibold transition-colors border border-white/20">
              <Download className="w-4 h-4" /> Descargar listing-config.json
            </button>

            <div className="bg-black/50 rounded-xl p-4 border border-gray-700">
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Comando para tu terminal</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs text-green-400 font-mono leading-relaxed break-all">
                  {`node scripts/render-listing.mjs --config listing-config.json`}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("node scripts/render-listing.mjs --config listing-config.json")
                    setRCopied(true)
                    setTimeout(() => setRCopied(false), 2000)
                  }}
                  className="flex-shrink-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                  {rCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                <p>1. Descarga el archivo JSON arriba</p>
                <p>2. Colócalo en la carpeta raíz del proyecto lofty</p>
                <p>3. Corre el comando en tu terminal</p>
                <p>4. El video se guarda en <code className="text-gray-400">output/listing-*.mp4</code></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HeyGen generate */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Generar con HeyGen (avatar)</h2>
        <p className="text-xs text-gray-500 mb-4">Alternativa: video con el avatar de Catherine. Requiere avatar + voz seleccionados arriba.</p>

        <button
          onClick={generate}
          disabled={generating || !property.trim() || !avatarId || !voiceId || status === "processing"}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Claude generando guión + buscando Pexels…</>
            : status === "processing"
            ? <><Loader2 className="w-4 h-4 animate-spin" /> HeyGen renderizando 10 escenas… (3-6 min)</>
            : <><Clapperboard className="w-4 h-4" /> Generar Listing Video con HeyGen (10 escenas)</>}
        </button>

        {/* Processing */}
        {status === "processing" && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="font-semibold text-blue-800 text-sm">HeyGen está renderizando el listing video…</p>
            <p className="text-xs text-blue-600 mt-1">10 escenas — 3-6 minutos. No cierres esta pantalla.</p>
          </div>
        )}

        {/* Scene Plan */}
        {plan?.scenes && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Guión — {plan.scenes.length} escenas</p>
            {plan.scenes.map((scene: any, i: number) => (
              <div key={i} className={`rounded-xl p-3 border text-sm flex gap-3 ${scene.avatar_present ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
                <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md self-start mt-0.5 ${scene.avatar_present ? "bg-purple-600 text-white" : "bg-blue-600 text-white"}`}>
                  {scene.avatar_present ? "CAM" : "B-ROLL"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-600 mb-0.5">{scene.scene_number}. {scene.name}</p>
                  <p className="text-gray-800 leading-snug">{scene.script}</p>
                  <p className="text-xs text-gray-400 mt-1">Caption: <strong className="text-gray-600">{scene.caption}</strong></p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {status === "completed" && videoUrl && (
          <div className="mt-4">
            <video src={videoUrl} controls playsInline className="w-full rounded-xl max-h-[600px] object-contain bg-black" />
            <a href={videoUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
              Descargar / abrir video
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
