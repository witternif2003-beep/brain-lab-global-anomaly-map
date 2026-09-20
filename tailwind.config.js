/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        crystal: {
          base: '#2a2236',       // Lighter, luminous amethyst slate base (no pitch black)
          surface: '#332a42',    // Lighter elevated card surface
          card: '#3b304d',       // Complementary jewel facet card
          border: '#54446d',     // Luminous facet border
          light: '#f5effa',      // Clean diamond light
          lavender: '#baaed3',   // Soft crystal lavender
          pink: '#e580b5',       // Radiant crystal magenta
          rose: '#c68d90',       // Soft jewel rose
          cyan: '#62d3ee',       // Electric aqua refraction
          aqua: '#88f4e2',       // Spectral sparkle
          gold: '#ffd87a',       // Starburst gold sparkle
          amber: '#e5bca8',      // Warm crystal amber
        },
        brand: {
          navy: '#2d243a',
          gold: '#ffd87a',
          red: '#e580b5',
          silver: '#baaed3',
          dark: '#241c2f',
          card: '#332a42',
        }
      }
    },
  },
  plugins: [],
}
