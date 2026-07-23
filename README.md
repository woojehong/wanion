# WANION — Wanion

한국 와우의 레이드 운영 플랫폼. 길드·공격대·연합의 일정과 로스터를 한곳에서.
**Made by 후제공방** · 도메인(예정): wanion.site

## 이 초안(v0.1)의 범위

- 목데이터 기반으로 전 페이지가 실제 동작하는 프론트엔드 프로토타입
- WANION 디자인 시스템(후제 바이올렛 `#8A70FF` + 블랙, Tailwind 토큰) 적용
- 페이지: 랜딩(`/`) · 파티 찾기 보드(`/board`, 주최/난이도/역할빈자리 필터 동작) · 레이드 상세(`/raid/:id`) · 길드 프로필(`/guild/:id`) · 공대 프로필(`/team/:id`) · 마이페이지(`/me`, 포인트 지갑)
- AI 생성 아트가 들어갈 자리는 `ArtSlot` 컴포넌트(점선 규격 라벨)로 표시

## 실행

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드 (검증 완료)
```

## 구조

```
src/
  lib/mock.js        # 목데이터 — Firebase 이식 시 Firestore 스키마의 기준
  components/ui.jsx  # 디자인 시스템 원자 (SlotSquares, Segments, ArtSlot, ...)
  components/Header.jsx
  pages/             # Landing / Board / RaidDetail / Guild / Team / My
```

## 다음 단계 (기획안 v2 로드맵 기준)

1. kgusystem 엔진(신청 로직·시뮬레이터·디코봇) 이식 — 시스템은 한길련 방식 계승
2. Firebase 연결 + memberships 권한 모델
3. Google/Discord/BNet/WCL 연동, 포인트 지급 자동화(픽스 → 종료 → 지급)
