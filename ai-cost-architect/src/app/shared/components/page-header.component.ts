import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

/**
 * Unified page header for every calculator: breadcrumb -> title -> subtitle -> badges.
 * Keeps the six tool pages visually identical above the fold.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <header class="mb-8">
      <nav class="breadcrumb mb-2" aria-label="Breadcrumb">
        <span>Tools</span>
        <app-icon name="chevron-right" [size]="12" />
        <span class="text-muted">{{ title }}</span>
      </nav>

      <h1 class="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-fg">{{ title }}</h1>
      <p *ngIf="subtitle" class="mt-1.5 max-w-2xl text-muted">{{ subtitle }}</p>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span class="badge-positive">
          <app-icon name="lock" [size]="13" />
          Runs in your browser
        </span>
        <span *ngIf="pricingVersion" class="badge-neutral">
          Pricing {{ pricingVersion }}
        </span>
        <ng-content select="[extra-badges]" />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() pricingVersion = '';
}
