# Source of Truth

Claude는 자료가 충돌할 때 아래 우선순위를 따른다.

1. 현재 대표님 확정사항: `00_START_HERE/DECISIONS.md`
2. 공식 P1 사양: `REFERENCE_WANION_P1_사양서.md`
3. 제품 기획: `REFERENCE_WANION_기획안_v3.md`
4. 실제 현재 코드의 동작
5. `new design`의 디자인·화면 사양
6. 기존 HTML 목업

## 충돌 처리

- 기능 사양과 목업이 충돌하면 기능 사양이 우선이다.
- 문서가 구현 완료라고 말해도 코드에서 확인되지 않으면 미확인으로 표시한다.
- `_to_delete`, RECO, REKO 문서는 기준으로 사용하지 않는다.
- 기존 `Made by 후제공방` 표기는 새 디자인에서 `RUN BY STUDIO HOOJE`로 교체 예정이지만, 전역 교체 전 사용 위치를 먼저 목록화한다.
- 캐릭터 관련 구 문서가 다른 동물을 제안하더라도 WANI/NION 두 캐릭터 확정이 우선이다.

## 현재 구현 파일

- 전역 스타일: `src/index.css`, `tailwind.config.js`
- UI 원자: `src/components/ui.jsx`
- 헤더: `src/components/Header.jsx`
- 파티 보드: `src/pages/BoardPage.jsx`
- 달력: `src/components/CalendarView.jsx`
- 레이드 상세: `src/pages/RaidDetailPage.jsx`
- 내 정보: `src/pages/MyPage.jsx`
- 랜딩: `src/pages/LandingPage.jsx`
- 길드/공격대: `src/pages/GuildPage.jsx`, `TeamPage.jsx`
- 게시판/공략: `CommunityPage.jsx`, `GuidesPage.jsx`
- 관리자: `AdminPage.jsx`, `src/pages/admin/**`

디자인 작업은 데이터 계약과 서버 로직을 임의로 변경하지 않는다.

## 사본 검증

`REFERENCE_SNAPSHOT.md`의 생성일과 SHA-256을 확인한다. 원본 `docs/WANION_기획안_v3.md`, `docs/WANION_P1_사양서.md`의 현재 해시가 다르면 사본을 기준으로 계속 진행하지 말고 차이와 영향 범위를 대표님에게 보고한다.
