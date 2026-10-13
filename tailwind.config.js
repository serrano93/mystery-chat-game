/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        premium: '0 20px 70px -20px rgba(0,0,0,0.55)',
        bubble: '0 4px 14px rgba(0,0,0,0.10)'
      }
    }
  },
  plugins: []
};
