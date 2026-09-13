/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        severity: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#f97316',
          critical: '#ef4444',
        },
        status: {
          open: '#3b82f6',
          triaged: '#8b5cf6',
          mitigating: '#f59e0b',
          fixed: '#22c55e',
          closed: '#6b7280',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
