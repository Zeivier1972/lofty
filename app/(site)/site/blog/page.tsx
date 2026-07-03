export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Calendar, User, ArrowRight, Building2 } from "lucide-react"

export const metadata = {
  title: "Blog — Catherine Gomez Realtor",
  description: "Real estate tips, Miami market insights, and home buying education from Catherine Gomez.",
}

const PLACEHOLDER_POSTS = [
  {
    id: "1",
    slug: "#",
    title: "5 Things Every First-Time Buyer in Miami Must Know",
    excerpt: "Buying your first home in Miami can feel overwhelming. Here are the five most important things I teach every client before they start their search.",
    coverImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
    author: "Catherine Gomez",
    publishedAt: new Date("2026-05-20"),
    tags: ["First-Time Buyers", "Education"],
  },
  {
    id: "2",
    slug: "#",
    title: "Miami Market Snapshot: What's Happening in June 2026",
    excerpt: "The Miami real estate market is showing signs of stabilization. Here's what the numbers say and what it means for buyers and sellers right now.",
    coverImage: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&w=800&q=80",
    author: "Catherine Gomez",
    publishedAt: new Date("2026-06-01"),
    tags: ["Market Snapshot", "Miami"],
  },
  {
    id: "3",
    slug: "#",
    title: "Doral vs. Kendall: Which Neighborhood Is Right for Your Family?",
    excerpt: "Two of Miami's most popular family neighborhoods — but they're very different. I break down schools, prices, commute, and lifestyle for each.",
    coverImage: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80",
    author: "Catherine Gomez",
    publishedAt: new Date("2026-05-10"),
    tags: ["Neighborhoods", "Family"],
  },
]

export default async function BlogPage() {
  let posts: any[] = []
  try {
    posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 20,
    })
  } catch {}

  const displayPosts = posts.length > 0 ? posts : PLACEHOLDER_POSTS

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/site" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded bg-[#1a3a5c] flex items-center justify-center">
              <span className="text-[#c9a84c] text-xs font-bold">CG</span>
            </div>
            <div className="leading-tight">
              <p className="text-[#1a3a5c] font-bold text-sm">Catherine Gomez P.A.</p>
            </div>
          </Link>
          <nav className="flex items-center gap-5 text-xs font-bold text-gray-600">
            <Link href="/site" className="hover:text-[#c9a84c]">HOME</Link>
            <Link href="/homes" className="hover:text-[#c9a84c]">BUY</Link>
            <Link href="/site/blog" className="text-[#c9a84c]">BLOG</Link>
            <Link href="/site#contact" className="hover:text-[#c9a84c]">CONTACT</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#1a3a5c] py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-3">Real Estate Education</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">The Catherine Gomez Blog</h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Market insights, buying tips, and honest advice to help you make smart real estate decisions in Miami.
        </p>
      </div>

      {/* Posts grid */}
      <main className="max-w-screen-xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayPosts.map((post: any) => {
            const tags = Array.isArray(post.tags) ? post.tags : (() => { try { return JSON.parse(post.tags || "[]") } catch { return [] } })()
            return (
              <Link key={post.id} href={post.slug === "#" ? "/site/blog" : `/site/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                {post.coverImage && (
                  <div className="aspect-video overflow-hidden">
                    <img src={post.coverImage} alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-6">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif text-xl font-bold text-gray-900 mb-3 group-hover:text-[#c9a84c] transition-colors leading-snug">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#c9a84c] flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <footer className="bg-[#0f2236] py-8 text-center text-gray-400 text-sm">
        <Link href="/site" className="text-[#c9a84c] hover:underline">← Back to Home</Link>
        <p className="mt-2">&copy; 2026 Catherine Gomez P.A. All rights reserved.</p>
      </footer>
    </div>
  )
}
