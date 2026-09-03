import { Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Inline Lucide (https://lucide.dev) icons — no CDN, no icon font.
 * Only the icons the app actually uses are bundled here. Add more by
 * copying the inner markup of the SVG from lucide.dev.
 * All paths assume a 24×24 viewBox with round caps/joins.
 *
 * Stroke defaults to 1.5 rather than Lucide's 2: against the flat black
 * system a lighter stroke reads as precise instead of heavy. Rounded
 * rect corners (`rx`) are stripped to match the zero-radius UI.
 */
const ICONS: Record<string, string> = {
  coins:
    '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  'bar-chart':
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  window:
    '<rect width="7" height="18" x="3" y="3"/><rect width="7" height="7" x="14" y="3"/><rect width="7" height="7" x="14" y="14"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  sigma:
    '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a.5.5 0 0 1 0 .8l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
  check:
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  menu:
    '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x:
    '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'chevron-right':
    '<path d="m9 18 6-6-6-6"/>',
  'arrow-right':
    '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left':
    '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'book-open':
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  'external-link':
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
  lock:
    '<rect width="18" height="11" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'alert-triangle':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  scissors:
    '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  'file-text':
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  zap:
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  lightbulb:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  'rotate-ccw':
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  eraser:
    '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  'trending-down':
    '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="inline-block shrink-0 align-[-0.125em]"
      aria-hidden="true"
      [innerHTML]="markup"
    ></svg>
  `,
})
export class IconComponent implements OnChanges {
  @Input({ required: true }) name!: string;
  @Input() size: number | string = 18;
  @Input() strokeWidth: number | string = 1.5;

  markup: SafeHtml = '';
  private readonly sanitizer = inject(DomSanitizer);

  ngOnChanges(): void {
    const raw = ICONS[this.name];
    if (!raw && this.name) {
      console.warn(`[app-icon] unknown icon "${this.name}"`);
    }
    this.markup = this.sanitizer.bypassSecurityTrustHtml(raw ?? '');
  }
}
