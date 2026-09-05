import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_MODELS, EMBEDDING_MODELS, VECTOR_DBS, PRICING_VERSION } from '../../lib/pricing/pricing.data';
import { calculateRagCost, RagCostBreakdown } from '../../lib/calculators/rag.calculator';
import { formatCurrency, formatNumber } from '../../lib/utils/number.utils';
import { ShowMathComponent, MathStep } from '../../shared/components/show-math.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { LlmModel, EmbeddingModel, VectorDbOption } from '../../lib/pricing/pricing.types';
import { MetaService } from '../../core/services/meta.service';

@Component({
  selector: 'app-rag-cost-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, ShowMathComponent, PageHeaderComponent, IconComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <div class="container-page py-10">

      <app-page-header
        title="RAG Cost Calculator"
        subtitle="Full RAG pipeline cost: embeddings, vector storage, retrieval, and LLM generation."
        [pricingVersion]="pricingVersion" />

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-5">

        <!-- Inputs -->
        <div class="space-y-4 xl:col-span-2">

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="file-text" [size]="16" class="text-accent" /> Corpus
            </h2>
            <div class="space-y-3">
              <div>
                <label class="label" for="rag-docs">Number of documents</label>
                <input id="rag-docs" type="number" class="field" [(ngModel)]="documentCount" min="1">
              </div>
              <div>
                <label class="label" for="rag-doctok">Avg tokens per document</label>
                <input id="rag-doctok" type="number" class="field" [(ngModel)]="avgDocumentTokens" min="100">
              </div>
              <div>
                <label class="label" for="rag-growth">Monthly corpus growth (%)</label>
                <input id="rag-growth" type="number" class="field" [(ngModel)]="corpusGrowthPct" min="0" max="100">
              </div>
            </div>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="scissors" [size]="16" class="text-accent" /> Chunking
            </h2>
            <div class="space-y-3">
              <div>
                <label class="label" for="rag-chunk">Chunk size (tokens)</label>
                <input id="rag-chunk" type="number" class="field" [(ngModel)]="chunkSize" min="64">
              </div>
              <div>
                <label class="label" for="rag-overlap">Overlap (%)</label>
                <input id="rag-overlap" type="number" class="field" [(ngModel)]="chunkOverlapPct" min="0" max="80">
              </div>
            </div>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="sigma" [size]="16" class="text-accent" /> Embedding model
            </h2>
            <select class="field" [(ngModel)]="embeddingModelId" aria-label="Embedding model">
              <option *ngFor="let m of embeddingModels" [value]="m.id">
                {{ m.name }} (\${{ m.pricePer1M }}/1M · {{ m.dimensions }}d)
              </option>
            </select>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="search" [size]="16" class="text-accent" /> Retrieval
            </h2>
            <div class="space-y-3">
              <div>
                <label class="label" for="rag-qpd">Queries per day</label>
                <input id="rag-qpd" type="number" class="field" [(ngModel)]="queriesPerDay" min="1">
              </div>
              <div>
                <label class="label" for="rag-topk">Top-K chunks per query</label>
                <input id="rag-topk" type="number" class="field" [(ngModel)]="topK" min="1" max="20">
              </div>
              <div>
                <label class="label" for="rag-db">Vector database</label>
                <select id="rag-db" class="field" [(ngModel)]="vectorDbId">
                  <option *ngFor="let db of vectorDbs" [value]="db.id">{{ db.name }}</option>
                </select>
                <p *ngIf="selectedVectorDb?.notes" class="mt-1 text-xs text-faint">
                  {{ selectedVectorDb?.notes }}
                </p>
              </div>
              <label class="flex cursor-pointer items-center gap-2">
                <input type="checkbox" class="checkbox" [(ngModel)]="useReranker">
                <span class="text-sm text-muted">Use reranker (~$2/1M tokens)</span>
              </label>
            </div>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="zap" [size]="16" class="text-accent" /> Generation (LLM)
            </h2>
            <div class="space-y-3">
              <div>
                <label class="label" for="rag-llm">LLM</label>
                <select id="rag-llm" class="field" [(ngModel)]="llmId">
                  <option *ngFor="let m of llmModels" [value]="m.id">{{ m.name }}</option>
                </select>
              </div>
              <div>
                <label class="label" for="rag-outtok">Output tokens per query</label>
                <input id="rag-outtok" type="number" class="field" [(ngModel)]="outputTokensPerQuery" min="50">
              </div>
              <label class="flex cursor-pointer items-center gap-2">
                <input type="checkbox" class="checkbox" [(ngModel)]="cachingEnabled"
                       [disabled]="!selectedLlm?.cachedInputPricePer1M">
                <span class="text-sm text-muted">Enable prompt caching</span>
              </label>
              <div *ngIf="cachingEnabled">
                <label class="label" for="rag-cache">Cache hit rate (%)</label>
                <input id="rag-cache" type="number" class="field" [(ngModel)]="cacheHitRatePct" min="0" max="100">
              </div>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4 xl:col-span-3">

          <div class="card card-pad" *ngIf="result as r">
            <div class="stat-hero mb-5">
              <div class="stat-label">Total monthly cost</div>
              <div class="stat-hero-value">{{ fmt(r.totalMonthlyCost) }}</div>
              <div class="mt-1 text-sm text-muted">
                for {{ queriesPerDay.toLocaleString() }} queries/day · {{ formatNum(r.chunksTotal) }} total chunks
              </div>
            </div>

            <h2 class="card-title mb-3">Monthly breakdown</h2>
            <div class="mb-4 space-y-2.5">
              <div *ngFor="let line of costLines(r)" class="flex items-center gap-3">
                <div class="w-40 shrink-0 text-sm text-muted">{{ line.label }}</div>
                <div class="progress-track flex-1">
                  <div class="h-full rounded-full bg-accent/60"
                       [style.width.%]="r.totalMonthlyCost > 0 ? (line.value / r.totalMonthlyCost * 100) : 0">
                  </div>
                </div>
                <div class="w-20 text-right font-mono text-sm font-medium tabular-nums text-fg">
                  {{ fmt(line.value) }}
                </div>
              </div>
            </div>

            <div class="callout-warning">
              <strong class="font-semibold">One-time initial indexing cost:</strong> {{ fmt(r.initialEmbeddingCost) }}
              <span class="mt-0.5 block text-xs opacity-80">
                {{ formatNum(r.totalTokensIndexed) }} tokens × \${{ selectedEmbeddingModel?.pricePer1M }}/1M
              </span>
            </div>

            <app-show-math [steps]="mathSteps(r)" />
          </div>

          <div class="card card-pad" *ngIf="result as r">
            <h2 class="card-title-icon mb-3">
              <app-icon name="lightbulb" [size]="16" class="text-accent" /> What-if optimizations
            </h2>
            <p *ngIf="r.whatIf.length === 0" class="text-sm text-faint">
              No significant optimization opportunities found for the current configuration.
            </p>
            <div class="space-y-3">
              <div *ngFor="let opt of r.whatIf" class="callout-positive">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-medium">{{ opt.label }}</div>
                    <div class="mt-0.5 text-xs opacity-80">{{ opt.description }}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="font-mono text-lg font-bold tabular-nums">-{{ fmt(opt.saving) }}/mo</div>
                    <div class="text-xs opacity-80">{{ opt.savingPct }}% saving</div>
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-3 flex items-start gap-1.5 text-xs text-faint">
              <app-icon name="alert-triangle" [size]="12" class="mt-0.5" />
              Potential cost savings. Validate retrieval quality before switching models.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RagCostCalculatorComponent implements OnInit {
  pricingVersion = PRICING_VERSION;
  llmModels = LLM_MODELS;
  embeddingModels = EMBEDDING_MODELS;
  vectorDbs = VECTOR_DBS;
  fmt = formatCurrency;
  formatNum = formatNumber;
  private meta = inject(MetaService);

  documentCount = 1000;

  ngOnInit() {
    this.meta.setRouteMeta('/tools/rag-cost-calculator');
  }
  avgDocumentTokens = 2000;
  corpusGrowthPct = 10;
  chunkSize = 512;
  chunkOverlapPct = 10;
  embeddingModelId = 'text-embedding-3-small';
  queriesPerDay = 500;
  topK = 5;
  vectorDbId = 'pinecone-standard';
  useReranker = false;
  rerankerCostPer1MTokens = 2;
  llmId = 'gpt-4o-mini';
  outputTokensPerQuery = 400;
  cachingEnabled = false;
  cacheHitRatePct = 50;

  get selectedLlm(): LlmModel | undefined {
    return LLM_MODELS.find(m => m.id === this.llmId);
  }

  get selectedEmbeddingModel(): EmbeddingModel | undefined {
    return EMBEDDING_MODELS.find(m => m.id === this.embeddingModelId);
  }

  get selectedVectorDb(): VectorDbOption | undefined {
    return VECTOR_DBS.find(db => db.id === this.vectorDbId);
  }

  get result(): RagCostBreakdown | null {
    const embeddingModel = this.selectedEmbeddingModel;
    const llm = this.selectedLlm;
    const vectorDb = this.selectedVectorDb;
    if (!embeddingModel || !llm || !vectorDb) return null;

    return calculateRagCost({
      documentCount: this.documentCount,
      avgDocumentTokens: this.avgDocumentTokens,
      corpusGrowthPct: this.corpusGrowthPct,
      chunkSize: this.chunkSize,
      chunkOverlapPct: this.chunkOverlapPct,
      embeddingModel,
      queriesPerDay: this.queriesPerDay,
      topK: this.topK,
      vectorDb,
      useReranker: this.useReranker,
      rerankerCostPer1MTokens: this.rerankerCostPer1MTokens,
      llm,
      outputTokensPerQuery: this.outputTokensPerQuery,
      cachingEnabled: this.cachingEnabled,
      cacheHitRate: this.cacheHitRatePct / 100,
    });
  }

  costLines(r: RagCostBreakdown) {
    return [
      { label: 'Monthly embedding', value: r.monthlyEmbeddingCost },
      { label: 'Vector DB storage', value: r.vectorDbStorageCost },
      { label: 'Vector DB queries', value: r.vectorDbQueryCost },
      { label: 'LLM generation', value: r.generationCost },
    ].filter(l => l.value > 0);
  }

  mathSteps(r: RagCostBreakdown): MathStep[] {
    return r.math.map(m => ({
      label: `[${m.section}] ${m.label}`,
      expression: m.expression,
      result: m.result,
    }));
  }
}
