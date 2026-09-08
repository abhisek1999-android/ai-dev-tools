import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './core/layout/header.component';
import { FooterComponent } from './core/layout/footer.component';
import { ParticlesComponent } from './core/layout/particles.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent, ParticlesComponent],
  template: `
    <!-- Decorative field, fixed at z-0. Content stacks above it at z-10.
         Suppressed on /blog: the drifting dots sit behind long-form text
         and were reported as distracting while reading an article. -->
    <app-particles *ngIf="!isReadingRoute" />

    <div class="relative z-10 flex min-h-screen flex-col">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
})
export class AppComponent {
  private readonly router = inject(Router);

  // Computed from the live URL (not just router.url) so a direct deep link
  // into /blog/:slug never flashes the particle field before it resolves.
  isReadingRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/blog');

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isReadingRoute = e.urlAfterRedirects.startsWith('/blog');
      });
  }
}
