import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MetaService } from '../../core/services/meta.service';
import {
  ValidatorApiError,
  ValidatorApiService,
} from '../../core/services/validator-api.service';
import {
  ClaimReport,
  ProviderName,
  ValidationReport,
  Verdict,
} from '../../core/services/validator-api.types';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';

const PROVIDER_HINTS: { id: ProviderName; label: string }[] = [
  { id: 'ollama', label: 'Ollama (server default)' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'groq', label: 'Groq' },
];

@Component({
  selector: 'app-answer-validator',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, IconComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <div class="container-page py-10">

      <app-page-header
        title="LLM Answer Validator"
        subtitle="Check whether an LLM answer is actually supported by the evidence behind it — claim by claim."
        [runsInBrowser]="false" />

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-5">

        <!-- Inputs -->
        <div class="space-y-4 xl:col-span-2">

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="file-text" [size]="16" class="text-accent" /> What was asked
            </h2>
            <label class="label" for="av-question">Question</label>
            <textarea id="av-question" class="field" rows="3" maxlength="4000"
                      [(ngModel)]="question" placeholder="What is our company's refund policy?"></textarea>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="zap" [size]="16" class="text-accent" /> What the LLM answered
            </h2>
            <label class="label" for="av-answer">Answer</label>
            <textarea id="av-answer" class="field" rows="6" maxlength="8000"
                      [(ngModel)]="answer" placeholder="Customers can request a refund within 60 days of purchase."></textarea>
          </div>

          <div class="card card-pad">
            <h2 class="card-title-icon mb-4">
              <app-icon name="database" [size]="16" class="text-accent" /> Source of truth (optional)
            </h2>
            <label class="label" for="av-source">Source / context</label>
            <textarea id="av-source" class="field" rows="5" maxlength="16000"
                      [(ngModel)]="source"
                      placeholder="Customers can request a refund within 30 days of purchase."></textarea>
            <p class="mt-1 text-xs text-faint">
              Leave empty and the report will honestly mark every claim as unverifiable —
              without a source, no answer can be certified as factually correct.
            </p>
          </div>

          <div class="card card-pad">
            <label class="label" for="av-provider">Extraction model (optional)</label>
            <select id="av-provider" class="field" [(ngModel)]="providerHint">
              <option *ngFor="let p of providerHints" [value]="p.id">{{ p.label }}</option>
            </select>
            <p class="mt-1 text-xs text-faint">
              Requires the matching key configured on the API server. Leave untouched to use its default.
            </p>

            <button type="button" class="btn-primary mt-4 w-full"
                    [disabled]="loading() || !canValidate" (click)="validate()">
              <app-icon [name]="loading() ? 'loader' : 'shield'" [size]="16" />
              {{ loading() ? 'Validating…' : 'Validate answer' }}
            </button>
          </div>

          <div class="callout-warning">
            <strong>Server-assisted tool.</strong> Your question, answer and source are sent to
            the TokIQ validation API, which calls a claim-extraction LLM and TypeSafe's Jev for
            claim verdicts. They are not stored.
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4 xl:col-span-3">

          <!-- Loading -->
          <div *ngIf="loading()" class="card card-pad text-center">
            <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent"
                 role="status" aria-label="Validating"></div>
            <p class="text-sm text-muted">Extracting claims and asking Jev for verdicts…</p>
            <p class="mt-1 text-xs text-faint">Typically 5–20 seconds, depending on the extraction model.</p>
          </div>

          <!-- Error -->
          <div *ngIf="error() as err" class="callout-warning space-y-2">
            <p class="font-semibold">
              {{ err.kind === 'unreachable' ? 'API server not reachable' : 'Validation failed' }}
            </p>
            <p class="text-sm">{{ err.detail }}</p>
            <button type="button" class="btn-secondary" (click)="validate()">Try again</button>
          </div>

          <!-- Report -->
          <ng-container *ngIf="report as r">

            <div class="card card-pad">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 class="card-title-icon">
                  <app-icon name="shield" [size]="16" class="text-accent" /> Validation report
                </h2>
                <span class="badge" [ngClass]="statusClass(r.status)">
                  <app-icon [name]="statusIcon(r.status)" [size]="13" />
                  {{ statusLabel(r.status) }}
                </span>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div class="stat-accent">
                  <div class="stat-label">Answer relevance</div>
                  <div class="stat-value stat-value-accent">{{ r.relevance.percent }}%</div>
                  <div class="mt-1 text-xs text-faint">{{ r.relevance.level }}</div>
                </div>
                <div class="stat-accent">
                  <div class="stat-label">Groundedness</div>
                  <div class="stat-value"
                       [class.text-warning]="!r.groundedness.na && (r.groundedness.percent ?? 0) < 80"
                       [class.text-danger]="!r.groundedness.na && (r.groundedness.percent ?? 0) < 50">
                    {{ r.groundedness.na ? 'N/A' : (r.groundedness.percent === null ? '—' : r.groundedness.percent + '%') }}
                  </div>
                  <div class="mt-1 text-xs text-faint">
                    {{ r.groundedness.na ? 'No source provided' : r.groundedness.supported + ' of ' + (r.groundedness.total - r.groundedness.unverifiable) + ' decidable claims supported' }}
                  </div>
                </div>
                <div class="stat-accent">
                  <div class="stat-label">Unsupported claims</div>
                  <div class="stat-value"
                       [class.text-danger]="r.groundedness.contradicted > 0"
                       [class.text-warning]="r.groundedness.contradicted === 0 && (r.groundedness.unsupported > 0)">
                    {{ r.groundedness.unsupported + r.groundedness.contradicted }}
                  </div>
                  <div class="mt-1 text-xs text-faint">
                    {{ r.groundedness.contradicted }} contradicted · {{ r.groundedness.unverifiable }} unverifiable
                  </div>
                </div>
              </div>

              <p *ngIf="r.groundedness.na" class="callout-warning mt-4">
                No source of truth was provided, so no claim is marked supported — this report
                judges relevance only and cannot certify factual correctness.
              </p>
              <p *ngIf="r.meta.duration_ms != null" class="mt-3 text-xs text-faint">
                Evaluated in {{ r.meta.duration_ms }} ms · extraction: {{ r.meta.extraction_model }} ·
                verdicts: {{ r.meta.jev_model }}
              </p>
            </div>

            <!-- Claim cards -->
            <div *ngFor="let c of r.claims" class="card card-pad">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <p class="max-w-xl text-sm leading-relaxed text-fg">“{{ c.text }}”</p>
                <span class="badge" [ngClass]="verdictClass(c.verdict)">
                  <app-icon [name]="verdictIcon(c.verdict)" [size]="13" />
                  {{ verdictLabel(c.verdict) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                <span>Claim type: {{ c.type }}</span>
                <span>Jev confidence: {{ (c.confidence * 100).toFixed(0) }}%</span>
              </div>
              <div *ngIf="c.evidence_quote" class="math-block mt-3">
                <span class="text-faint">Source says:</span> “{{ c.evidence_quote }}”
              </div>
              <p *ngIf="c.evidence_quote && !c.evidence_in_source"
                 class="mt-2 text-xs text-warning">
                Note: this quote could not be re-verified against your source.
              </p>
            </div>

            <p *ngIf="r.claims.length === 0" class="prose-muted">
              No checkable factual claims were found in the answer.
            </p>
          </ng-container>

          <!-- Empty state -->
          <div *ngIf="!report && !loading() && !error()" class="card card-pad">
            <div class="text-center">
              <span class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <app-icon name="shield" [size]="22" />
              </span>
              <h3 class="font-semibold text-fg">Nothing validated yet</h3>
              <p class="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                Enter a question and the LLM's answer — plus a source if you have one — then
                press “Validate answer”.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class AnswerValidatorComponent implements OnInit {
  private meta = inject(MetaService);
  private api = inject(ValidatorApiService);

  question = '';
  answer = '';
  source = '';
  providerHint = '';
  providerHints = PROVIDER_HINTS;

  loading = signal(false);
  error = signal<ValidatorApiError | null>(null);
  report: ValidationReport | null = null;

  ngOnInit() {
    this.meta.setRouteMeta('/tools/answer-validator');
  }

  get canValidate(): boolean {
    return this.question.trim().length > 0 && this.answer.trim().length > 0;
  }

  validate(): void {
    if (!this.canValidate || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.report = null;

    this.api
      .validate({
        question: this.question.trim(),
        answer: this.answer.trim(),
        source: this.source.trim() || null,
        provider_hint: (this.providerHint || null) as ProviderName | null,
      })
      .subscribe({
        next: (report) => {
          this.report = report;
          this.loading.set(false);
        },
        error: (err: ValidatorApiError) => {
          this.error.set(err);
          this.loading.set(false);
        },
      });
  }

  statusClass(status: ValidationReport['status']): string {
    switch (status) {
      case 'pass':
        return 'border-positive/30 bg-positive/10 text-positive';
      case 'warning':
        return 'border-warning/30 bg-warning/10 text-warning';
      case 'fail':
        return 'border-danger/30 bg-danger/10 text-danger';
    }
  }

  statusIcon(status: ValidationReport['status']): string {
    switch (status) {
      case 'pass': return 'check-circle';
      case 'warning': return 'alert-triangle';
      case 'fail': return 'x-circle';
    }
  }

  statusLabel(status: ValidationReport['status']): string {
    switch (status) {
      case 'pass': return 'Validation passed';
      case 'warning': return 'Validation warning';
      case 'fail': return 'Validation failed';
    }
  }

  verdictClass(verdict: Verdict): string {
    switch (verdict) {
      case 'SUPPORTED':
        return 'border-positive/30 bg-positive/10 text-positive';
      case 'UNSUPPORTED':
        return 'border-warning/30 bg-warning/10 text-warning';
      case 'CONTRADICTED':
        return 'border-danger/30 bg-danger/10 text-danger';
      case 'UNABLE_TO_VERIFY':
        return 'border-border bg-surface-2 text-muted';
    }
  }

  verdictIcon(verdict: Verdict): string {
    switch (verdict) {
      case 'SUPPORTED': return 'check-circle';
      case 'UNSUPPORTED': return 'alert-triangle';
      case 'CONTRADICTED': return 'x-circle';
      case 'UNABLE_TO_VERIFY': return 'help-circle';
    }
  }

  verdictLabel(verdict: Verdict): string {
    switch (verdict) {
      case 'SUPPORTED': return 'Supported';
      case 'UNSUPPORTED': return 'Not supported';
      case 'CONTRADICTED': return 'Contradicts source';
      case 'UNABLE_TO_VERIFY': return 'Unable to verify';
    }
  }
}