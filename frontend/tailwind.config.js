/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // BTC Mining theme colors (existing)
        btc: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Primary orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Surfaces
        canvas: 'var(--bg)',
        elevated: 'var(--bg-elevated)',
        subtle: 'var(--bg-subtle)',

        // Ink
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },

        // Hairlines
        hairline: 'var(--hairline)',
        'hairline-strong': 'var(--border-strong)',

        // Semantic
        pos: 'var(--pos)',
        'pos-soft': 'var(--pos-soft)',
        neg: 'var(--neg)',
        'neg-soft': 'var(--neg-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        info: 'var(--info)',
        'info-soft': 'var(--info-soft)',

        // Categorical (mining SOTP)
        'cat-hpc': 'var(--cat-hpc)',
        'cat-pipeline': 'var(--cat-pipeline)',
        'cat-mining': 'var(--cat-mining)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        xs: 'var(--sh-xs)',
        card: 'var(--sh-sm)',
        pop: 'var(--sh-pop)',
        md: 'var(--sh-md)',
        lg: 'var(--sh-lg)',
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
