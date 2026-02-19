/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdecd6',
          200: '#fad6ac',
          300: '#f7b977',
          400: '#f39140',
          500: '#f0731d',
          600: '#e15913',
          700: '#ba4312',
          800: '#943616',
          900: '#782f15',
          950: '#411509',
        },
      },
    },
  },
  plugins: [],
};
