/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Primary: #78BE20 vibrant green accent ── */
        primary: {
          50:  '#f4fbe8',
          100: '#e6f6cc',
          200: '#ceee9a',
          300: '#b2e164',
          400: '#96d43a',
          500: '#78BE20',
          600: '#60a010',
          700: '#4d800d',
          800: '#3d6510',
          900: '#2d4c12',
          950: '#172a08',
        },
        /* ── Secondary: #024E38 deep forest green ── */
        secondary: {
          50:  '#edfaf4',
          100: '#d2f3e4',
          200: '#a8e6cc',
          300: '#70d3ad',
          400: '#3bba8c',
          500: '#1f9e73',
          600: '#0f7f5c',
          700: '#0a664a',
          800: '#024E38',
          900: '#023d2c',
          950: '#012218',
        },
        /* ── Neutral: OKLCH-derived, whisper of green warmth ── */
        neutral: {
          50:  '#f8faf8',
          100: '#f1f3f1',
          200: '#e3e6e3',
          300: '#cdd1cd',
          400: '#a3a8a3',
          500: '#7c827c',
          600: '#5e645e',
          700: '#474d47',
          800: '#2e332e',
          900: '#1c211c',
          950: '#0e120e',
        },
        /* ── Semantic role tokens (alpha-capable CSS vars) ── */
        background:        'rgb(var(--color-background) / <alpha-value>)',
        surface:           'rgb(var(--color-surface) / <alpha-value>)',
        'surface-raised':  'rgb(var(--color-surface-raised) / <alpha-value>)',
        foreground:        'rgb(var(--color-foreground) / <alpha-value>)',
        'foreground-muted':'rgb(var(--color-foreground-muted) / <alpha-value>)',
        border:            'rgb(var(--color-border) / <alpha-value>)',
        ring:              'rgb(var(--color-ring) / <alpha-value>)',
        /* ── Status: desaturated, quiet ── */
        success: {
          DEFAULT: '#3d8b40',
          light:   '#f0faf0',
        },
        warning: {
          DEFAULT: '#b5850a',
          light:   '#fefce8',
        },
        error: {
          DEFAULT: '#c53030',
          light:   '#fef2f2',
        },
        info: {
          DEFAULT: '#2b6cb0',
          light:   '#eff6ff',
        },
      },
      fontFamily: {
        sans: ['Public Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      /* ── Modular type scale ~1.25 ratio ── */
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.875rem' }],
        '2xl':['1.563rem', { lineHeight: '2rem' }],
        '3xl':['1.953rem', { lineHeight: '2.375rem' }],
        '4xl':['2.441rem', { lineHeight: '2.75rem' }],
      },
      borderRadius: {
        sm:      '4px',
        DEFAULT: '6px',
        md:      '8px',
        lg:      '12px',
      },
      spacing: {
        0.5: '2px',
        1:   '4px',
        1.5: '6px',
        2:   '8px',
        2.5: '10px',
        3:   '12px',
        3.5: '14px',
        4:   '16px',
        5:   '20px',
        6:   '24px',
        7:   '28px',
        8:   '32px',
        9:   '36px',
        10:  '40px',
        11:  '44px',
        12:  '48px',
        14:  '56px',
        16:  '64px',
        20:  '80px',
        24:  '96px',
      },
      /* ── Shadows: overlays only (minimalist = flat) ── */
      boxShadow: {
        sm:      '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        DEFAULT: '0 2px 6px -1px rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
        lg:      '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        none:    'none',
      },
      /* ── Motion: functional, quick ── */
      transitionDuration: {
        fast:    '120ms',
        DEFAULT: '150ms',
        slow:    '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
