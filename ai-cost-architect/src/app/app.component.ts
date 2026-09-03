import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './core/layout/header.component';
import { FooterComponent } from './core/layout/footer.component';
import { ParticlesComponent } from './core/layout/particles.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ParticlesComponent],
  template: `
    <!-- Decorative field, fixed at z-0. Content stacks above it at z-10. -->
    <app-particles />

    <div class="relative z-10 flex min-h-screen flex-col">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
})
export class AppComponent {}
