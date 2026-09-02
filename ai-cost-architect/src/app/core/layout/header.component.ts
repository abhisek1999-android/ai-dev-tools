import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/components/icon.component';
import { ThemeService } from '../theme/theme.service';

interface NavLink { label: string; path: string; icon: string; }

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header class="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
      <div class="container-page">
        <div class="flex h-14 items-center justify-between gap-4">

          <!-- Logo -->
          <a routerLink="/" class="group flex shrink-0 items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-solid text-white">
              <app-icon name="calculator" [size]="16" />
            </span>
            <span class="font-semibold tracking-tight text-fg transition-colors group-hover:text-accent">
              AI Cost Architect
            </span>
          </a>

          <!-- Desktop nav -->
          <nav class="hidden items-center gap-0.5 lg:flex">
            <a *ngFor="let link of navLinks"
               [routerLink]="link.path"
               routerLinkActive="!text-accent !bg-accent/10"
               class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors
                      hover:bg-surface-2 hover:text-fg whitespace-nowrap">
              {{ link.label }}
            </a>
          </nav>

          <div class="flex items-center gap-1">
            <!-- Theme toggle -->
            <button type="button"
                    (click)="theme.toggle()"
                    class="btn-ghost !px-2 !py-2"
                    [attr.aria-label]="isDark() ? 'Switch to light theme' : 'Switch to dark theme'">
              <app-icon [name]="isDark() ? 'sun' : 'moon'" [size]="18" />
            </button>

            <!-- Mobile menu button -->
            <button type="button" (click)="toggleMenu()"
                    class="btn-ghost !px-2 !py-2 lg:hidden"
                    [attr.aria-expanded]="menuOpen()"
                    aria-label="Toggle navigation menu">
              <app-icon [name]="menuOpen() ? 'x' : 'menu'" [size]="18" />
            </button>
          </div>
        </div>

        <!-- Mobile menu -->
        <div *ngIf="menuOpen()" class="border-t border-border py-2 lg:hidden">
          <a *ngFor="let link of navLinks"
             [routerLink]="link.path"
             (click)="menuOpen.set(false)"
             routerLinkActive="text-accent bg-accent/10"
             class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted
                    transition-colors hover:bg-surface-2 hover:text-fg">
            <app-icon [name]="link.icon" [size]="16" />
            {{ link.label }}
          </a>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly theme = inject(ThemeService);
  menuOpen = signal(false);

  isDark = () => this.theme.theme() === 'dark';

  navLinks: NavLink[] = [
    { label: 'Token Counter',   path: '/tools/token-calculator',            icon: 'sigma' },
    { label: 'LLM Cost',        path: '/tools/llm-cost-calculator',         icon: 'coins' },
    { label: 'Compare Models',  path: '/tools/model-comparison',            icon: 'bar-chart' },
    { label: 'Context Window',  path: '/tools/context-window-calculator',   icon: 'window' },
    { label: 'RAG Cost',        path: '/tools/rag-cost-calculator',         icon: 'search' },
  ];

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }
}
