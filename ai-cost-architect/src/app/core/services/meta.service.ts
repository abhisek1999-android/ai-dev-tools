import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { DEFAULT_OG_IMAGE, absoluteUrl, seoFor } from '../seo/page-seo';

export { DEFAULT_OG_IMAGE };

export interface PageMeta {
  title: string;
  description: string;
  /**
   * Route path this page is served at, e.g. `/tools/token-calculator`. Drives
   * `<link rel="canonical">` and `og:url`. Omit only for pages that must not
   * declare themselves canonical.
   */
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  keywords?: string;
  author?: string;
  jsonLd?: Record<string, unknown>;
}

/** Marks the head nodes this service owns, so a route change replaces them instead of stacking. */
const JSONLD_MARKER = 'data-page-jsonld';

@Injectable({ providedIn: 'root' })
export class MetaService {
  private meta = inject(Meta);
  private title = inject(Title);
  private doc = inject(DOCUMENT);

  /**
   * Applies the metadata registered for `path` in `page-seo.json`. Prefer this
   * over `setPageMeta` for static routes: the build-time prerenderer reads the
   * same entry, so the rendered tags match the ones already in the HTML.
   */
  setRouteMeta(path: string) {
    const seo = seoFor(path);
    if (!seo) {
      // A route was added without a `page-seo.json` entry — it would silently
      // inherit the previous page's canonical, which is the bug this whole
      // module exists to prevent.
      console.warn(`[MetaService] no SEO entry for route "${path}"`);
      return;
    }

    this.setPageMeta({
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      path: seo.path,
      type: 'website',
      jsonLd: seo.jsonLd,
    });
  }

  setPageMeta(page: PageMeta) {
    this.title.setTitle(page.title);

    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:type', content: page.type || 'website' });

    // Always set a card image — pages that do not supply one fall back to the
    // TokIQ wordmark card so no route ever shares as a blank preview.
    const image = page.image || DEFAULT_OG_IMAGE;
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (page.path) {
      const url = absoluteUrl(page.path);
      this.meta.updateTag({ property: 'og:url', content: url });
      this.setCanonical(url);
    }

    if (page.keywords) {
      this.meta.updateTag({ name: 'keywords', content: page.keywords });
    }

    if (page.author) {
      this.meta.updateTag({ name: 'author', content: page.author });
    }

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });

    if (page.jsonLd) {
      this.setJsonLd(page.jsonLd);
    }
  }

  /**
   * Points `<link rel="canonical">` at `url`, reusing the tag that
   * `index.html` ships so a page never declares two canonicals.
   */
  setCanonical(url: string) {
    const head = this.doc.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  /**
   * Replaces the page-level JSON-LD block. The prerendered HTML ships its copy
   * with the same marker attribute, so the static and runtime graphs never
   * coexist. Site-level Organization/WebSite schema in `index.html` is
   * unmarked and therefore left alone.
   */
  setJsonLd(schema: Record<string, unknown>) {
    const head = this.doc.head;
    head.querySelectorAll(`script[${JSONLD_MARKER}]`).forEach(node => node.remove());

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(JSONLD_MARKER, '');
    script.text = JSON.stringify(schema);
    head.appendChild(script);
  }
}
