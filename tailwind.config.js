/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#d4af37',
        'gold-dark': '#b8960f',
      },
      fontFamily: {
        sans: [
          '"Noto Sans HK"',
          '"PingFang TC"', '"Microsoft JhengHei"', '"Heiti TC"',
          'system-ui', '-apple-system', 'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
