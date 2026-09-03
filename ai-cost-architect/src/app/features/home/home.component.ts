import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon.component';
import { MetaService } from '../../core/services/meta.service';

interface Tool {
  icon: string;
  title: string;
  description: string;
  path: string;
  badge?: string;
}

interface Feature { icon: string; title: string; description: string; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <!-- Hero -->
    <section class="border-b border-border bg-surface">
      <div class="container-page py-16 sm:py-20">
        <div class="mx-auto max-w-3xl text-center">
          <span class="badge-positive mb-6">
            <app-icon name="lock" [size]="13" />
            All calculations run in your browser — nothing is sent to a server
          </span>
          <h1 class="text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            Model your AI bill<br class="hidden sm:block" /> before you build it.
          </h1>
          <p class="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Free AI cost calculators for developers. Estimate token costs, compare LLM pricing,
            plan RAG pipelines, and optimize your AI application budget.
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a routerLink="/tools/llm-cost-calculator" class="btn-primary">
              Start calculating
              <app-icon name="arrow-right" [size]="16" />
            </a>
            <a routerLink="/tools/model-comparison" class="btn-secondary">
              Compare models
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Tools grid -->
    <section class="container-page py-16">
      <div class="mb-10 text-center">
        <h2 class="text-2xl font-bold tracking-tight text-fg">AI Cost Calculators</h2>
        <p class="mt-2 text-muted">Choose a tool to start estimating your AI costs.</p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a *ngFor="let tool of tools" [routerLink]="tool.path"
           class="card card-pad group transition-colors hover:border-accent/50">
          <div class="mb-4 flex items-start justify-between">
            <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <app-icon [name]="tool.icon" [size]="20" />
            </span>
            <span *ngIf="tool.badge" class="badge-neutral">{{ tool.badge }}</span>
          </div>
          <h3 class="flex items-center gap-1.5 font-semibold text-fg transition-colors group-hover:text-accent">
            {{ tool.title }}
            <app-icon name="arrow-right" [size]="15"
              class="opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </h3>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">{{ tool.description }}</p>
        </a>
      </div>
    </section>

    <!-- Why -->
    <section class="border-t border-border bg-surface">
      <div class="container-page py-16">
        <h2 class="mb-10 text-center text-2xl font-bold tracking-tight text-fg">Why tokiq?</h2>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div *ngFor="let f of features" class="text-center">
            <span class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <app-icon [name]="f.icon" [size]="22" />
            </span>
            <h3 class="font-semibold text-fg">{{ f.title }}</h3>
            <p class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{{ f.description }}</p>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HomeComponent implements OnInit {
  private meta = inject(MetaService);

  ngOnInit() {
    this.meta.setPageMeta({
      title: 'tokiq — Free Token Counter & AI Cost Calculators',
      description: 'Free tools to estimate AI costs: token counter, LLM cost calculator, model comparison, context window calculator, and RAG cost planner. All processing in-browser.',
      keywords: 'AI cost calculator, token counter, LLM pricing, model comparison, RAG cost, AI budgeting',
      type: 'website'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'tokiq',
      description: 'Free token counter and AI cost calculators for developers',
      url: 'https://tokiq.in/home',
      applicationCategory: 'UtilityApplication'
    });
  }

  tools: Tool[] = [
    {
      icon: 'sigma',
      title: 'Token Counter',
      description: 'Paste any text and instantly count tokens for GPT, Claude, Gemini and more. See character and word counts too.',
      path: '/tools/token-calculator',
      badge: 'Popular',
    },
    {
      icon: 'coins',
      title: 'LLM Cost Calculator',
      description: 'Enter your token usage and request volume to get daily, monthly and yearly cost estimates with full math breakdown.',
      path: '/tools/llm-cost-calculator',
    },
    {
      icon: 'bar-chart',
      title: 'Model Comparison',
      description: 'Compare costs across GPT-4o, Claude, Gemini, Mistral, DeepSeek and more for your exact workload.',
      path: '/tools/model-comparison',
      badge: 'Most useful',
    },
    {
      icon: 'window',
      title: 'Context Window Calculator',
      description: 'See how much of a model\'s context window your text fills, and what it costs to use that context.',
      path: '/tools/context-window-calculator',
    },
    {
      icon: 'search',
      title: 'RAG Cost Calculator',
      description: 'Full RAG pipeline cost estimation: embeddings, vector DB storage, retrieval, reranking, and LLM generation with What-If optimization.',
      path: '/tools/rag-cost-calculator',
      badge: 'Advanced',
    },
  ];

  features: Feature[] = [
    {
      icon: 'lock',
      title: 'Privacy first',
      description: 'Every calculation runs entirely in your browser. Your prompts and architecture details never leave your device.',
    },
    {
      icon: 'sigma',
      title: 'Show the math',
      description: 'Every result includes a step-by-step formula. No black boxes — see exactly how costs are calculated.',
    },
    {
      icon: 'check',
      title: 'Verified pricing',
      description: 'Pricing is manually verified against official provider docs and dated. Know when data was last checked.',
    },
  ];
}
