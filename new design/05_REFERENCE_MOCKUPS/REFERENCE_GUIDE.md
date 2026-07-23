# 기존 목업 사용 가이드

이 폴더의 HTML은 방향 탐색 자료다. 그대로 복제하거나 모든 아이디어를 합치지 않는다.

## 채택

### `wanion-c-split-ops.html`

- 데스크톱 앱 셸
- 목록과 상세의 2패널 구조
- 내 일정과 운영 화면의 기준

### `wanion-b-global-board.html`

- 모집 목록의 정보 밀도
- 역할 빈자리와 필터의 빠른 스캔
- 파티 찾기 화면의 기준

### `wanion-e-bento-hud.html`

- 마이페이지 상단의 작은 요약 카드만 제한 채택
- 전체 화면을 벤토로 만들지 않는다.

### `wanion-d-showcase.html`

- 비로그인 랜딩의 마케팅 위계만 참고
- 앱 내부 운영 화면에는 사용하지 않는다.

## 보류 또는 폐기

### `wanion-a-nexus-console.html`

- 과도한 콘솔·피드·사이드바 구조는 폐기
- 검색·라이브 피드·AI 키아트가 실제 기능보다 앞서지 않게 한다.

### `wanion-page-guild.html`, `wanion-page-team.html`, `wanion-page-my.html`

- 정보 항목의 존재 여부만 참고
- 레이아웃과 컴포넌트는 새 시스템으로 재구성

## 파일별 강한 경고

- `wanion-d-showcase.html`: 공허·포털·AI ART 슬롯은 채택 금지. 마케팅 정보 위계만 참고.
- `wanion-e-bento-hud.html`: AI ART 배너와 전체 벤토화 금지. 요약 수치 카드만 참고.
- `wanion-a-nexus-console.html`: 콘솔·라이브 피드·과밀 사이드바 채택 금지.
- 모든 구형 목업의 `Made by 후제공방`은 이전 표기다. 새 디자인의 확정 표기는 `RUN BY STUDIO HOOJE`.
- 목업에 WANI/NION 외 캐릭터가 있더라도 사용하지 않는다. 이 패키지의 목업 HTML에는 캐릭터 자산을 활성 참고로 포함하지 않는다.

## 사용 원칙

- 목업의 가짜 기능을 실제 기능처럼 구현하지 않는다.
- lorem ipsum, AI ART 슬롯, 임시 검색·피드를 남기지 않는다.
- 현재 React 페이지의 실제 데이터와 권한을 우선한다.
