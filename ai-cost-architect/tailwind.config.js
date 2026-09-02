/** @type {import('tailwindcss').Config} */

// Semantic color tokens. Every value resolves to a CSS variable holding
// space-separated RGB channels, so `/<alpha-value>` (e.g. bg-accent/10) works.
// Light values live in :root, dark values in .dark — see src/styles.css.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg:            token('--c-bg'),
        surface:       token('--c-surface'),
        'surface-2':   token('--c-surface-2'),

        // Lines
        border:        token('--c-border'),
        'border-strong': token('--c-border-strong'),

        // Text
        fg:            token('--c-fg'),
        muted:         token('--c-muted'),
        faint:         token('--c-faint'),

        // Accent (indigo)
        accent:               token('--c-accent'),
        'accent-hover':       token('--c-accent-hover'),
        'accent-solid':       token('--c-accent-solid'),
        'accent-solid-hover': token('--c-accent-solid-hover'),

        // Status
        positive:  token('--c-positive'),
        warning:   token('--c-warning'),
        danger:    token('--c-danger'),

        // Kept for backward-compat with any un-migrated markup
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(2 6 23 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(2 6 23 / 0.06), 0 1px 2px -1px rgb(2 6 23 / 0.06)',
        md: '0 4px 12px -2px rgb(2 6 23 / 0.08)',
      },
    },
  },
  plugins: [],
}
