# AI Cost Architect — Developer Guide

## What this is
A free web-based toolkit of AI cost calculators for developers. All calculations run in the browser — no server required for Phase 1.

**Live tools:**
- Token Counter — count tokens for GPT, Claude, Gemini
- LLM Cost Calculator — daily/monthly/yearly cost estimate
- Model Comparison — side-by-side cost table across providers
- Context Window Calculator — usage % + cost for your context
- RAG Cost Calculator — full pipeline cost with What-If optimization

## Tech stack
- **Framework:** Angular 16 (standalone components)
- **Styling:** Tailwind CSS v3
- **Calculation engine:** Pure TypeScript (browser-side, no API calls)
- **Tokenization:** `gpt-tokenizer` npm package (exact for GPT models, approximated for others)
- **Pricing data:** Versioned TypeScript constants with `last_verified` dates
- **Deployment:** Vercel (static SPA)
- **Node requirement:** ≥18.12.1

## Directory structure
```
src/app/
├── core/layout/          # Header + Footer components
├── lib/
│   ├── pricing/          # pricing.types.ts, pricing.data.ts
│   ├── calculators/      # One file per calculator (pure functions)
│   └── utils/            # number.utils.ts (formatting helpers)
├── shared/components/    # ShowMathComponent, ResultCardComponent
└── features/             # One directory per tool (lazy-loaded pages)
    ├── home/
    ├── token-calculator/
    ├── llm-cost-calculator/
    ├── model-comparison/
    ├── context-window-calculator/
    └── rag-cost-calculator/
```

## Running locally
```bash
npm install
npm start                    # dev server at http://localhost:4200
npm run build                # sitemap + ng build + per-route SEO HTML → dist/ai-cost-architect/
```

## How to add a new model
Edit `src/app/lib/pricing/pricing.data.ts`:

```ts
// Add to LLM_MODELS array:
{
  id: 'model-id',
  provider: 'openai',      // openai | anthropic | google | mistral | deepseek | meta | cohere
  name: 'Display Name',
  category: 'llm',
  inputPricePer1M: 2.50,   // USD per 1 million input tokens
  outputPricePer1M: 10.00, // USD per 1 million output tokens
  cachedInputPricePer1M: 1.25,   // optional
  batchInputPricePer1M: 1.25,    // optional
  batchOutputPricePer1M: 5.00,   // optional
  contextWindow: 128000,
  lastVerified: '2026-09-01',
  pricingUrl: 'https://provider.com/pricing',
}
```

Always update `PRICING_VERSION` at the top of the file when you add/change pricing.

## How to add a new calculator page
1. Create `src/app/features/<name>/<name>.component.ts` (standalone component)
2. Add a route in `src/app/app.routes.ts` (lazy-loaded)
3. Add nav link in `src/app/core/layout/header.component.ts`
4. Add footer link in `src/app/core/layout/footer.component.ts`
5. Add tool card on the home page in `src/app/features/home/home.component.ts`
6. Calculation logic goes in `src/app/lib/calculators/<name>.calculator.ts`

## Brand assets

The source logo is a black-on-white wordmark. Everything shipped is derived from it
by `scripts/generate-brand-assets.mjs`, which inverts it to a white-on-transparent
negative (the app is dark-only) and crops the square icon from the `Q` glyph, since
the 2.93:1 wordmark is illegible at 16px.

| File | Used for |
| --- | --- |
| `src/assets/tokiq-wordmark.png` | Header + footer logotype |
| `src/favicon.ico` (16/32/48) | Browser tab, legacy crawlers |
| `public/favicon-{16,32,96}x*.png` | Browser tab, Google Search result icon |
| `public/apple-touch-icon.png` | iOS home screen |
| `public/icon-{192,512}.png` | PWA install, `Organization.logo` in JSON-LD |
| `public/icon-maskable-512.png` | Android adaptive icon |
| `public/og-image.png` (1200x630) | Open Graph / Twitter card |

The source file lives at `brand/tokiq-logo-source.png`. Replace it and regenerate:
```bash
npm run gen:brand                                  # uses brand/tokiq-logo-source.png
node scripts/generate-brand-assets.mjs other.png   # or an explicit source
```
The script asserts the source's ink bounding box before cropping, so a re-cut logo
fails loudly instead of silently producing a mis-cropped icon. This is deliberately
*not* part of `npm run build` — the outputs are committed and only change when the
logo does.

Everything in `public/` is copied to the site root at build time (see `angular.json`
`assets`). The icon `<link>` tags and the site-level Organization/WebSite JSON-LD live
in `src/index.html` — kept static rather than injected by `MetaService` so crawlers
that do not execute JS still see them.

## SEO: canonical URLs and per-route metadata

Every tool page is its own canonical page. `/tools/token-calculator` must be the
result Google shows for "free AI token counter" — not the site root.

