import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_MODELS, PRICING_VERSION, WORKLOAD_PRESETS } from '../../lib/pricing/pricing.data';
import { compareModels, ComparisonRow } from '../../lib/calculators/comparison.calculator';
import { formatCurrency } from '../../lib/utils/number.utils';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MetaService } from '../../core/services/meta.service';

@Component({
  selector: 'app-model-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, IconComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <div class="container-page py-10">

      <app-page-header
        title="Model Comparison"
        subtitle="Compare LLM costs across providers for your exact workload."
        [pricingVersion]="pricingVersion" />

      <!-- Workload config -->
      <div class="card card-pad mb-5">
        <h2 class="card-title mb-4">Workload configuration</h2>

        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="mr-1 text-xs text-faint">Presets:</span>
          <button *ngFor="let p of presets" type="button" (click)="applyPreset(p)" class="chip">
            {{ p.label }}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label class="label" for="mc-in">Input tokens / request</label>
            <input id="mc-in" type="number" class="field" [(ngModel)]="inputTokens" min="1">
          </div>
          <div>
            <label class="label" for="mc-out">Output tokens / request</label>
            <input id="mc-out" type="number" class="field" [(ngModel)]="outputTokens" min="1">
          </div>
          <div>
            <label class="label" for="mc-req">Requests / month</label>
            <input id="mc-req" type="number" class="field" [(ngModel)]="requestsPerMonth" min="1">
          </div>
          <div class="flex items-end">
            <button type="button" (click)="resetModels()" class="btn-secondary w-full">
              <app-icon name="rotate-ccw" [size]="15" /> Reset models
            </button>
          </div>
        </div>
      </div>

      <!-- Model selection -->
      <div class="card card-pad mb-5">
        <h2 class="card-title mb-3">
          Select models to compare
          <span class="ml-2 text-xs font-normal text-faint">({{ selectedModelIds().length }} selected)</span>
        </h2>
        <div class="flex flex-wrap gap-2">
          <button *ngFor="let m of allModels" type="button"
                  (click)="toggleModel(m.id)"
                  class="chip" [class.chip-active]="isSelected(m.id)">
            {{ m.name }}
          </button>
        </div>
      </div>

      <!-- Results table -->
      <div class="card card-pad">
        <div *ngIf="results.length === 0" class="py-12 text-center text-sm text-faint">
          Select at least one model above.
        </div>

        <div *ngIf="results.length > 0">
          <div *ngIf="results.length > 1" class="callout-positive mb-4 flex items-start gap-2">
            <app-icon name="trending-down" [size]="16" class="mt-0.5 shrink-0" />
            <p>
              <strong>{{ results[0].model.name }}</strong> is cheapest at
              <strong>{{ fmt(results[0].monthlyCost) }}/month</strong>.
              Switching from <strong>{{ results[results.length - 1].model.name }}</strong>
              could save <strong>{{ fmt(results[results.length - 1].savingsVsCheapest ?? 0) }}/month</strong>.
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model</th>
                  <th class="!text-right">Per request</th>
                  <th class="!text-right">Monthly</th>
                  <th class="!text-right">Yearly</th>
                  <th class="!text-right">vs cheapest</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of results" [ngClass]="{ 'bg-positive/5': row.rank === 1 }">
                  <td>
                    <!-- text-bg (black) on the light sage fill: ~9.5:1.
                         text-white here was ~1.9:1 and failed AA. -->
                    <span class="flex h-5 w-5 items-center justify-center text-[11px] font-bold"
                          [class.bg-positive]="row.rank === 1"
                          [class.text-bg]="row.rank === 1"
                          [class.bg-surface-2]="row.rank !== 1"
                          [class.text-muted]="row.rank !== 1">
                      {{ row.rank }}
                    </span>
                  </td>
                  <td>
                    <div class="font-medium text-fg">{{ row.model.name }}</div>
                    <div class="text-xs text-faint">
                      {{ row.model.provider }} · {{ (row.model.contextWindow / 1000).toFixed(0) }}K ctx
                    </div>
                  </td>
                  <td class="text-right font-mono tabular-nums text-muted">{{ fmt(row.costPerRequest) }}</td>
                  <td class="text-right font-mono font-semibold tabular-nums"
                      [class.text-positive]="row.rank === 1"
                      [class.text-fg]="row.rank !== 1">
                    {{ fmt(row.monthlyCost) }}
                  </td>
                  <td class="text-right font-mono tabular-nums text-faint">{{ fmt(row.yearlyCost) }}</td>
                  <td class="text-right">
                    <span *ngIf="row.rank === 1" class="badge-positive">Cheapest</span>
                    <span *ngIf="row.rank !== 1 && (row.savingsVsCheapest ?? 0) > 0"
                          class="font-mono text-xs text-danger">
                      +{{ fmt(row.savingsVsCheapest ?? 0) }}/mo
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mt-4 text-xs text-faint">
            Workload: {{ inputTokens.toLocaleString() }} input + {{ outputTokens.toLocaleString() }} output tokens
            × {{ requestsPerMonth.toLocaleString() }} requests/month
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ModelComparisonComponent implements OnInit {
  pricingVersion = PRICING_VERSION;
  presets = WORKLOAD_PRESETS;
  allModels = LLM_MODELS;
  fmt = formatCurrency;
  private meta = inject(MetaService);

  ngOnInit() {
    this.meta.setPageMeta({
      title: 'LLM Model Comparison — Compare Costs Across AI Providers',
      description: 'Side-by-side cost comparison for GPT-4o, Claude, Gemini, Mistral, DeepSeek, Llama, and more. Find the most cost-effective model for your workload.',
      keywords: 'model comparison, LLM pricing, GPT vs Claude, cost comparison',
      type: 'website'
    });

    this.meta.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Model Comparison',
      description: 'Compare LLM costs across providers',
      url: 'https://tokiq.in/tools/model-comparison',
      applicationCategory: 'UtilityApplication'
    });
  }

  inputTokens = 1000;
  outputTokens = 500;
  requestsPerMonth = 10000;

  selectedModelIds = signal<string[]>([
    'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-haiku-4-5',
    'gemini-2-0-flash', 'deepseek-v3', 'mistral-small',
  ]);

  get results(): ComparisonRow[] {
    const ids = this.selectedModelIds();
    if (ids.length === 0) return [];
    const models = LLM_MODELS.filter(m => ids.includes(m.id));
    if (models.length === 0) return [];
    return compareModels(models, this.inputTokens, this.outputTokens, this.requestsPerMonth).rows;
  }

  isSelected(id: string): boolean {
    return this.selectedModelIds().includes(id);
  }

  toggleModel(id: string) {
    this.selectedModelIds.update(ids =>
      ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
    );
  }

  resetModels() {
    this.selectedModelIds.set([
      'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-haiku-4-5',
      'gemini-2-0-flash', 'deepseek-v3', 'mistral-small',
    ]);
  }

  applyPreset(preset: typeof WORKLOAD_PRESETS[0]) {
    this.inputTokens = preset.inputTokens;
    this.outputTokens = preset.outputTokens;
    this.requestsPerMonth = preset.requestsPerMonth;
  }
}
