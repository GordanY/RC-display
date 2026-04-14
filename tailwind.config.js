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
          'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
