import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_MODELS, PRICING_VERSION } from '../../lib/pricing/pricing.data';
import { countTokens, TokenResult } from '../../lib/calculators/token.calculator';
import { formatCurrency, formatNumber } from '../../lib/utils/number.utils';
import { ShowMathComponent, MathStep } from '../../shared/components/show-math.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';

const TOKEN_COLORS = [
  '#dbeafe', // blue
  '#dcfce7', // green
  '#fef9c3', // yellow
  '#fce7f3', // pink
  '#ede9fe', // purple
  '#ffedd5', // orange
];

const VISUALIZATION_TOKEN_LIMIT = 1000;

@Component({
  selector: 'app-token-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ShowMathComponent, PageHeaderComponent, IconComponent],
  template: `
    <div class="container-narrow py-10">

      <app-page-header
        title="Token Counter"
        subtitle="Count tokens for GPT, Claude, Gemini and more. All processing happens in your browser."
        [pricingVersion]="pricingVersion" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">

        <!-- Input -->
        <div class="card card-pad">
          <div class="mb-4">
            <label class="label" for="tc-model">Model</label>
            <select id="tc-model" class="field" [(ngModel)]="selectedModelId">
              <option *ngFor="let m of models" [value]="m.id">
                {{ m.name }} ({{ m.provider }})
              </option>
            </select>
            <p *ngIf="result?.isApproximate" class="callout-warning mt-2 flex items-start gap-2">
              <app-icon name="alert-triangle" [size]="14" class="mt-0.5" />
              <span>Token count is an approximation (~4 chars/token) for this model.
                Exact tokenization is available for GPT models.</span>
            </p>
          </div>

          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <label class="label mb-0" for="tc-text">Text</label>
              <button *ngIf="text()" type="button" (click)="clear()"
                      class="flex items-center gap-1 text-xs text-faint transition-colors hover:text-danger">
                <app-icon name="eraser" [size]="13" /> Clear
              </button>
            </div>
            <textarea id="tc-text"
              class="field resize-none font-mono text-xs"
              rows="12"
              placeholder="Paste your text, prompt, or document here..."
              [ngModel]="text()"
              (ngModelChange)="text.set($event)">
            </textarea>
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4">
          <div class="card card-pad" *ngIf="result as r">
            <h2 class="card-title mb-4">Text analysis</h2>

            <div class="grid grid-cols-2 gap-3">
              <div class="stat-accent">
                <div class="stat-label">Tokens</div>
                <div class="stat-value stat-value-accent">{{ formatNum(r.tokenCount) }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Words</div>
                <div class="stat-value">{{ formatNum(r.wordCount) }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">All chars</div>
                <div class="stat-value">{{ formatNum(r.charCount) }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">No-space chars</div>
                <div class="stat-value">{{ formatNum(r.charCountNoSpaces) }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Lines</div>
                <div class="stat-value">{{ formatNum(r.lineCount) }}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Sentences</div>
                <div class="stat-value">{{ formatNum(r.sentenceCount) }}</div>
              </div>
            </div>

            <p class="mt-3 px-1 text-xs text-faint">
              Avg chars/token:
              <strong class="text-muted">
                {{ r.tokenCount > 0 ? (r.charCount / r.tokenCount).toFixed(1) : '–' }}
              </strong>
            </p>

            <div *ngIf="selectedModel" class="mt-4 rounded-lg bg-surface-2 p-3">
              <div class="mb-1 text-xs text-muted">Cost if used as input to {{ selectedModel.name }}</div>
              <div class="flex items-baseline gap-2">
                <span class="font-mono text-lg font-bold tabular-nums text-accent">
                  {{ formatCost(r.tokenCount, selectedModel.inputPricePer1M) }}
                </span>
                <span class="text-xs text-faint">at \${{ selectedModel.inputPricePer1M }}/1M tokens</span>
              </div>
            </div>

            <app-show-math [steps]="mathSteps" />
          </div>

          <div *ngIf="!text()"
               class="card card-pad flex flex-col items-center justify-center py-14 text-center">
            <span class="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <app-icon name="sigma" [size]="22" />
            </span>
            <p class="text-sm text-muted">Paste text above to count tokens.</p>
          </div>
        </div>
      </div>

      <!-- Token visualization -->
      <div *ngIf="result && result.segments.length > 0" class="card card-pad mt-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="card-title">Token visualization</h2>
          <span class="text-xs text-faint">
            {{ formatNum(result.tokenCount) }} tokens · each color = 1 token
          </span>
        </div>

        <div *ngIf="result.tokenCount <= visualizationLimit; else tooManyTokens"
             class="overflow-x-auto rounded-lg bg-surface-2 p-4 font-mono text-sm leading-7"
             style="white-space: pre-wrap; word-break: break-word;">
          <span *ngFor="let seg of result.segments"
                [style.backgroundColor]="tokenColor(seg.index)"
                style="color:#0f172a"
                class="rounded-sm">{{ seg.text }}</span>
        </div>

        <ng-template #tooManyTokens>
          <p class="rounded-lg bg-surface-2 p-4 text-sm text-faint">
            Visualization is limited to {{ formatNum(visualizationLimit) }} tokens.
            Your text has {{ formatNum(result.tokenCount) }} tokens.
          </p>
        </ng-template>
      </div>

      <div class="card card-pad mt-5">
        <h2 class="card-title mb-3">How token counting works</h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <p class="prose-muted">
            LLMs don't process text character-by-character — they split text into <strong>tokens</strong>,
            which are chunks of characters (words, subwords, or punctuation). "Hello" is 1 token;
            "antidisestablishmentarianism" is 6.
          </p>
          <p class="prose-muted">
            For GPT models, this tool uses OpenAI's official <strong>tiktoken</strong> algorithm running
            in your browser. For other models, we use a ~4 chars/token approximation which is accurate
            to within 10–15%.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class TokenCalculatorComponent {
  pricingVersion = PRICING_VERSION;
  models = LLM_MODELS;
  selectedModelId = 'gpt-4o';
  formatNum = formatNumber;
  visualizationLimit = VISUALIZATION_TOKEN_LIMIT;

  text = signal('');

  get selectedModel() {
    return this.models.find(m => m.id === this.selectedModelId) ?? this.models[0];
  }

  get result(): TokenResult | null {
    const t = this.text();
    if (!t) return null;
    return countTokens(t, this.selectedModelId);
  }

  get mathSteps(): MathStep[] {
    const r = this.result;
    if (!r || r.tokenCount === 0) return [];
    return [
      {
        label: 'Token count',
        expression: r.isApproximate
          ? `${r.charCount} characters ÷ 4 chars/token (approx.)`
          : `Exact tiktoken (cl100k_base) encoding`,
        result: r.tokenCount,
        unit: 'tokens',
      },
      {
        label: 'Chars per token ratio',
        expression: `${r.charCount} chars ÷ ${r.tokenCount} tokens`,
        result: r.tokenCount > 0 ? parseFloat((r.charCount / r.tokenCount).toFixed(2)) : 0,
        unit: 'chars/token',
      },
    ];
  }

  tokenColor(index: number): string {
    return TOKEN_COLORS[index % TOKEN_COLORS.length];
  }

  formatCost(tokens: number, pricePer1M: number): string {
    return formatCurrency((tokens / 1_000_000) * pricePer1M);
  }

  clear() {
    this.text.set('');
  }
}
