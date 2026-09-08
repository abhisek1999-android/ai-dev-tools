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
 * compiling TypeScript just to read a handful of strings. Fields are scoped to
 * one post object at a time (rather than matched globally across the whole
 * file) so an optional field present on only some posts, like `image`, still
 * lines up with the right post instead of shifting every later post's values.
 */
export function loadBlogPosts() {
  const src = readFileSync(resolve(ROOT, 'src/app/lib/blog/blog.data.ts'), 'utf8');

  // Each post is a `  { ... },` block at 2-space indent inside BLOG_POSTS.
  const blocks = src.split(/^  \{$/m).slice(1).map(block => {
    const end = block.search(/^  \},?$/m);
    return end === -1 ? block : block.slice(0, end);
  });

  if (!blocks.length) {
    throw new Error('blog.data.ts parse mismatch: no post objects found in BLOG_POSTS.');
  }

  const pick = (block, key) => {
    const m = block.match(new RegExp(`^    ${key}: '((?:[^'\\\\]|\\\\.)*)',$`, 'm'));
    return m ? m[1].replace(/\\'/g, "'") : undefined;
  };

  return blocks.map(block => {
    const slug = pick(block, 'slug');
    const title = pick(block, 'title');
    const description = pick(block, 'description');

    if (!slug || !title || !description) {
      throw new Error(
        `blog.data.ts parse mismatch: a post is missing slug/title/description as ` +
        `single-quoted strings at four-space indent.`
      );
    }

    return {
      slug,
      title,
      description,
      publishedAt: pick(block, 'publishedAt'),
      author: pick(block, 'author') || 'TokIQ',
      image: pick(block, 'image'),
    };
  });
}
