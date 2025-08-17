const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nl: {
          bg: "#000117",        // Nightlife background
          secondary: "#6B3FA0", // Secondary
          accent: "#F60800",    // CTA / buttons
          card: "#D9D9D934",    // light card with ~20% opacity
        },
      },
      fontFamily: {
        // Quicksand globally (ensure it’s loaded in _app or layout)
        sans: ["Quicksand", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
