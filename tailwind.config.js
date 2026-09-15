/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#0B0D0B', // fundo do sidebar / preto do logo
          900: '#12140F',
          800: '#1B1F17',
        },
        signal: {
          DEFAULT: '#2FCB3F', // verde do logo CoachPro
          dark: '#22A032',
          light: '#8CE79A',
        },
        chalk: {
          50: '#F7F8F6',
          100: '#EEF0EC',
          200: '#DDE1D8',
          400: '#8B9285',
          600: '#4B5245',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
