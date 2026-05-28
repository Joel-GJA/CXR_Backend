/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-blue':    '0 0 20px rgba(59,130,246,0.4)',
        'glow-blue-sm': '0 0 10px rgba(59,130,246,0.3)',
        'glow-blue-lg': '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2)',
        'glow-green':   '0 0 12px rgba(52,211,153,0.45)',
        'glow-red':     '0 0 12px rgba(248,113,113,0.45)',
        'glow-yellow':  '0 0 12px rgba(251,191,36,0.45)',
        'card':         '0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover':   '0 8px 32px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'glow-pulse':  'glowPulse 2.5s ease-in-out infinite',
        'fade-up':     'fadeUp 0.35s ease-out forwards',
        'slide-in':    'slideIn 0.3s ease-out forwards',
        'shimmer':     'shimmer 2.5s linear infinite',
        'ping-slow':   'ping 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'float':       'float 4s ease-in-out infinite',
        'meteor':      'meteor 5s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 5px rgba(59,130,246,0.3)' },
          '50%':     { boxShadow: '0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.35)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
      },
      backgroundImage: {
        'dot-grid':     'radial-gradient(rgba(59,130,246,0.07) 1px, transparent 1px)',
        'blue-radial':  'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.14) 0%, transparent 65%)',
        'card-shine':   'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)',
        'blue-shimmer': 'linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent)',
      },
      backgroundSize: {
        'dot-grid': '28px 28px',
      },
    },
  },
  plugins: [],
};
