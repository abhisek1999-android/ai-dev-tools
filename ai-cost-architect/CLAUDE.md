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
npm run build                # production build → dist/ai-cost-architect/
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
