import data from './page-seo.json';

/**
 * Per-route SEO metadata. The data lives in `page-seo.json` rather than in the
 * components because two consumers need it:
 *
 *   1. `MetaService` at runtime, for client-side navigation.
 *   2. `scripts/prerender-html.mjs` + `scripts/generate-sitemap.mjs` at build
 *      time, which bake the same title/description/canonical into a static
 *      HTML file per route.
 *
 * If it were duplicated, the tags a crawler sees in the raw HTML would drift
 * from the ones the app sets after hydration.
 */
export interface PageSeo {
  /** Absolute route path, leading slash, no trailing slash. Matches `app.routes.ts`. */
  path: string;
  title: string;
  description: string;
  keywords: string;
  priority: string;
  changefreq: string;
  jsonLd?: Record<string, unknown>;
}

export const SITE_URL: string = data.site;
export const DEFAULT_OG_IMAGE: string = data.defaultOgImage;

/** `/` renders this route's component (see the redirect in `app.routes.ts`), so it borrows its metadata and canonical. */
export const ROOT_ALIAS: string = data.rootAlias;

export const PAGE_SEO: readonly PageSeo[] = data.pages as readonly PageSeo[];

/** Absolute URL for a route path. `/home` -> `https://tokiq.in/home`. */
export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

export function seoFor(path: string): PageSeo | undefined {
  return PAGE_SEO.find(p => p.path === path);
}
