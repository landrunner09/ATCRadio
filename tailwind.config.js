/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#06080F',
        surface: '#0B1020',
        surface2: '#0F1530',
        line: '#1C2548',
        accent: '#6FE3FF',
        warm: '#FFB85C',
        go: '#5BE3A1',
        danger: '#FF6B7A',
        muted: '#5A6B94',
        dim: '#8A9BC4',
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
}
