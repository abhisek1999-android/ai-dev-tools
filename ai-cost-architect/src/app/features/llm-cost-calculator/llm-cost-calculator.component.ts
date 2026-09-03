import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_MODELS, PRICING_VERSION, WORKLOAD_PRESETS } from '../../lib/pricing/pricing.data';
import { calculateCost, CostBreakdown } from '../../lib/calculators/cost.calculator';
import { formatCurrency } from '../../lib/utils/number.utils';
import { ShowMathComponent } from '../../shared/components/show-math.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { LlmModel } from '../../lib/pricing/pricing.types';
import { MetaService } from '../../core/services/meta.service';

@Component({
  selector: 'app-llm-cost-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ShowMathComponent, PageHeaderComponent, IconComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <div class="container-page py-10">

      <app-page-header
        title="LLM Cost Calculator"
        subtitle="Estimate the monthly cost of your LLM usage based on token volume."
        [pricingVersion]="pricingVersion" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-5">

        <!-- Inputs -->
        <div class="space-y-4 lg:col-span-2">
          <div class="card card-pad">
            <h2 class="card-title mb-4">Workload presets</h2>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let p of presets" type="button"
                      (click)="applyPreset(p)" class="chip">
                {{ p.label }}
              </button>
            </div>
          </div>

          <div class="card card-pad space-y-4">
            <div>
              <label class="label" for="llm-model">Model</label>
              <select id="llm-model" class="field" [(ngModel)]="selectedModelId">
                <optgroup *ngFor="let group of modelGroups" [label]="group.provider | titlecase">
                  <option *ngFor="let m of group.models" [value]="m.id">{{ m.name }}</option>
                </optgroup>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label" for="llm-in">Input tokens / request</label>
                <input id="llm-in" type="number" class="field" [(ngModel)]="inputTokens" min="1">
              </div>
              <div>
                <label class="label" for="llm-out">Output tokens / request</label>
                <input id="llm-out" type="number" class="field" [(ngModel)]="outputTokens" min="1">
              </div>
            </div>

            <div>
              <label class="label" for="llm-req">Requests / month</label>
              <input id="llm-req" type="number" class="field" [(ngModel)]="requestsPerMonth" min="1">
            </div>

            <div class="space-y-2.5 border-t border-border pt-3">
              <label class="flex cursor-pointer items-center gap-2">
                <input type="checkbox" class="checkbox" [(ngModel)]="useCaching"
                       [disabled]="!selectedModel?.cachedInputPricePer1M">
                <span class="text-sm text-muted">Enable prompt caching</span>
                <span *ngIf="selectedModel?.cachedInputPricePer1M" class="text-xs text-positive">
                  (\${{ selectedModel?.cachedInputPricePer1M }}/1M cached)
                </span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input type="checkbox" class="checkbox" [(ngModel)]="useBatch"
                       [disabled]="!selectedModel?.batchInputPricePer1M">
                <span class="text-sm text-muted">Batch API (50% discount)</span>
                <span *ngIf="selectedModel?.batchInputPricePer1M" class="text-xs text-positive">available</span>
                <span *ngIf="!selectedModel?.batchInputPricePer1M" class="text-xs text-faint">not available</span>
              </label>
            </div>

            <p *ngIf="selectedModel?.notes" class="callout-warning flex items-start gap-2">
              <app-icon name="info" [size]="14" class="mt-0.5" />
              <span>{{ selectedModel?.notes }}</span>
            </p>
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4 lg:col-span-3">
          <div class="card card-pad" *ngIf="result as r">
            <h2 class="card-title mb-4">Cost estimate</h2>

            <div class="stat-hero mb-4">
              <div class="stat-label">Monthly cost</div>
              <div class="stat-hero-value">{{ fmt(r.monthlyCost) }}</div>
              <div class="mt-1 text-sm text-muted">
                for {{ requestsPerMonth.toLocaleString() }} requests/month
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="stat text-center">
                <div class="stat-label">Per request</div>
                <div class="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{{ fmt(r.totalCostPerRequest) }}</div>
              </div>
              <div class="stat text-center">
                <div class="stat-label">Daily</div>
                <div class="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{{ fmt(r.dailyCost) }}</div>
              </div>
              <div class="stat text-center">
                <div class="stat-label">Yearly</div>
                <div class="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{{ fmt(r.yearlyCost) }}</div>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-3">
              <div class="stat">
                <div class="stat-label">Input cost / request</div>
                <div class="mt-1 font-mono font-medium text-fg">{{ fmt(r.inputCostPerRequest) }}</div>
                <div class="text-xs text-faint">{{ inputTokens.toLocaleString() }} tokens</div>
              </div>
              <div class="stat">
                <div class="stat-label">Output cost / request</div>
                <div class="mt-1 font-mono font-medium text-fg">{{ fmt(r.outputCostPerRequest) }}</div>
                <div class="text-xs text-faint">{{ outputTokens.toLocaleString() }} tokens</div>
              </div>
            </div>

            <app-show-math [steps]="r.math" />
          </div>

          <div class="card card-pad" *ngIf="selectedModel as m">
            <h2 class="card-title mb-3">{{ m.name }} pricing</h2>
            <div class="grid grid-cols-2 gap-x-4 text-sm">
              <div class="flex justify-between border-b border-border py-1.5">
                <span class="text-muted">Input</span>
                <span class="font-mono font-medium text-fg">\${{ m.inputPricePer1M }}/1M</span>
              </div>
              <div class="flex justify-between border-b border-border py-1.5">
                <span class="text-muted">Output</span>
                <span class="font-mono font-medium text-fg">\${{ m.outputPricePer1M }}/1M</span>
              </div>
              <div *ngIf="m.cachedInputPricePer1M" class="flex justify-between border-b border-border py-1.5">
                <span class="text-muted">Cached input</span>
                <span class="font-mono font-medium text-positive">\${{ m.cachedInputPricePer1M }}/1M</span>
              </div>
              <div class="flex justify-between border-b border-border py-1.5">
                <span class="text-muted">Context window</span>
                <span class="font-mono font-medium text-fg">{{ (m.contextWindow / 1000).toFixed(0) }}K</span>
              </div>
            </div>
            <p class="mt-2.5 text-xs text-faint">
              Verified {{ m.lastVerified }} ·
              <a [href]="m.pricingUrl" target="_blank" rel="noopener" class="link">
                Official pricing page
                <app-icon name="external-link" [size]="11" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LlmCostCalculatorComponent implements OnInit {
  pricingVersion = PRICING_VERSION;
  presets = WORKLOAD_PRESETS;
  fmt = formatCurrency;
  private meta = inject(MetaService);

  ngOnInit() {
    this.meta.setPageMeta({
      title: 'LLM Cost Calculator — Estimate Monthly AI API Costs',
      description: 'Calculate daily, monthly, and yearly costs for LLM API usage. Get cost estimates for GPT-4o, Claude, Gemini, Mistral, and more with full breakdown.',
      keywords: 'LLM cost calculator, API costs, token calculator, pricing estimate',
      type: 'website'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'LLM Cost Calculator',
      description: 'Calculate costs for LLM API usage',
      url: 'https://tokiq.in/tools/llm-cost-calculator',
      applicationCategory: 'UtilityApplication'
    });
  }

  selectedModelId = 'gpt-4o';
  inputTokens = 1000;
  outputTokens = 500;
  requestsPerMonth = 10000;
  useCaching = false;
  useBatch = false;

  get modelGroups(): { provider: string; models: LlmModel[] }[] {
    const groups: { provider: string; models: LlmModel[] }[] = [];
    for (const model of LLM_MODELS) {
      const existing = groups.find(g => g.provider === model.provider);
      if (existing) existing.models.push(model);
      else groups.push({ provider: model.provider, models: [model] });
    }
    return groups;
  }

  get selectedModel(): LlmModel | undefined {
    return LLM_MODELS.find(m => m.id === this.selectedModelId);
  }

  get result(): CostBreakdown | null {
    const model = this.selectedModel;
    if (!model || this.inputTokens <= 0 || this.outputTokens <= 0 || this.requestsPerMonth <= 0) return null;
    return calculateCost({
      model,
      inputTokensPerRequest: this.inputTokens,
      outputTokensPerRequest: this.outputTokens,
      requestsPerMonth: this.requestsPerMonth,
      useCaching: this.useCaching,
      useBatch: this.useBatch,
    });
  }

  applyPreset(preset: typeof WORKLOAD_PRESETS[0]) {
    this.inputTokens = preset.inputTokens;
    this.outputTokens = preset.outputTokens;
    this.requestsPerMonth = preset.requestsPerMonth;
  }
}
