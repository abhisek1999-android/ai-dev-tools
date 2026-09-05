/**
 * Build-time reader for the per-route SEO table and the blog post list.
 *
 * `src/app/core/seo/page-seo.json` is the single source of truth: the Angular
 * app imports it at runtime (via page-seo.ts) and the sitemap + prerender
 * scripts read it here. Keeping one copy is what stops the tags a crawler sees
 * in the raw HTML from drifting from the ones the app sets after hydration.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadSeo() {
  const seo = JSON.parse(readFileSync(resolve(ROOT, 'src/app/core/seo/page-seo.json'), 'utf8'));

  if (!seo.pages.some(p => p.path === seo.rootAlias)) {
    throw new Error(`page-seo.json: rootAlias "${seo.rootAlias}" has no matching page entry`);
  }
  for (const page of seo.pages) {
    if (!page.path.startsWith('/') || page.path.endsWith('/')) {
      throw new Error(`page-seo.json: path "${page.path}" must start with "/" and not end with one`);
    }
  }

  return seo;
}

/**
 * Pulls the flat fields off each entry in BLOG_POSTS. The posts are plain object
 * literals at a fixed indent, so an anchored per-key match is enough and avoids
 * compiling TypeScript just to read five strings. Field counts are cross-checked
 * by the caller, so a reformat of blog.data.ts fails the build instead of
 * silently producing pages with mismatched titles.
 */
export function loadBlogPosts() {
  const src = readFileSync(resolve(ROOT, 'src/app/lib/blog/blog.data.ts'), 'utf8');

  const pick = key =>
    [...src.matchAll(new RegExp(`^    ${key}: '((?:[^'\\\\]|\\\\.)*)',$`, 'gm'))]
      .map(m => m[1].replace(/\\'/g, "'"));

  const slugs = pick('slug');
  const titles = pick('title');
  const descriptions = pick('description');
  const publishedAt = pick('publishedAt');
  const authors = pick('author');

  const counts = { slugs: slugs.length, titles: titles.length, descriptions: descriptions.length };
  if (!slugs.length || new Set(Object.values(counts)).size !== 1) {
    throw new Error(
      `blog.data.ts parse mismatch (${JSON.stringify(counts)}). ` +
      `Each post needs slug/title/description as single-quoted strings at four-space indent.`
    );
  }

  return slugs.map((slug, i) => ({
    slug,
    title: titles[i],
    description: descriptions[i],
    publishedAt: publishedAt[i],
    author: authors[i] || 'TokIQ',
  }));
}
