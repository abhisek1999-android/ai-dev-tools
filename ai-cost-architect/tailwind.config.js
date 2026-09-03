/** @type {import('tailwindcss').Config} */

// Semantic color tokens. Every value resolves to a CSS variable holding
// space-separated RGB channels, so `/<alpha-value>` (e.g. bg-accent/10) works.
// The system is dark-only and monochrome — see src/styles.css.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    // ------------------------------------------------------------------
    // Flat system: nothing is rounded, nothing casts a shadow.
    // These OVERRIDE (not extend) Tailwind's scales, so every existing
    // `rounded-lg` / `rounded-full` / `shadow-sm` in the templates
    // resolves to a no-op. Squareness cannot be broken by accident.
    // ------------------------------------------------------------------
    borderRadius: {
      none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0',
      xl: '0', '2xl': '0', '3xl': '0', full: '0',
    },
    boxShadow: {
      none: 'none', sm: 'none', DEFAULT: 'none', md: 'none',
      lg: 'none', xl: 'none', '2xl': 'none', inner: 'none',
    },
    extend: {
      colors: {
        // Surfaces
        bg:            token('--c-bg'),
        surface:       token('--c-surface'),
        'surface-2':   token('--c-surface-2'),
        'surface-3':   token('--c-surface-3'),

        // Lines
        border:          token('--c-border'),
        'border-strong': token('--c-border-strong'),

        // Text
        fg:    token('--c-fg'),
        muted: token('--c-muted'),
        faint: token('--c-faint'),

        // Accent — monochrome; white carries emphasis
        accent:               token('--c-accent'),
        'accent-hover':       token('--c-accent-hover'),
        'accent-solid':       token('--c-accent-solid'),
        'accent-solid-hover': token('--c-accent-solid-hover'),
        'on-accent':          token('--c-on-accent'),

        // Status — low-chroma, the only hue in the system
        positive: token('--c-positive'),
        warning:  token('--c-warning'),
        danger:   token('--c-danger'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
