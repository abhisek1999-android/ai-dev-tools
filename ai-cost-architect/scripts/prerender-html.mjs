/**
 * Writes one static HTML file per route into the build output, each carrying its
 * own <title>, description, canonical, Open Graph tags and JSON-LD.
 *
 * Why this exists: the app is client-rendered, so every URL is served by the same
 * index.html. Without this step /tools/token-calculator is delivered with the
 * *root* canonical in its markup, and Google consolidates all five tools into a
 * single homepage result. A canonical injected later by JS is not a reliable
 * substitute — it has to be in the bytes the crawler fetches.
 *
 * Both Vercel (`rewrites` are evaluated after the filesystem check) and
 * Cloudflare (`not_found_handling = "single-page-application"`) serve a real
 * file when one exists, so dropping `tools/token-calculator/index.html` into the
 * output is enough for that URL to get its own <head>. The SPA still boots and
 * takes over routing exactly as before; only the head differs between files.
 *
 * Run after `ng build`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT, loadSeo, loadBlogPosts } from './lib/page-seo.mjs';

const OUT_DIR = resolve(ROOT, 'dist/ai-cost-architect');

const seo = loadSeo();
const SITE = seo.site;

const indexPath = join(OUT_DIR, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`x ${indexPath} not found - run \`ng build\` before this script.`);
  process.exit(1);
}
const template = readFileSync(indexPath, 'utf8');

/** Escapes a value for use inside a double-quoted HTML attribute. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapes text content; `<` and `&` are the only characters that can break out. */
function text(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Replaces the single occurrence of `pattern`, throwing if it is absent or
 * ambiguous. A silent no-op here would ship the wrong canonical, which is the
 * exact failure this script exists to prevent — so a change to src/index.html
 * that moves these tags must break the build, not the SEO.
 */
function replaceOne(html, pattern, replacement, label, route) {
  const found = html.match(new RegExp(pattern.source, 'g'));
  if (!found || found.length !== 1) {
    throw new Error(
      `[${route}] expected exactly one ${label} in index.html, found ${found ? found.length : 0}. ` +
      `Has src/index.html changed?`
    );
  }
  return html.replace(pattern, () => replacement);
}

const TAGS = [
  [/<title>[\s\S]*?<\/title>/, '<title>', p => `<title>${text(p.title)}</title>`],
  [/<meta name="description" content="[^"]*">/, 'description meta',
    p => `<meta name="description" content="${attr(p.description)}">`],
  [/<meta property="og:title" content="[^"]*">/, 'og:title',
    p => `<meta property="og:title" content="${attr(p.title)}">`],
  [/<meta property="og:description" content="[^"]*">/, 'og:description',
    p => `<meta property="og:description" content="${attr(p.description)}">`],
  [/<meta property="og:type" content="[^"]*">/, 'og:type',
    p => `<meta property="og:type" content="${attr(p.ogType)}">`],
  [/<meta property="og:url" content="[^"]*">/, 'og:url',
    p => `<meta property="og:url" content="${attr(p.canonical)}">`],
  [/<meta property="og:image" content="[^"]*">/, 'og:image',
    p => `<meta property="og:image" content="${attr(p.image)}">`],
  [/<meta name="twitter:title" content="[^"]*">/, 'twitter:title',
    p => `<meta name="twitter:title" content="${attr(p.title)}">`],
  [/<meta name="twitter:description" content="[^"]*">/, 'twitter:description',
    p => `<meta name="twitter:description" content="${attr(p.description)}">`],
  [/<meta name="twitter:image" content="[^"]*">/, 'twitter:image',
    p => `<meta name="twitter:image" content="${attr(p.image)}">`],
  [/<link rel="canonical" href="[^"]*">/, 'canonical link',
    p => `<link rel="canonical" href="${attr(p.canonical)}">`],
];

function renderPage(page) {
  let html = template;

  for (const [pattern, label, build] of TAGS) {
    html = replaceOne(html, pattern, build(page), label, page.path);
  }

  const extra = [];
  if (page.keywords) {
    extra.push(`  <meta name="keywords" content="${attr(page.keywords)}">`);
  }
  if (page.jsonLd) {
    // `data-page-jsonld` is the marker MetaService looks for, so once the app
    // boots it replaces this block rather than stacking a second graph beside it.
    extra.push(
      `  <script type="application/ld+json" data-page-jsonld>${JSON.stringify(page.jsonLd)}</script>`
    );
  }

  return extra.length ? html.replace('</head>', `${extra.join('\n')}\n</head>`) : html;
}

/** Writes `<route>/index.html`; the root route overwrites the build's own index.html. */
function write(path, html) {
  const dir = path === '/' ? OUT_DIR : join(OUT_DIR, path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
}

const absolute = path => (path === '/' ? `${SITE}/` : `${SITE}${path}`);

const pages = [];

// `/` renders the same component as the root alias (see the redirect in
// app.routes.ts). It borrows that page's metadata and points its canonical at
// the alias, so the two URLs resolve to one indexable page instead of competing.
// The SPA fallback serves this file for unmatched URLs too, which the wildcard
// route also redirects to the alias — so the canonical is right there as well.
const rootPage = seo.pages.find(p => p.path === seo.rootAlias);
pages.push({ ...rootPage, path: '/', canonical: absolute(seo.rootAlias) });

for (const page of seo.pages) {
  pages.push({ ...page, canonical: absolute(page.path) });
}

for (const post of loadBlogPosts()) {
  const path = `/blog/${post.slug}`;
  pages.push({
    path,
    canonical: absolute(path),
    title: `${post.title} — TokIQ Blog`,
    description: post.description,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      url: absolute(path),
      mainEntityOfPage: { '@type': 'WebPage', '@id': absolute(path) },
      description: post.description,
      datePublished: post.publishedAt,
      author: { '@type': 'Organization', name: post.author },
      publisher: { '@id': `${SITE}/#organization` },
      image: seo.defaultOgImage,
    },
  });
}

for (const page of pages) {
  page.ogType ??= 'website';
  page.image ??= seo.defaultOgImage;
  write(page.path, renderPage(page));
  console.log(`  ${page.path.padEnd(38)} canonical -> ${page.canonical}`);
}

console.log(`+ prerendered ${pages.length} route HTML files -> dist/ai-cost-architect/`);
