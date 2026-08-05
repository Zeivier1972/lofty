# Project notes for Claude

Lofty/CASAi CRM (Next.js App Router). Public marketing pages live under `app/`
(e.g. `app/guias/*`, `app/comprar/*`, `app/new-construction`). Deployed on
Railway; production host is `www.catherinegomezrealtor.com`.

## SEO + AIO — REQUIRED on anything public we create

Every new public-facing page, landing page, guide, or lead magnet MUST be built
so it ranks on Google AND is discoverable/quotable by AI answer engines (Google
AI Overviews, ChatGPT, Perplexity) and shows rich previews when posted on
Facebook, Instagram, WhatsApp. Bake these in from the start:

1. **Metadata** (`export const metadata` / `generateMetadata`): a keyword-rich
   `title` + `description`, `keywords`, and `alternates.canonical` (absolute URL
   on the `www` host).
2. **Social previews**: `openGraph` (title, description, url, `type`,
   `siteName: "Catherine Gomez Realtor"`, `locale`, and a 1200×630 `images`
   entry) + `twitter` (`summary_large_image`). Use a real, absolute image URL so
   FB/IG/WhatsApp render a card.
3. **Structured data (JSON-LD)** in the page via
   `<script type="application/ld+json">`: use the schema.org types that fit —
   `RealEstateAgent`, `Residence`/`Product`/`Apartment`, `ItemList`, and
   especially `FAQPage`. This is what AI answer engines read (AIO).
4. **FAQ section** (visible Q&A): answer engines quote clear question→answer
   pairs, and it wins featured snippets. Mirror it in the `FAQPage` JSON-LD.
5. **Semantic HTML + a11y**: one `<h1>`, logical headings, descriptive `alt`
   text on every image, mobile-responsive.
6. **Sitemap**: add the route to `app/sitemap.ts` so Google discovers it.
7. **Localized**: audience is bilingual (ES primary). Match the page's language
   in `locale` and copy.

Reference implementations: `app/guias/inversionista-costa-rica/page.tsx` and
`app/new-construction/page.tsx`.

Content built for social posting (Smart Plan messages, captions, ad copy) should
be written to be shareable and keyword-aware for the same reason.
