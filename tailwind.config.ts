import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        cream: 'var(--cream)',
        'cream-deep': 'var(--cream-deep)',
        'cream-card': 'var(--cream-card)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-quiet': 'var(--ink-quiet)',
        sepia: 'var(--sepia)',
        'sepia-mid': 'var(--sepia-mid)',
        burgundy: 'var(--burgundy)',
        'burgundy-light': 'var(--burgundy-light)',
        rule: 'var(--rule)',
        'rule-soft': 'var(--rule-soft)',
        score: 'var(--score)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(60,40,20,0.12), 0 4px 16px rgba(60,40,20,0.06)',
        'card-hover': '0 2px 6px rgba(60,40,20,0.18), 0 8px 28px rgba(60,40,20,0.10)',
        inset: 'inset 0 1px 3px rgba(60,40,20,0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
