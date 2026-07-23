# Claude 작업 시작 지시문

당신은 `C:\VibeCoding Claude\wanion`의 WANION UI·UX 1차 개선을 담당한다.

## 목표

WANION은 한국 WoW 길드·공격대·연합의 레이드 운영 플랫폼이다. 한길련/kgusystem의 강력한 운영 기능은 그대로 유지하고, 사용자가 처음 봐도 이해할 수 있는 현대적이고 세련된 프로페셔널 UI로 전환한다.

원하는 인상:

- AI가 만든 보라색 SaaS 템플릿처럼 보이지 않는다.
- 게임 팬사이트나 판타지 포털처럼 보이지 않는다.
- 정보가 많아도 정돈된 운영 도구처럼 보인다.
- 차갑기만 한 B2B 콘솔이 아니라 사람과 공동체의 온도가 있다.
- 장식보다 정확한 정보 위계와 동작이 먼저다.

## 작업 전 필수 읽기

- `new design/README.md`
- `new design/00_START_HERE/DECISIONS.md`
- `new design/01_PRODUCT_CONTEXT/source-of-truth.md`
- `new design/01_PRODUCT_CONTEXT/REFERENCE_SNAPSHOT.md`
- `new design/01_PRODUCT_CONTEXT/product-and-nonnegotiables.md`
- `new design/01_PRODUCT_CONTEXT/current-state-gap-matrix.md`
- `new design/02_DESIGN_SYSTEM/design-system.md`
- `new design/02_DESIGN_SYSTEM/originality-boundary.md`
- `new design/03_SCREEN_SPECS/screen-map.md`
- `new design/04_SAMPLE_DATA/sample-data.json`
- `new design/05_REFERENCE_MOCKUPS/REFERENCE_GUIDE.md`
- `new design/06_BRAND_CHARACTERS/ASSET_GUIDE.md`
- `new design/07_CLAUDE_IMPLEMENTATION/implementation-brief.md`
- `new design/07_CLAUDE_IMPLEMENTATION/route-file-map.md`
- `new design/08_QA/acceptance-checklist.md`
- 기존 공식 기능 사양: `docs/WANION_기획안_v3.md`, `docs/WANION_P1_사양서.md`

## 금지

- 기능 삭제, 데이터 스키마 임의 변경, Firebase 규칙 변경
- 시너지·스왑·대기·벤치·시뮬레이션·초대 브릿지의 축소
- 모든 것을 둥근 카드 안에 넣는 Bento UI 남용
- 보라 그라디언트, 과한 글로우, 유리 패널, 신경망·회로·별자리
- 공식 WoW 로고·진영·클래스 문양을 연상시키는 독자 제작 심벌
- RallyPoint의 구조·색·문구를 그대로 복제
- WANI·NION 외의 동물 캐릭터 사용
- 캐릭터를 모든 빈 공간에 장식처럼 반복 배치

## 1차 구현 범위

1. 공통 디자인 토큰과 UI 원자
2. 글로벌 헤더·모바일 내비게이션
3. 파티 찾기: 보드/달력 전환, 주간 스트립, 필터, 복수 파티
4. 레이드 상세: 핵심 정보, 신청 상태, 로스터, 대기·벤치, 시너지, 운영 도구
5. 마이페이지: 내 일정 중심 2패널
6. 랜딩: 제품 가치와 현재 모집 공고 진입

길드·공격대·게시판·공략·관리자 화면은 같은 시스템으로 확장하되 1차 핵심 화면 완료 뒤 진행한다.

## 작업 방식

- 현재 동작을 먼저 확인하고 기존 기능의 체크리스트를 만든다.
- 구조 변경 전에 각 화면의 정보 우선순위를 문서화한다.
- 작은 화면부터 레이아웃 붕괴 여부를 확인한다.
- 샘플 데이터의 정상·마감·대기·충돌·복수 파티 상태를 모두 렌더링한다.
- 완료 후 변경 파일, 유지한 기능, 검증 명령, 미완료 항목을 보고한다.

## 대표 문장

> 레이드는 달과 같다. 모집으로 차오르고, 명단이 완성되면 만월에 닿고, 출발과 기록을 지나 기운 뒤 다음 주기에 다시 시작한다.

달은 장식이 아니라 모집→구성→확정→출발→기록을 나타내는 상태 인덱스로만 사용한다.
