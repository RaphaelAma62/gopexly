import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        // Brand primary
        primary: {
          DEFAULT: '#1a6eff',
          light: '#eef4ff',
          border: '#bdd1ff',
          dark: '#0f4dd4',
        },
        // Gains (green)
        gain: {
          DEFAULT: '#16a34a',
          bg: '#dcfce7',
          border: '#86efac',
        },
        // Loss (red)
        loss: {
          DEFAULT: '#dc2626',
          bg: '#fee2e2',
          border: '#fca5a5',
        },
        // Amber / warning
        amber: {
          DEFAULT: '#d97706',
          bg: '#fef3c7',
        },
        // Purple
        purple: {
          DEFAULT: '#7c3aed',
          bg: '#ede9fe',
        },
        // Surfaces
        surface: '#ffffff',
        background: '#f0f4f9',
        border: '#e2e8f0',
        // Text
        text: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        // Admin sidebar
        admin: {
          DEFAULT: '#1e1b4b',
          light: '#eef2ff',
        },
        // Grays
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          700: '#334155',
          900: '#0f172a',
        },
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.06)',
        md: '0 4px 16px rgba(0,0,0,0.08)',
        lg: '0 8px 32px rgba(0,0,0,0.1)',
      },
      animation: {
        'spin-slow': 'spin 0.6s linear infinite',
        'loadbar': 'loadbar 1.4s ease-in-out infinite',
        'slide-up': 'slideUp 0.25s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        loadbar: {
          '0%': { width: '0%', marginLeft: '0%' },
          '50%': { width: '60%', marginLeft: '20%' },
          '100%': { width: '0%', marginLeft: '100%' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
