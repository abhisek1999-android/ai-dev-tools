/**
 * Generates public/sitemap.xml from the actual app route list and blog data,
 * so the sitemap is never maintained by hand. Run before `ng build`.
 *
 * Sources of truth:
 *   - src/app/app.routes.ts   -> static routes (skip redirects, params, wildcards)
 *   - src/app/lib/blog/blog.data.ts -> blog post slugs + publishedAt dates
 *
 * Output: public/sitemap.xml  (copied into the build by angular.json assets)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://tokiq.in';

const routesFile = readFileSync(resolve(ROOT, 'src/app/app.routes.ts'), 'utf8');
const blogFile = readFileSync(resolve(ROOT, 'src/app/lib/blog/blog.data.ts'), 'utf8');

// Extract every `path: '...'` from the route definitions.
const routePaths = [...routesFile.matchAll(/path:\s*'([^']+)'/g)].map(m => m[1]);

const staticPaths = routePaths.filter(p =>
  p !== '' &&            // root redirect -> skip, canonical target is a tool page
  p !== '**' &&          // wildcard fallback
  !p.includes(':')       // param routes (e.g. blog/:slug) -> resolved from blog data
);

// Extract slug + publishedAt pairs from BLOG_POSTS.
const slugs = [...blogFile.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
const publishedDates = [...blogFile.matchAll(/publishedAt:\s*'([^']+)'/g)].map(m => m[1]);

// Per-path priority + change frequency. Tools are the primary content.
const TOOL_PREFIX = 'tools/';
function metaFor(path) {
  if (path === 'home') return { priority: '1.0', changefreq: 'weekly' };
  if (path.startsWith(TOOL_PREFIX)) return { priority: '0.9', changefreq: 'weekly' };
  if (path === 'blog') return { priority: '0.8', changefreq: 'weekly' };
  return { priority: '0.7', changefreq: 'monthly' };
}

const today = new Date().toISOString().slice(0, 10);

const urls = [];

for (const path of staticPaths) {
  const { priority, changefreq } = metaFor(path);
  urls.push({
    loc: `${SITE}/${path === 'home' ? '' : path}`,
    lastmod: today,
    changefreq,
    priority,
  });
}

// Blog index is already in staticPaths as `blog`; add each post.
for (let i = 0; i < slugs.length; i++) {
  urls.push({
    loc: `${SITE}/blog/${slugs[i]}`,
    lastmod: publishedDates[i] || today,
    changefreq: 'monthly',
    priority: '0.7',
  });
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u =>
    `  <url>\n` +
    `    <loc>${u.loc}</loc>\n` +
    `    <lastmod>${u.lastmod}</lastmod>\n` +
    `    <changefreq>${u.changefreq}</changefreq>\n` +
    `    <priority>${u.priority}</priority>\n` +
    `  </url>`
  ).join('\n') +
  `\n</urlset>\n`;

const outPath = resolve(ROOT, 'public/sitemap.xml');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, xml, 'utf8');

console.log(`✓ sitemap.xml generated (${urls.length} URLs) -> public/sitemap.xml`);