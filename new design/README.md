# WANION New Design — Claude 1차 구현 인계 패키지

이 폴더는 WANION의 기존 기능과 데이터 구조를 유지하면서 UI·UX·브랜딩을 새로 정리하기 위한 독립 작업 패키지다.

## 절대 규칙

1. 기존 한길련/kgusystem에서 계승한 운영 로직은 삭제·축소·단순화하지 않는다.
2. 이번 작업의 대상은 레이아웃, 정보 위계, 컴포넌트, 타이포그래피, 상호작용과 브랜드 표현이다.
3. 기존 코드에 반영하기 전 이 폴더의 문서와 샘플을 기준으로 별도 브랜치 또는 명시된 파일 범위에서 작업한다.
4. 캐릭터는 `WANI`와 `NION` 두 개만 사용한다. 포즈 시트 속 여러 그림은 동일 캐릭터의 탐색 포즈이며 추가 캐릭터가 아니다.
5. 보라 그라디언트, 과한 글로우, 유리 질감, 포털·별자리·회로·육각형 같은 전형적인 AI SaaS 시각 문법을 사용하지 않는다.
6. RallyPoint의 발견성·필터·일정 가독성은 참고하되 레이아웃, 카피, 시각 표현을 복제하지 않는다.
7. `RUN BY STUDIO HOOJE`는 WANION보다 작고 조용한 운영 주체 표기로 사용한다.

## 읽는 순서

1. `00_START_HERE/CLAUDE_START_HERE.md`
2. `00_START_HERE/DECISIONS.md`
3. `01_PRODUCT_CONTEXT/source-of-truth.md`
4. `01_PRODUCT_CONTEXT/REFERENCE_SNAPSHOT.md`
5. `01_PRODUCT_CONTEXT/product-and-nonnegotiables.md`
6. `01_PRODUCT_CONTEXT/current-state-gap-matrix.md`
7. `02_DESIGN_SYSTEM/design-system.md`
8. `02_DESIGN_SYSTEM/originality-boundary.md`
9. `03_SCREEN_SPECS/screen-map.md`
10. `04_SAMPLE_DATA/sample-data.json`
11. `05_REFERENCE_MOCKUPS/REFERENCE_GUIDE.md`
12. `06_BRAND_CHARACTERS/ASSET_GUIDE.md`
13. `07_CLAUDE_IMPLEMENTATION/implementation-brief.md`
14. `07_CLAUDE_IMPLEMENTATION/route-file-map.md`
15. `08_QA/acceptance-checklist.md`

## 폴더 구성

- `00_START_HERE`: Claude에게 그대로 전달할 시작 지시문
- `01_PRODUCT_CONTEXT`: 제품 방향과 유지해야 할 한길련 핵심 자산
- `02_DESIGN_SYSTEM`: 색상·폰트·버튼·카드·상태·캐릭터 규칙
- `03_SCREEN_SPECS`: 화면별 레이아웃과 동작
- `04_SAMPLE_DATA`: UI 구현용 샘플 데이터와 상태 시나리오
- `05_REFERENCE_MOCKUPS`: 기존 탐색 목업. 복제 대상이 아니라 비교 자료
- `06_BRAND_CHARACTERS`: WANI·NION 활성 이미지와 포즈 아카이브
- `07_CLAUDE_IMPLEMENTATION`: 구현 순서·파일 범위·완료 보고 형식
- `08_QA`: 수용 기준과 검수표

## 현재 성격

이 패키지는 디자인·구현 인계 문서다. 프로덕션 배포 승인, 상표 안전 확인, 외부 공개 승인을 의미하지 않는다.
