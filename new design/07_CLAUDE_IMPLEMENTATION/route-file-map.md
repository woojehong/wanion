# Route / File / Responsibility Map

| 라우트 | 현재 파일 | 1차 목적 | 핵심 회귀 위험 |
|---|---|---|---|
| `/` | `LandingPage.jsx` | 제품 가치·모집 진입 | 마케팅 장식 과잉 |
| `/board` | `BoardPage.jsx`, `CalendarView.jsx` | 발견·필터·달력 | 필터·복수 일정 |
| `/raid/:raidId` | `RaidDetailPage.jsx` | 신청·로스터·운영 | 핵심 5자산 손실 |
| `/guild/:guildId` | `GuildPage.jsx` | 공개/소속/관리자 | 권한별 뷰 |
| `/team/:teamId` | `TeamPage.jsx` | 정규 로스터·WCL | 공개 범위 |
| `/me` | `MyPage.jsx` | 내 일정·연결·소속 | 일정 충돌·계정 상태 |
| `/guides` | `GuidesPage.jsx` | 검색 유입·BEST | 투표·범위 |
| `/community` | `CommunityPage.jsx` | 전통 게시판 | 카테고리·권한 |
| `/admin` | `AdminPage.jsx` | 운영 테이블 | 파괴적 작업 |

## 공통 컴포넌트 권고

- `AppShell`
- `MobileTabBar`
- `PageHeader`
- `RaidListItem`
- `RosterMeter`
- `WeeklyStrip`
- `PhaseIndex`
- `EmptyState`
- `ActionBanner`
- `StatusBadge`
- `FilterBar` / `FilterDrawer`

기존 컴포넌트를 교체할 때 데이터 처리 로직을 UI 컴포넌트 안으로 새로 복제하지 않는다.
