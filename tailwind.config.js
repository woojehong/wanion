/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // REKO brand tokens — 후제 바이올렛 시스템
        ink: '#09090D',
        surface: '#101018',
        surface2: '#14141F',
        line: '#1E1E2E',
        violet: {
          DEFAULT: '#8A70FF',
          hi: '#B9A8FF',
          deep: '#5B45E0',
        },
        txt: '#EDEDF2',
        sub: '#8B8B9E',
        mute: '#5C5C6E',
        tank: '#60A5FA',
        heal: '#4ADE80',
        dps: '#F87171',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};
