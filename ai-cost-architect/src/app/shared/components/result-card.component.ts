import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ResultItem {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: string;
}

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card card-pad">
      <h3 *ngIf="title" class="card-title mb-4">{{ title }}</h3>
      <div class="grid gap-3"
           [class.grid-cols-2]="cols === 2"
           [class.sm:grid-cols-3]="cols === 3"
           [class.sm:grid-cols-4]="cols === 4">
        <div *ngFor="let item of items"
             [class.stat-accent]="item.highlight"
             [class.stat]="!item.highlight">
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value" [class.stat-value-accent]="item.highlight">{{ item.value }}</div>
          <div *ngIf="item.sub" class="mt-0.5 text-xs text-faint">{{ item.sub }}</div>
        </div>
      </div>
      <ng-content />
    </div>
  `,
})
export class ResultCardComponent {
  @Input() title = '';
  @Input() items: ResultItem[] = [];
  @Input() cols: 2 | 3 | 4 = 2;
}
