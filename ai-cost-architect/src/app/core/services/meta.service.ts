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

    if (page.image) {
      this.meta.updateTag({ property: 'og:image', content: page.image });
      this.meta.updateTag({ name: 'twitter:image', content: page.image });
    }

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
