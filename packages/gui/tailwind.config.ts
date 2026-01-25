import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/client/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // n8n-inspired color palette
        primary: {
          DEFAULT: '#ff6d5a',
          light: '#ff8a7a',
          dark: '#e55a48',
          50: '#fff5f3',
          100: '#ffe6e2',
          200: '#ffd0c9',
          300: '#ffb0a4',
          400: '#ff8a7a',
          500: '#ff6d5a',
          600: '#e55a48',
          700: '#c44a3b',
          800: '#a03d31',
          900: '#7d3128',
        },
        canvas: {
          bg: '#1a1a2e',
          'bg-light': '#f5f5f7',
        },
        panel: {
          bg: '#232340',
          'bg-light': '#ffffff',
        },
        node: {
          bg: '#2d2d4a',
          'bg-light': '#ffffff',
          border: '#3d3d5c',
          'border-light': '#e5e5e5',
        },
        // Status colors
        success: '#5cb85c',
        warning: '#f0ad4e',
        error: '#d9534f',
        info: '#5bc0de',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        node: '0 4px 12px rgba(0, 0, 0, 0.3)',
        'node-light': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'node-hover': '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        pulse: 'pulse 1.5s ease-in-out infinite',
        'flow-edge': 'flowEdge 1s linear infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        flowEdge: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
