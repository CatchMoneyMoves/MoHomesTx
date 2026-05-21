/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fafaf7',
        ink: '#0a0a0f',
        gold: {
          DEFAULT: '#d4af37',
          dark: '#b8860b',
          soft: '#fefce8',
        },
        line: '#e7e5e0',
        muted: '#57534e',
        subtle: '#a8a29e',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"Inter Tight"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
