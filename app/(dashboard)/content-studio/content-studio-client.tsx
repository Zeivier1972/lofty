"use client"

import { useState } from "react"
import {
  Sparkles, Search, Image, FileText, Loader2,
  Copy, Check, ExternalLink, Download, Globe,
  TrendingUp, Video, BarChart2, Users, Home, DollarSign,
  BookOpen, RefreshCw, Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "blog" | "images" | "research"

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
  { id: "landscape", label: "Landscape (FB/Blog)", ratio: "16:9" },
  { id: "square", label: "Square (Instagram)", ratio: "1:1" },
  { id: "portrait", label: "Portrait (Story/Pin)", ratio: "9:16" },
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
  const [tab, setTab] = useState<Tab>("blog")
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Content Studio
          </h1>
          <p className="text-gray-500 mt-1">AI-powered blog writing, image generation, and market research</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-8 w-fit shadow-sm">
          {[
            { id: "blog" as Tab, label: "Blog Writer", icon: FileText },
            { id: "images" as Tab, label: "Image Generator", icon: Image },
            { id: "research" as Tab, label: "Research", icon: Search },
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
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [copied, setCopied] = useState(false)

  const suggestions = BLOG_TOPIC_SUGGESTIONS[audience] || []

  const generate = async () => {
    if (!topic.trim()) { toast({ title: "Enter a topic", variant: "destructive" }); return }
    setLoading(true); setPost(null); setPublished(false)
    try {
      const res = await fetch("/api/ai/blog-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPost(data)
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
        body: JSON.stringify({ topic, audience, language, publish: true, ...post }),
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{post.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{post.metaDescription}</p>
              {post.tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags || "[]")).map((t: string) => (
                    <span key={t} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 italic border border-gray-100">
            {post.excerpt}
          </div>

          <div className="prose prose-sm max-w-none border border-gray-100 rounded-xl p-4 max-h-96 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: post.content }} />

          <div className="flex gap-2 flex-wrap">
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
      )}
    </div>
  )
}

// ── Image Generator ──────────────────────────────────────────────────────────

function ImageGenerator({ toast }: { toast: any }) {
  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("professional")
  const [size, setSize] = useState("landscape")
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
                  <a href={img.url} target="_blank" download
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              </div>
            </div>
          ))}
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
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  )
}
