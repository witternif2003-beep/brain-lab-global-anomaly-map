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
          dark: '#16121e',       // Deep obsidian violet core
          deep: '#231d2e',       // Deep faceted night shadow
          violet: '#3a2e4c',     // Rich deep crystal amethyst
          amethyst: '#624d77',   // Mid amethyst facet
          lavender: '#9f94ba',   // Prismatic crystal lavender
          pink: '#d66ea5',       // Radiant crystal pink / magenta facet
          rose: '#b3797c',       // Soft jewel rose reflection
          cyan: '#5ecbe6',       // Electric cyan refraction beam
          aqua: '#7ef0dc',       // Spectral aqua sparkle
          gold: '#ffd269',       // Starburst gold sparkle
          amber: '#dfac97',      // Warm crystal amber flare
          light: '#f5effa',      // Brilliant diamond white/lilac highlight
        },
        brand: {
          navy: '#1e1828',       // Faceted crystal deep midnight
          gold: '#ffd269',       // Starburst prismatic diamond gold
          red: '#d66ea5',        // Faceted crystal radiant magenta/pink
          silver: '#9f94ba',     // Radiant crystal lavender-silver
          dark: '#120e18',       // Crystal void black
          card: '#231d2e',       // Jewel facet card background
        }
      }
    },
  },
  plugins: [],
}
