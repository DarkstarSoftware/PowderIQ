/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── PowderIQ Brand Palette (from brand kit) ──────────────────────────
        alpine: {
          950: '#0A0F1E',   // darkest navy — page background
          900: '#0F162E',   // deep navy — brand primary dark
          800: '#152040',   // navy
          700: '#1A2A52',   // mid navy
          600: '#1F36FE',   // signal blue — primary CTA / brand blue
          500: '#2F4AFF',
          400: '#4F66FF',
          300: '#24FAFF',   // ice cyan — accent / glow
          200: '#DFF5FF',   // ice blue — light text / subtle bg
          100: '#EEF8FF',   // snow white — lightest
        },
        powder: {
          DEFAULT: '#DFF5FF',   // Powder Blue
          dark:    '#C0E8FF',
        },
        ice: {
          DEFAULT: '#24FAFF',   // Ice Cyan accent
          dim:     '#18B8BC',
        },
        signal: {
          DEFAULT: '#1F36FE',   // Signal Blue CTA
          dark:    '#1628CC',
        },
        snow: '#F0F8FF',

        // Legacy brand alias (keep existing code working)
        brand: {
          50:  '#EEF8FF',
          100: '#DFF5FF',
          200: '#C0E8FF',
          300: '#24FAFF',
          400: '#4F66FF',
          500: '#2F4AFF',
          600: '#1F36FE',
          700: '#1628CC',
          800: '#1A2A52',
          900: '#0F162E',
          950: '#0A0F1E',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'], // brand uses Inter throughout
      },
      backgroundImage: {
        'brand-gradient':    'linear-gradient(135deg, #0F162E 0%, #1F36FE 60%, #24FAFF 100%)',
        'brand-gradient-v':  'linear-gradient(180deg, #0F162E 0%, #1A2A52 100%)',
        'glow-ice':          'radial-gradient(ellipse at center, rgba(36,250,255,0.15) 0%, transparent 70%)',
        'glow-signal':       'radial-gradient(ellipse at center, rgba(31,54,254,0.25) 0%, transparent 70%)',
        'mountain-hero':     'linear-gradient(180deg, rgba(10,15,30,0) 0%, rgba(10,15,30,0.7) 60%, #0A0F1E 100%)',
      },
      boxShadow: {
        'ice':    '0 0 24px rgba(36,250,255,0.25), 0 4px 16px rgba(0,0,0,0.4)',
        'signal': '0 0 32px rgba(31,54,254,0.4),  0 4px 20px rgba(0,0,0,0.5)',
        'card':   '0 4px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset',
        'glow':   '0 0 60px rgba(36,250,255,0.12)',
      },
      animation: {
        'float':        'float 6s ease-in-out infinite',
        'pulse-slow':   'pulse 4s ease-in-out infinite',
        'shimmer':      'shimmer 2.5s linear infinite',
        'snow-fall':    'snowFall 8s linear infinite',
        'fade-up':      'fadeUp 0.6s ease-out forwards',
        'fade-in':      'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        float:    { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        snowFall: { '0%': { transform: 'translateY(-20px)', opacity: '0' }, '10%': { opacity: '1' }, '90%': { opacity: '0.6' }, '100%': { transform: 'translateY(100vh)', opacity: '0' } },
        fadeUp:   { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
