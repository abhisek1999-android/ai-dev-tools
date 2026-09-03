import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS } from '../../lib/blog/blog.data';
import { MetaService } from '../../core/services/meta.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="container-page py-10">
      <!-- Header -->
      <div class="mb-12 text-center">
        <h1 class="text-4xl font-bold text-fg sm:text-5xl">AI Cost Blog</h1>
        <p class="mt-3 text-lg text-muted">Guides, insights, and strategies for optimizing AI application costs</p>
      </div>

      <!-- Blog Posts Grid -->
      <div class="space-y-6">
        <a *ngFor="let post of posts"
           [routerLink]="'/blog/' + post.slug"
           class="group block transition-all hover:shadow-sm">
          <article class="border border-border rounded-lg p-6 bg-surface hover:bg-surface-2 transition-colors">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div class="flex-1">
                <div class="mb-2 flex items-center gap-2 text-sm text-muted">
                  <span class="badge-neutral">{{ post.category }}</span>
                  <span>{{ formatDate(post.publishedAt) }}</span>
                  <span>{{ post.readTime }} min read</span>
                </div>
                <h2 class="text-2xl font-bold text-fg group-hover:text-accent transition-colors mb-2">
                  {{ post.title }}
                </h2>
                <p class="text-muted mb-3">{{ post.description }}</p>
                <div class="flex flex-wrap gap-2">
                  <span *ngFor="let tag of post.tags" class="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded">
                    #{{ tag }}
                  </span>
                </div>
              </div>
              <div class="flex-shrink-0 flex items-center gap-1 text-accent">
                <span class="text-sm font-medium">Read</span>
                <app-icon name="arrow-right" [size]="16" />
              </div>
            </div>
          </article>
        </a>
      </div>

      <!-- No Posts -->
      <div *ngIf="posts.length === 0" class="text-center py-12">
        <p class="text-muted">No blog posts found.</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BlogListComponent implements OnInit {
  private meta = inject(MetaService);
  posts = BLOG_POSTS;

  ngOnInit() {
    this.meta.setPageMeta({
      title: 'tokiq Blog — Guides and Strategies for LLM Optimization',
      description: 'Read expert guides on token counting, LLM pricing, RAG systems, cost optimization, and building cost-effective AI applications.',
      keywords: 'AI costs, LLM pricing, token counting, RAG, cost optimization',
      type: 'website'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'tokiq Blog',
      description: 'Guides and strategies for optimizing AI application costs, token counting, and budgeting',
      url: 'https://tokiq.in/blog'
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
