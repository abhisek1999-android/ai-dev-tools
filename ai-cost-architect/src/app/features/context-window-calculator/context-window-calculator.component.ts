import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_MODELS, PRICING_VERSION } from '../../lib/pricing/pricing.data';
import { calculateContext, ContextResult } from '../../lib/calculators/context.calculator';
import { formatCurrency, tokensToK } from '../../lib/utils/number.utils';
import { ShowMathComponent, MathStep } from '../../shared/components/show-math.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { countTokens } from '../../lib/calculators/token.calculator';
import { LlmModel } from '../../lib/pricing/pricing.types';
import { MetaService } from '../../core/services/meta.service';

@Component({
  selector: 'app-context-window-calculator',
  standalone: true,
  host: { ngSkipHydration: 'true' },
  imports: [CommonModule, FormsModule, ShowMathComponent, PageHeaderComponent, IconComponent],
  template: `
    <div class="container-narrow py-10">

      <app-page-header
        title="Context Window Calculator"
        subtitle="See how much of a model's context window your text fills, and what it costs."
        [pricingVersion]="pricingVersion" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">

        <!-- Input -->
        <div class="space-y-4">
          <div class="card card-pad">
            <div class="mb-4">
              <label class="label" for="cw-model">Model</label>
              <select id="cw-model" class="field" [(ngModel)]="selectedModelId">
                <option *ngFor="let m of models" [value]="m.id">
                  {{ m.name }} ({{ tokensToK(m.contextWindow) }} context)
                </option>
              </select>
            </div>

            <div class="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
              <button type="button" (click)="inputMode.set('text')"
                      class="rounded-md py-1.5 text-sm font-medium transition-colors"
                      [class.bg-surface]="inputMode() === 'text'"
                      [class.text-fg]="inputMode() === 'text'"
                      [class.shadow-sm]="inputMode() === 'text'"
                      [class.text-muted]="inputMode() !== 'text'">
                Paste text
              </button>
              <button type="button" (click)="inputMode.set('tokens')"
                      class="rounded-md py-1.5 text-sm font-medium transition-colors"
                      [class.bg-surface]="inputMode() === 'tokens'"
                      [class.text-fg]="inputMode() === 'tokens'"
                      [class.shadow-sm]="inputMode() === 'tokens'"
                      [class.text-muted]="inputMode() !== 'tokens'">
                Enter token count
              </button>
            </div>

            <div *ngIf="inputMode() === 'text'">
              <label class="label" for="cw-text">Text / prompt</label>
              <textarea id="cw-text"
                class="field resize-none font-mono text-xs"
                rows="8"
                placeholder="Paste your system prompt, context, or document..."
                [ngModel]="pastedText()"
                (ngModelChange)="pastedText.set($event)">
              </textarea>
              <p *ngIf="pastedText()" class="mt-1 text-xs text-faint">
                ~{{ estimatedTokens | number }} tokens estimated
              </p>
            </div>

            <div *ngIf="inputMode() === 'tokens'">
              <label class="label" for="cw-tok">Token count</label>
              <input id="cw-tok" type="number" class="field" [(ngModel)]="manualTokens" min="0">
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4">
          <div class="card card-pad" *ngIf="result as r">

            <div class="mb-5">
              <div class="mb-2 flex justify-between text-sm">
                <span class="font-medium text-fg">Context usage</span>
                <span class="font-mono font-bold tabular-nums"
                      [class.text-accent]="!r.isNearLimit"
                      [class.text-danger]="r.isNearLimit">
                  {{ r.usedPercent }}%
                </span>
              </div>
              <div class="progress-track-lg">
                <div class="h-full rounded-full transition-all duration-500"
                     [class.bg-accent-solid]="r.usedPercent < 80"
                     [class.bg-warning]="r.usedPercent >= 80 && r.usedPercent < 95"
                     [class.bg-danger]="r.usedPercent >= 95"
                     [style.width.%]="r.usedPercent > 100 ? 100 : r.usedPercent">
                </div>
              </div>
              <p *ngIf="r.isNearLimit" class="mt-2 flex items-center gap-1.5 text-xs text-warning">
                <app-icon name="alert-triangle" [size]="13" />
                Approaching context limit. Consider summarizing or chunking.
              </p>
            </div>

            <div class="mb-3 grid grid-cols-2 gap-3">
              <div class="stat-accent">
                <div class="stat-label">Used tokens</div>
                <div class="stat-value stat-value-accent">{{ r.usedTokens | number }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Remaining tokens</div>
                <div class="stat-value">
                  {{ r.remainingTokens < 0 ? 'Over limit' : (r.remainingTokens | number) }}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="stat">
                <div class="stat-label">Cost for current context</div>
                <div class="mt-1 font-mono font-semibold text-fg">{{ fmt(r.costForUsed) }}</div>
                <div class="text-xs text-faint">input only</div>
              </div>
              <div class="stat">
                <div class="stat-label">Cost if context filled</div>
                <div class="mt-1 font-mono font-semibold text-fg">{{ fmt(r.costIfFilled) }}</div>
                <div class="text-xs text-faint">{{ tokensToK(selectedModel.contextWindow) }} tokens</div>
              </div>
            </div>

            <app-show-math [steps]="mathSteps" />
          </div>

          <div *ngIf="!hasInput"
               class="card card-pad flex flex-col items-center justify-center py-14 text-center">
            <span class="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <app-icon name="window" [size]="22" />
            </span>
            <p class="text-sm text-muted">Paste text or enter a token count to see context usage.</p>
          </div>

          <div class="card card-pad">
            <h2 class="card-title mb-3">Context windows at a glance</h2>
            <div class="space-y-2.5">
              <div *ngFor="let m of contextModels" class="flex items-center gap-3">
                <div class="w-32 shrink-0 text-xs text-muted">{{ m.name }}</div>
                <div class="progress-track flex-1">
                  <div class="h-full rounded-full bg-accent/60"
                       [style.width.%]="(m.contextWindow / maxContext) * 100">
                  </div>
                </div>
                <div class="w-12 text-right font-mono text-xs text-faint">
                  {{ tokensToK(m.contextWindow) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ContextWindowCalculatorComponent implements OnInit {
  pricingVersion = PRICING_VERSION;
  models = LLM_MODELS;
  tokensToK = tokensToK;
  fmt = formatCurrency;
  private meta = inject(MetaService);

  selectedModelId = 'gpt-4o';

  ngOnInit() {
    this.meta.setRouteMeta('/tools/context-window-calculator');
  }
  inputMode = signal<'text' | 'tokens'>('text');
  pastedText = signal('');
  manualTokens = 0;

  contextModels = LLM_MODELS.slice(0, 8);
  maxContext = Math.max(...LLM_MODELS.map(m => m.contextWindow));

  get selectedModel(): LlmModel {
    return LLM_MODELS.find(m => m.id === this.selectedModelId) ?? LLM_MODELS[0];
  }

  get estimatedTokens(): number {
    const t = this.pastedText();
    if (!t) return 0;
    return countTokens(t, this.selectedModelId).tokenCount;
  }

  get hasInput(): boolean {
    return this.inputMode() === 'text' ? this.pastedText().length > 0 : this.manualTokens > 0;
  }

  get usedTokens(): number {
    return this.inputMode() === 'text' ? this.estimatedTokens : this.manualTokens;
  }

  get result(): ContextResult | null {
    if (!this.hasInput) return null;
    return calculateContext(this.selectedModel, this.usedTokens);
  }

  get mathSteps(): MathStep[] {
    const r = this.result;
    if (!r) return [];
    return r.math.map(m => ({ label: m.label, expression: m.expression, result: m.result }));
  }
}
