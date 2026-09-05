/**
 * Generates public/sitemap.xml from the per-route SEO table and blog data, so
 * the sitemap is never maintained by hand. Run before `ng build`.
 *
 * Sources of truth:
 *   - src/app/core/seo/page-seo.json -> static routes, priority, changefreq
 *   - src/app/lib/blog/blog.data.ts  -> blog post slugs + publishedAt dates
 *
 * Only canonical URLs are listed. `/` is deliberately absent: it redirects to
 * the root alias and declares that page canonical, so submitting it would ask
 * Google to index a URL that points elsewhere.
 *
 * Output: public/sitemap.xml (copied into the build by angular.json assets)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROOT, loadSeo, loadBlogPosts } from './lib/page-seo.mjs';

const seo = loadSeo();
const SITE = seo.site;
const today = new Date().toISOString().slice(0, 10);

const urls = seo.pages.map(page => ({
  loc: `${SITE}${page.path}`,
  lastmod: today,
  changefreq: page.changefreq,
  priority: page.priority,
}));

for (const post of loadBlogPosts()) {
  urls.push({
    loc: `${SITE}/blog/${post.slug}`,
    lastmod: post.publishedAt || today,
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

console.log(`+ sitemap.xml generated (${urls.length} URLs) -> public/sitemap.xml`);
