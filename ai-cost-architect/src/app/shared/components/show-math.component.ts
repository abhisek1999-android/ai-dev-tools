import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

export interface MathStep {
  label: string;
  expression: string;
  result: number | string;
  unit?: string;
}

@Component({
  selector: 'app-show-math',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="mt-4" *ngIf="steps.length">
      <button type="button"
        (click)="toggleOpen()"
        class="group flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-accent"
        [attr.aria-expanded]="isOpen">
        <app-icon name="chevron-right" [size]="14"
          class="transition-transform duration-200" [class.rotate-90]="isOpen" />
        {{ isOpen ? 'Hide the math' : 'Show the math' }}
      </button>

      <div *ngIf="isOpen" class="math-block mt-2">
        <div *ngFor="let step of steps"
             class="flex items-start justify-between gap-4 border-b border-border py-1.5 last:border-0">
          <div class="min-w-0">
            <div class="text-[11px] uppercase tracking-wide text-faint">{{ step.label }}</div>
            <div class="mt-0.5 break-words text-muted">{{ step.expression }}</div>
          </div>
          <div class="shrink-0 text-right">
            <span class="font-semibold text-fg">{{ step.result }}</span>
            <span *ngIf="step.unit" class="ml-1 text-faint">{{ step.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ShowMathComponent {
  @Input() steps: MathStep[] = [];
  isOpen = false;

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }
}
