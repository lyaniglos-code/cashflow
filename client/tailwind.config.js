/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark charcoal scale
        charcoal: {
          950: '#0b0c0f',
          900: '#0f1115',
          850: '#13161b',
          800: '#181b21',
          700: '#1f232b',
          600: '#272c36',
          500: '#333a47',
        },
        // Electric teal accent
        teal: {
          DEFAULT: '#14E0C6',
          bright: '#2ff4da',
          soft: '#7defdc',
          dim: '#0fb8a3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(20,224,198,0.25), 0 8px 30px -8px rgba(20,224,198,0.25)',
      },
    },
  },
  plugins: [],
};
