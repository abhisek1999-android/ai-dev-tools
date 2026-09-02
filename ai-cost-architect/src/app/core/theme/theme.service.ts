import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.readInitial());

  /** Current theme as a readonly signal. */
  readonly theme = this._theme.asReadonly();

  constructor() {
    // Keep in sync with the OS setting *only* while the user hasn't chosen explicitly.
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) this.apply(e.matches ? 'dark' : 'light', false);
      });
    } catch {
      /* matchMedia unavailable — ignore */
    }
    // Reconcile with whatever the anti-FOUC script in index.html already applied.
    this.apply(this._theme(), false);
  }

  toggle(): void {
    this.apply(this._theme() === 'dark' ? 'light' : 'dark', true);
  }

  set(theme: Theme): void {
    this.apply(theme, true);
  }

  private apply(theme: Theme, persist: boolean): void {
    this._theme.set(theme);
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage blocked — theme still applies for this session */
      }
    }
  }

  private readInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
