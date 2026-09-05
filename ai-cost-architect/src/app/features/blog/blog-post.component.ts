import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { getBlogPost, getRelatedPosts, BLOG_POSTS } from '../../lib/blog/blog.data';
import { MetaService, DEFAULT_OG_IMAGE } from '../../core/services/meta.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="container-page py-10" *ngIf="post; else notFound">
      <!-- Header -->
      <article class="max-w-2xl mx-auto">
        <div class="mb-6">
          <div class="flex items-center gap-2 text-sm text-muted mb-3">
            <span class="badge-neutral">{{ post.category }}</span>
            <span>{{ formatDate(post.publishedAt) }}</span>
            <span>{{ post.readTime }} min read</span>
          </div>
          <h1 class="text-4xl font-bold text-fg sm:text-5xl mb-3">{{ post.title }}</h1>
          <p class="text-lg text-muted mb-4">{{ post.description }}</p>
          <div class="flex flex-wrap gap-2 mb-6">
            <span *ngFor="let tag of post.tags"
                  class="border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">
              #{{ tag }}
            </span>
          </div>
        </div>

        <!-- Content -->
        <div class="prose prose-muted max-w-none mb-8"
             [innerHTML]="post.content">
        </div>

        <!-- Author -->
        <div class="border-t border-border pt-6 mb-8">
          <p class="text-sm text-muted">
            <strong class="text-fg">Written by</strong> {{ post.author }}
          </p>
        </div>

        <!-- Back to Blog -->
        <a routerLink="/blog" class="inline-flex items-center gap-1.5 text-accent hover:text-accent/80">
          <app-icon name="arrow-left" [size]="16" />
          Back to Blog
        </a>
      </article>

      <!-- Related Posts -->
      <div class="mt-16 pt-12 border-t border-border">
        <h2 class="text-2xl font-bold text-fg mb-8">Related Articles</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a *ngFor="let relatedPost of relatedPosts"
             [routerLink]="'/blog/' + relatedPost.slug"
             class="group block">
            <article class="flex h-full flex-col border border-border bg-surface p-5 transition-colors
                            hover:border-border-strong hover:bg-surface-2">
              <div class="mb-2 flex items-center gap-2 text-xs text-muted">
                <span class="badge-neutral text-xs">{{ relatedPost.category }}</span>
                <span>{{ formatDate(relatedPost.publishedAt) }}</span>
              </div>
              <h3 class="text-lg font-bold text-fg group-hover:text-accent transition-colors mb-2 flex-grow">
                {{ relatedPost.title }}
              </h3>
              <p class="text-sm text-muted mb-3">{{ relatedPost.description }}</p>
              <div class="flex items-center gap-1 text-accent text-sm font-medium">
                Read more
                <app-icon name="arrow-right" [size]="14" />
              </div>
            </article>
          </a>
        </div>
      </div>
    </div>

    <ng-template #notFound>
      <div class="container-page py-10">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-fg mb-2">Post Not Found</h1>
          <p class="text-muted mb-6">The blog post you're looking for doesn't exist.</p>
          <a routerLink="/blog" class="inline-flex items-center gap-1.5 text-accent hover:text-accent/80">
            <app-icon name="arrow-left" [size]="16" />
            Back to Blog
          </a>
        </div>
      </div>
    </ng-template>
  `,
  // Post bodies are injected with [innerHTML], so they never receive Angular's
  // scoping attribute — ::ng-deep is required for any of this to apply.
  // (The previous rules used Vue's `:deep()` and `--color-*` variables that
  // this project has never defined, so the article body was entirely unstyled.)
  styles: [`
    :host { display: block; }

    .prose {
      font-size: 1rem;
      line-height: 1.7;
    }

    :host ::ng-deep .prose h2 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-top: 2.5rem;
      margin-bottom: 0.75rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgb(var(--c-border));
      color: rgb(var(--c-fg));
    }

    :host ::ng-deep .prose h3 {
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-top: 1.75rem;
      margin-bottom: 0.5rem;
      color: rgb(var(--c-fg));
    }

    :host ::ng-deep .prose p {
      margin-bottom: 1.15rem;
      color: rgb(var(--c-muted));
    }

    :host ::ng-deep .prose ul,
    :host ::ng-deep .prose ol {
      margin-left: 1.25rem;
      margin-bottom: 1.15rem;
      color: rgb(var(--c-muted));
      list-style-position: outside;
    }
    :host ::ng-deep .prose ul { list-style-type: square; }
    :host ::ng-deep .prose ol { list-style-type: decimal; }
    :host ::ng-deep .prose li { margin-bottom: 0.5rem; }
    :host ::ng-deep .prose li::marker { color: rgb(var(--c-faint)); }

    :host ::ng-deep .prose a {
      color: rgb(var(--c-fg));
      text-decoration: underline;
      text-underline-offset: 4px;
      text-decoration-color: rgb(var(--c-border-strong));
      transition: text-decoration-color 150ms linear;
    }
    :host ::ng-deep .prose a:hover {
      text-decoration-color: rgb(var(--c-accent));
    }

    :host ::ng-deep .prose strong {
      font-weight: 600;
      color: rgb(var(--c-fg));
    }

    :host ::ng-deep .prose blockquote {
      margin: 1.5rem 0;
      padding: 0.25rem 0 0.25rem 1.25rem;
      border-left: 2px solid rgb(var(--c-border-strong));
      color: rgb(var(--c-muted));
    }

    :host ::ng-deep .prose table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.875rem;
    }

    :host ::ng-deep .prose th,
    :host ::ng-deep .prose td {
      border: 1px solid rgb(var(--c-border));
      padding: 0.7rem 0.75rem;
      text-align: left;
      color: rgb(var(--c-muted));
    }

    :host ::ng-deep .prose th {
      background-color: rgb(var(--c-surface-2));
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgb(var(--c-faint));
    }

    :host ::ng-deep .prose code {
      background-color: rgb(var(--c-surface-2));
      border: 1px solid rgb(var(--c-border));
      color: rgb(var(--c-fg));
      padding: 0.1rem 0.35rem;
      border-radius: 0;
      font-family: 'JetBrains Mono', Menlo, monospace;
      font-size: 0.85em;
    }

    :host ::ng-deep .prose pre {
      background-color: rgb(var(--c-surface-2));
      border: 1px solid rgb(var(--c-border));
      padding: 1rem;
      overflow-x: auto;
      margin: 1.5rem 0;
    }
    :host ::ng-deep .prose pre code {
      border: 0;
      padding: 0;
      background: none;
    }
  `]
})
export class BlogPostComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private meta = inject(MetaService);

  post = this.route.snapshot.paramMap.get('slug')
    ? getBlogPost(this.route.snapshot.paramMap.get('slug')!)
    : null;

  relatedPosts = this.post ? getRelatedPosts(this.post.id, 3) : [];

  ngOnInit() {
    if (!this.post) {
      return;
    }

    this.meta.setPageMeta({
      title: `${this.post.title} — TokIQ Blog`,
      description: this.post.description,
      keywords: this.post.tags.join(', '),
      author: this.post.author,
      path: `/blog/${this.post.slug}`,
      image: this.post.image || DEFAULT_OG_IMAGE,
      type: 'article'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: this.post.title,
      url: `https://tokiq.in/blog/${this.post.slug}`,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://tokiq.in/blog/${this.post.slug}`
      },
      description: this.post.description,
      datePublished: this.post.publishedAt,
      author: {
        '@type': 'Organization',
        name: this.post.author
      },
      publisher: {
        '@type': 'Organization',
        name: 'TokIQ',
        logo: {
          '@type': 'ImageObject',
          url: 'https://tokiq.in/icon-512.png'
        }
      },
      image: this.post.image || DEFAULT_OG_IMAGE,
      keywords: this.post.tags
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
