import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon.component';

interface NavLink { label: string; path: string; icon: string; }

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header class="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div class="container-page">
        <div class="flex h-14 items-center justify-between gap-4">

          <!-- Wordmark — no lockup mark; the type carries the brand. -->
          <a routerLink="/"
             class="shrink-0 text-[15px] font-semibold tracking-tight text-fg
                    transition-opacity hover:opacity-70">
            TokIQ
          </a>

          <!-- Desktop nav — underline marks the active route -->
          <nav class="hidden items-center gap-6 lg:flex">
            <a *ngFor="let link of navLinks"
               [routerLink]="link.path"
               routerLinkActive="!text-fg !border-accent"
               class="whitespace-nowrap border-b border-transparent py-1 text-[11px]
                      font-medium uppercase tracking-[0.1em] text-faint
                      transition-colors hover:text-fg">
              {{ link.label }}
            </a>
          </nav>

          <!-- Mobile menu button -->
          <button type="button" (click)="toggleMenu()"
                  class="btn-ghost !px-2 !py-2 lg:hidden"
                  [attr.aria-expanded]="menuOpen()"
                  aria-label="Toggle navigation menu">
            <app-icon [name]="menuOpen() ? 'x' : 'menu'" [size]="18" />
          </button>
        </div>

        <!-- Mobile menu -->
        <div *ngIf="menuOpen()" class="border-t border-border py-2 lg:hidden">
          <a *ngFor="let link of navLinks"
             [routerLink]="link.path"
             (click)="menuOpen.set(false)"
             routerLinkActive="!text-fg !bg-surface-2"
             class="flex items-center gap-3 px-3 py-2.5 text-[11px] font-medium
                    uppercase tracking-[0.1em] text-faint transition-colors
                    hover:bg-surface-2 hover:text-fg">
            <app-icon [name]="link.icon" [size]="15" />
            {{ link.label }}
          </a>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  menuOpen = signal(false);

  navLinks: NavLink[] = [
    { label: 'Token Counter',   path: '/tools/token-calculator',            icon: 'sigma' },
    { label: 'LLM Cost',        path: '/tools/llm-cost-calculator',         icon: 'coins' },
    { label: 'Compare Models',  path: '/tools/model-comparison',            icon: 'bar-chart' },
    { label: 'Context Window',  path: '/tools/context-window-calculator',   icon: 'window' },
    { label: 'RAG Cost',        path: '/tools/rag-cost-calculator',         icon: 'search' },
    { label: 'Blog',            path: '/blog',                              icon: 'book-open' },
  ];

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }
}
