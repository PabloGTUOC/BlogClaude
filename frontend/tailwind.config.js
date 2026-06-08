/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        gridColor: 'var(--grid)',
        phosphor: 'var(--phosphor)',
        amber: 'var(--amber)',
        'neon-red': 'var(--neon-red)',
        dust: 'var(--dust)',
        fog: 'var(--fog)',
        chrome: 'var(--chrome)',
        white: 'var(--white)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        label: ['var(--font-label)'],
        body: ['var(--font-body)'],
        ui: ['var(--font-ui)'],
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
      }
    },
  },
  plugins: [],
}
