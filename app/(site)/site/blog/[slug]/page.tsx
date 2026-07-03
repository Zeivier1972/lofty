export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, User, ArrowLeft, Phone, Mail, BedDouble, Bath, Maximize2 } from "lucide-react"

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findFirst({
    where: { slug: params.slug, published: true },
  })

  if (!post) notFound()

  const tags: string[] = (() => { try { return JSON.parse(post.tags || "[]") } catch { return [] } })()

  // Fetch related active listings
  let relatedProperties: any[] = []
  try {
    relatedProperties = await prisma.property.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, mlsId: true, address: true, city: true,
        price: true, bedrooms: true, bathrooms: true, sqft: true, images: true,
      },
    })
  } catch {}

  const listings = relatedProperties.map(p => ({
    ...p,
    images: (() => { try { return JSON.parse(p.images || "[]") } catch { return [] } })(),
  }))

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
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

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link href="/site/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#c9a84c] mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(tag => (
              <span key={tag} className="text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/10 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gray-900 leading-snug mb-4">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-8 pb-6 border-b border-gray-100">
          <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{post.author}</span>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>

        {/* Cover image */}
        {post.coverImage && (
          <div className="rounded-2xl overflow-hidden mb-10 shadow-md">
            <img src={post.coverImage} alt={post.title} className="w-full object-cover max-h-96" />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-gray-600 italic border-l-4 border-[#c9a84c] pl-5 mb-8 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        {/* Full content */}
        <div
          className="prose prose-gray prose-headings:font-serif prose-headings:text-gray-900 prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900 prose-a:text-[#c9a84c] prose-a:no-underline hover:prose-a:underline max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* CTA */}
        <div className="mt-12 bg-[#1a3a5c] rounded-2xl p-8 text-center text-white">
          <h2 className="font-serif text-2xl font-bold mb-2">Ready to Take the Next Step?</h2>
          <p className="text-gray-300 mb-6">Schedule a free consultation with Catherine and get expert guidance for your real estate journey in Miami.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/book"
              className="px-6 py-3 bg-[#c9a84c] text-[#1a3a5c] rounded-xl font-bold text-sm hover:bg-[#e8c97a] transition-colors">
              Book a Free Consultation
            </Link>
            <a href="tel:+13055551234"
              className="px-6 py-3 border border-white/30 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <Phone className="w-4 h-4" /> Call Catherine
            </a>
          </div>
        </div>

        {/* Related listings */}
        {listings.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">Featured Listings</h2>
            <p className="text-gray-500 text-sm mb-6">Properties currently available in Miami</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {listings.map(p => (
                <Link key={p.id} href={`/site/listing/${p.id}`}
                  className="group border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-40 bg-gray-100 overflow-hidden relative">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300 text-xs">No photo</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2">
                      <span className="text-white text-sm font-bold">${p.price?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.address}</p>
                    <p className="text-xs text-gray-400 mb-2">{p.city}</p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      {p.bedrooms && <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{p.bedrooms}bd</span>}
                      {p.bathrooms && <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{p.bathrooms}ba</span>}
                      {p.sqft && <span className="flex items-center gap-0.5"><Maximize2 className="w-3 h-3" />{p.sqft?.toLocaleString()}ft²</span>}
                    </div>
                    {p.mlsId && <p className="text-xs text-[#c9a84c] mt-1">MLS# {p.mlsId}</p>}
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/homes" className="inline-flex items-center gap-2 px-6 py-2.5 border border-[#1a3a5c] text-[#1a3a5c] rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] hover:text-white transition-colors">
                View All Listings
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#0f2236] py-8 text-center text-gray-400 text-sm mt-16">
        <Link href="/site" className="text-[#c9a84c] hover:underline">← Back to Home</Link>
        <p className="mt-2">&copy; 2026 Catherine Gomez P.A. All rights reserved.</p>
      </footer>
    </div>
  )
}
