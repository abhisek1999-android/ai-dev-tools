import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { getBlogPost, getRelatedPosts, BLOG_POSTS } from '../../lib/blog/blog.data';
import { MetaService } from '../../core/services/meta.service';
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
            <span *ngFor="let tag of post.tags" class="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded">
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
             class="group block transition-all hover:shadow-sm">
            <article class="border border-border rounded-lg p-5 bg-surface h-full hover:bg-surface-2 transition-colors flex flex-col">
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
  styles: [`
    :host {
      display: block;
    }

    .prose {
      font-size: 1rem;
      line-height: 1.6;
    }

    .prose :deep h2 {
      font-size: 1.5rem;
      font-weight: bold;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: var(--color-fg);
    }

    .prose :deep h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: var(--color-fg);
    }

    .prose :deep p {
      margin-bottom: 1rem;
      color: var(--color-muted);
    }

    .prose :deep ul,
    .prose :deep ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
      color: var(--color-muted);
    }

    .prose :deep li {
      margin-bottom: 0.5rem;
    }

    .prose :deep strong {
      font-weight: 600;
      color: var(--color-fg);
    }

    .prose :deep table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    .prose :deep table th,
    .prose :deep table td {
      border: 1px solid var(--color-border);
      padding: 0.75rem;
      text-align: left;
    }

    .prose :deep table th {
      background-color: var(--color-surface-2);
      font-weight: 600;
      color: var(--color-fg);
    }

    .prose :deep code {
      background-color: var(--color-surface-2);
      color: var(--color-accent);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.9em;
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
      title: `${this.post.title} — AI Cost Blog`,
      description: this.post.description,
      keywords: this.post.tags.join(', '),
      author: this.post.author,
      type: 'article'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: this.post.title,
      description: this.post.description,
      datePublished: this.post.publishedAt,
      author: {
        '@type': 'Organization',
        name: this.post.author
      },
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
