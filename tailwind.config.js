/** @type {import('tailwindcss').Config} */
// Colors are CSS variables (see src/index.css) so light/dark switch without touching components.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: v('cream'),       // page background
        white: v('card'),        // card / input surfaces (bg-white)
        alt: v('alt'),           // secondary panel surface
        ink: v('ink'),           // primary text
        panel: v('panel'),       // solid dark panels, buttons, active tabs
        onpanel: v('onpanel'),   // text on panel
        gold: {                  // brand accent (Magic blue) — names kept so components don't change
          DEFAULT: v('gold'),
          dark: v('gold-dark'),
          soft: v('gold-soft'),
        },
        line: v('line'),
        muted: v('muted'),
        subtle: v('subtle'),
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"Inter Tight"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
