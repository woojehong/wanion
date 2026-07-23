import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// WANION — 와니온 (한국 와우 레이드 운영 플랫폼)
// 임시 배포: https://woojehong.github.io/wanion/ (GitHub Pages 하위 경로라 base 필수)
// 커스텀 도메인 확정 시 base를 '/'로 변경
export default defineConfig({
  base: '/wanion/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
