/** @type {import('tailwindcss').Config} */
// WANION 디자인 v2 (design/wanion-v2-claude) — RAID DESK + WANE INDEX
// 토큰은 02_DESIGN_SYSTEM/design-system.md 를 기준으로 정리.
// 기존 페이지 호환을 위해 surface/surface2/txt 등 예전 토큰명도 유지한다.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── 잉크 스케일 (배경/패널) ──
        ink: {
          DEFAULT: '#09090D', // = ink-950, 전체 배경
          950: '#09090D',
          900: '#111116', // 주요 패널
          850: '#17171D', // 상승 패널
        },
        surface: '#111116', // 하위호환: 주요 패널 (= ink-900)
        surface2: '#17171D', // 하위호환: 상승 패널 (= ink-850)
        line: '#292832', // 기본 경계
        paper: '#F7F4ED', // 캐릭터·편집형 밝은 면

        // ── 브랜드 바이올렛 ──
        violet: {
          DEFAULT: '#8A70FF', // 핵심 액션·활성
          hi: '#B9A8FF', // 활성 텍스트
          deep: '#5B45E0',
        },

        // ── 텍스트 ──
        txt: '#F1F0F5', // 제목
        sub: '#A09DA9', // 보조 본문
        mute: '#6E6B77', // 비활성

        // ── 역할색 (작은 슬롯·텍스트에만) ──
        tank: '#60A5FA',
        heal: '#4ADE80',
        dps: '#F87171',
        danger: '#F87171', // 파괴적 행동·오류
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        // Studio Hooje 마케팅 에디토리얼 (제한적 사용)
        editorial: ['Marcellus', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px', // 카드
        btn: '7px', // 버튼 6–8px
      },
      maxWidth: {
        content: '1280px', // 콘텐츠 최대 폭 1200–1280
      },
    },
  },
  plugins: [],
};
