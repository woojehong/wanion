# Claude 1차 구현 브리프

## 권고 구현 순서

### 0. 기준선 기록

- 현재 `npm run build` 결과 기록
- 라우트별 스크린샷
- 기존 기능 체크리스트
- 변경 전 Git 상태 기록

### 1. 토큰과 원자

대상:

- `tailwind.config.js`
- `src/index.css`
- `src/components/ui.jsx`

작업:

- 색상·간격·모서리·타입 토큰 정리
- Primary/Secondary/Tertiary/Destructive 버튼
- 입력, 칩, 상태, 테이블, 빈 상태
- SlotSquares와 월상 상태 인덱스

### 2. 내비게이션

대상:

- `src/components/Header.jsx`
- 필요 시 신규 모바일 내비게이션 컴포넌트

완료 기준:

- 360px에서 메뉴 겹침 없음
- 로그인/알림/프로필 상태 유지
- 관리자 메뉴 권한 유지

### 3. 파티 찾기와 달력

대상:

- `src/pages/BoardPage.jsx`
- `src/components/CalendarView.jsx`

완료 기준:

- 기존 필터 모두 작동
- 보드/달력 전환 유지
- 하루 여러 파티 처리
- 역할 빈자리와 대기 인원 가독성
- 정상/마감/손님/무소속/충돌 샘플 렌더링

### 4. 레이드 상세

대상:

- `src/pages/RaidDetailPage.jsx`
- `RosterEditor`, `SynergyBoard`, `GuestPanel`, `SimulatorModal`

완료 기준:

- 신청자/공대장 정보 위계 분리
- 시너지·스왑·벤치·대기·시뮬레이션 기능 손실 없음
- 모바일 핵심 CTA 접근 가능

### 5. 랜딩과 마이페이지

대상:

- `src/pages/LandingPage.jsx`
- `src/pages/MyPage.jsx`

완료 기준:

- 제품 가치가 판타지 이미지보다 앞선다.
- 내 일정 2패널과 충돌 상태
- WANI/NION 제한 사용

### 6. 나머지 페이지 확장

- Guild / Team / Guides / Community / Admin
- 동일 토큰과 컴포넌트 사용

## 변경하지 말아야 할 파일

디자인 작업만 하는 동안 아래는 원칙적으로 수정하지 않는다.

- `firestore.rules`
- `storage.rules`
- `functions/**`
- `scripts/migrate/**`
- `src/lib/db.js`의 데이터 계약
- 공식 문서의 확정 기능 사양

필요성이 생기면 구현 전에 이유와 영향 범위를 보고한다.

## 1차 수정 허용 목록

Claude 1차 디자인 베타는 아래 기존 파일만 수정할 수 있다.

- `tailwind.config.js`
- `src/index.css`
- `src/components/ui.jsx`
- `src/components/Header.jsx`
- `src/components/CalendarView.jsx`
- `src/components/RosterEditor.jsx`
- `src/components/SynergyBoard.jsx`
- `src/components/GuestPanel.jsx`
- `src/components/SimulatorModal.jsx`
- `src/pages/LandingPage.jsx`
- `src/pages/BoardPage.jsx`
- `src/pages/RaidDetailPage.jsx`
- `src/pages/MyPage.jsx`

신규 UI 파일은 아래에만 만들 수 있다.

- `src/components/design-v2/**`
- `src/pages/design-v2/**`

길드·공격대·공략·게시판·관리자 화면은 1차 핵심 화면 승인 뒤 별도 단계에서 수정한다. 허용 목록 밖의 기존 파일이 필요하면 먼저 파일명, 이유, 데이터·권한 영향, 롤백 방법을 보고하고 대표님 승인을 받는다.

## 작업 격리

- 권고 브랜치: `design/wanion-v2-claude`
- 기존 UI를 즉시 삭제하지 않는다.
- 기능 플래그 또는 병렬 컴포넌트로 비교 가능한 상태를 유지한다.
- `new design/**`는 인계 자료이므로 Claude가 덮어쓰지 않는다.

## 샘플 데이터 사용

`04_SAMPLE_DATA/sample-data.json`은 UI 상태 검증용이다. 운영 데이터로 업로드하지 않는다. 기존 mock shape에 맞게 어댑터를 두되 실제 스키마를 샘플에 맞춰 바꾸지 않는다.

## 완료 보고 형식

1. 변경한 파일
2. 유지한 핵심 기능
3. 새 디자인 원칙이 적용된 부분
4. 실행한 검증 명령과 결과
5. 확인하지 못한 부분
6. 대표님이 결정해야 할 항목

## 단계 라벨

Claude의 1차 결과는 `디자인 베타`다. 프로덕션 준비 완료로 표현하지 않는다. 다음 단계에서 Codex가 코드·접근성·반응형·기능 회귀를 재검수하고 정제한다.
