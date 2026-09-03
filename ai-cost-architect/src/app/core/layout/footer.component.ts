import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PRICING_VERSION } from '../../lib/pricing/pricing.data';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <footer class="mt-16 border-t border-border bg-surface">
      <div class="container-page py-10">
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">

          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-fg">TokIQ</h3>
            </div>
            <p class="prose-muted mt-3">
              Free AI cost calculators for developers. Estimate, compare and optimize
              the real cost of running AI applications.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="badge-positive">
                <app-icon name="lock" [size]="13" />
                Browser-only
              </span>
              <span class="badge-neutral">Pricing verified {{ pricingVersion }}</span>
            </div>
          </div>

          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-faint">Calculators</h3>
            <ul class="mt-3 space-y-2">
              <li *ngFor="let link of toolLinks">
                <a [routerLink]="link.path"
                   class="text-sm text-muted transition-colors hover:text-accent">
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-faint">Pricing note</h3>
            <p class="prose-muted mt-3">
              AI pricing changes frequently. All prices are manually verified against
              official provider documentation. Always check provider pricing pages
              before making production decisions.
            </p>
          </div>

        </div>

        <div class="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p class="text-xs text-faint">
            © {{ year }} TokIQ. No warranty on pricing accuracy — verify before use.
          </p>
          <p class="text-xs text-faint">Built for developers, by developers.</p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  pricingVersion = PRICING_VERSION;
  year = new Date().getFullYear();

  toolLinks = [
    { label: 'Token Counter',         path: '/tools/token-calculator' },
    { label: 'LLM Cost Calculator',   path: '/tools/llm-cost-calculator' },
    { label: 'Model Comparison',      path: '/tools/model-comparison' },
    { label: 'Context Window',        path: '/tools/context-window-calculator' },
    { label: 'RAG Cost Calculator',   path: '/tools/rag-cost-calculator' },
  ];
}
