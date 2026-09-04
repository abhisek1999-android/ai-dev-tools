import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface PageMeta {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  keywords?: string;
  author?: string;
}

/** Site-wide social card. Crawlers need an absolute URL, so it is not a relative path. */
export const DEFAULT_OG_IMAGE = 'https://tokiq.in/og-image.png';

@Injectable({ providedIn: 'root' })
export class MetaService {
  private meta = inject(Meta);
  private title = inject(Title);

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

    if (page.url) {
      this.meta.updateTag({ property: 'og:url', content: page.url });
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
  }

  setJsonLd(schema: any) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}