**Single source of truth:** `src/app/core/seo/page-seo.json`. One entry per static
route with `title`, `description`, `keywords`, sitemap `priority`/`changefreq`, and
the page's JSON-LD. Three consumers read it:

| Consumer | When | What it does |
| --- | --- | --- |
| `MetaService.setRouteMeta(path)` | runtime | Sets title/description/OG/Twitter tags, canonical and JSON-LD on client-side navigation |
| `scripts/prerender-html.mjs` | after `ng build` | Writes `<route>/index.html` per route with those tags baked into the served HTML |
| `scripts/generate-sitemap.mjs` | before `ng build` | Emits `public/sitemap.xml` from the same paths |

Because the app is client-rendered, a canonical injected only by JS is unreliable —
it has to be in the bytes the crawler fetches. `prerender-html.mjs` clones the built
`index.html` once per route and rewrites the head, so `/tools/model-comparison` is
served with *its own* canonical. Vercel and Cloudflare both check the filesystem
before the SPA fallback, so no routing config change is needed. The SPA still boots
and takes over routing; only the `<head>` differs between files.

`/` renders the token calculator (see the redirect in `app.routes.ts`), so its
`index.html` — which is also the SPA fallback for unmatched URLs — declares
`/tools/token-calculator` canonical rather than competing with it. `/` is therefore
absent from the sitemap.

**Adding a route:** add the entry to `page-seo.json` and call
`this.meta.setRouteMeta('/your/path')` in the component's `ngOnInit`. The sitemap
and the prerendered HTML follow automatically. A route with no entry logs a console
warning instead of silently inheriting the previous page's canonical.

`prerender-html.mjs` throws if a tag it patches is missing or duplicated in
`src/index.html`, so moving those tags breaks the build rather than the SEO. The
per-page tags in `src/index.html` are checked in with the `/` values; edit
`page-seo.json`, not the HTML.

**Never** disallow `*.js` / `*.css` in `public/robots.txt`: a crawler that cannot
fetch the bundles sees an empty `<app-root>`.

Verify a build locally:
```bash
npm run build
grep -o '<link rel="canonical"[^>]*>' dist/ai-cost-architect/tools/*/index.html
```

## Pricing data update process
AI pricing changes frequently. Current update cadence: **manual, every 1–2 weeks**.

For each update:
1. Visit each provider's pricing page (URLs stored in each model entry)
2. Update prices in `pricing.data.ts`
3. Update `lastVerified` date on each changed entry
4. Update `PRICING_VERSION` constant at the top
5. Commit with message: `pricing: update [provider] prices [date]`

Future automation: pricing ingestion script will scrape and diff against current data.

## Deployment
Deploys to Vercel as a static SPA:
```bash
npm run build
# Vercel picks up dist/ai-cost-architect/browser/ automatically via vercel.json
```

The `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Architecture principles (from project plan)
- **Browser-first:** All calculations run client-side. User prompts never leave the device.
- **Show the math:** Every result has an expandable formula (ShowMathComponent).
- **Explainable pricing:** Every model entry has a `pricingUrl` and `lastVerified` date.
- **No backend in Phase 1:** Backend (FastAPI/Python) is planned for Phase 8 AI features only.
- **SEO:** Each tool page has a dedicated URL with meaningful meta descriptions, structured data, and a blog for content marketing.

## Recent Updates (v2.0)
- **Token Calculator as Landing Page:** Root route (`/`) now redirects to `/tools/token-calculator`
- **Blog Feature:** New blog section at `/blog` with SEO-optimized article listing and individual post pages
- **SEO Improvements:** 
  - MetaService for consistent meta tag management across all pages
  - JSON-LD structured data for rich snippets
  - `sitemap.xml` for search engine crawling
  - `robots.txt` for crawler directives
  - Updated Open Graph tags in `index.html`
- **Meta Service:** New `src/app/core/services/meta.service.ts` for managing page titles, descriptions, and structured data
- **Blog Data:** Sample blog posts in `src/app/lib/blog/blog.data.ts` covering tokens, pricing, RAG, context windows, and budgeting

## New Routes
- `/` → Redirects to `/tools/token-calculator` (token counter is the primary landing page)
- `/home` → Tools overview page (formerly at `/`)
- `/blog` → Blog listing (all articles)
- `/blog/:slug` → Individual blog post

## Roadmap (from `ai_cost_architect_phase_plan.md`)
- **Phase 1 (current):** 5 core calculators — done
- **Phase 2:** RAG cost calculator enhancements
- **Phase 3:** AI Application Cost Planner (presets + architecture comparison)
- **Phase 4:** Architecture comparison (Cloud vs Hybrid vs Self-hosted)
- **Phase 5:** SEO expansion (landing pages, structured data, sitemap)
- **Phase 6:** Monetization (AdSense, affiliate links)
- **Phase 7:** Pro features (save scenarios, export, team sharing)
- **Phase 8:** Optional AI layer (FastAPI + Python — architecture explanation, optimization suggestions)
