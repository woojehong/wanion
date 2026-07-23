# WANION 인게임 애드온 — 기술 검증 & 기능 제안

> 작성: 2026-07-22 · 수진 · 상태: 검증 v1 (P4 착수 전 기준 문서)
> 원칙: 서버 통신 없는 "코드 문자열 복붙" 브릿지(wowaudit 방식) — 정책상 가장 안전한 형태. 보호 함수 미사용.

---

## 1. 검증 결과 요약

| 기능 | 판정 | 근거 |
|---|---|---|
| 로스터 임포트 (웹→코드 복붙) | ✅ 가능 | 에딧박스 붙여넣기 + 문자열 파싱. wowaudit·MRT 노트 등 검증된 패턴 |
| 원클릭 일괄 파티/공대 초대 | ✅ 가능 | `C_PartyInfo.InviteUnit("이름-서버")` — 비보호 함수, 애드온 자유 호출. 크로스렐름 OK |
| 귓말 키워드 자동초대 | ✅ 가능 | `CHAT_MSG_WHISPER` 이벤트 → InviteUnit. AutoInvite 계열이 수년간 사용 |
| 멤버측 초대 자동수락 | ✅ 가능 | `PARTY_INVITE_REQUEST` → `AcceptGroup()` + 팝업 숨김. 양쪽 애드온 설치 시 딸깍 0회 |
| 출석 스냅샷 export | ✅ 가능 | `GetRaidRosterInfo()` 순회 → 문자열 생성 → 웹에 복붙 |
| 파티 배치 자동 적용 | ✅ 가능 | `SetRaidSubgroup`/`SwapRaidSubgroup` — 공대장 권한으로 애드온 호출 가능 (정렬 애드온들이 사용) |
| **달력 이벤트 생성** | ✅ 가능 (조건: 유저 클릭) | `C_Calendar.AddEvent`는 **하드웨어 이벤트 필수**(키/마우스 입력 직후에만 호출 가능) — 공식 위키 명시. 즉 "버튼 클릭으로 생성"은 되고, 완전 무인 백그라운드 생성은 불가. 우리 UX([달력 생성] 버튼)와 정확히 호환. 체험계정 불가 |
| **달력 초대 (복붙 명단)** | ✅ 가능 (조건: 순차 큐) | `C_Calendar.EventInvite("이름-서버")` — 위키 기준 "AllowedWhenUntainted"(비오염 경로에서 애드온 호출 허용). 초대는 1건씩, 이전 액션 완료 후에만(`CALENDAR_ACTION_PENDING` 이벤트 + `C_Calendar.CanSendInvite()` 확인 필수). 실증: 길드원 일괄 달력초대 애드온 다수 실존(Easy Calendar Invit 9.2.5, LOIHCal, CalendarExtras, Group Calendar). 자동수락도 AIA 애드온으로 실증 |
| 미접속자 실시간 초대 | ❌ 불가 | 접속자만 파티 초대 가능 → 오프라인은 달력 초대로 커버 (그래서 둘 다 필요) |
| 클라 미실행 자동화 | ❌ 불가 | 봇 행위 — 약관 위반이자 기술적 불가 |
| 무애드온 자동수락 | ❌ 불가 | 상대 클라이언트에 코드가 있어야 함 |

## 2. 인게임 검증 플랜 (P4 첫날, 30분)

웹 검색으로 API 명세·실존 애드온까지 확인 완료(하단 출처). 다만 **검증된 달력 애드온들의 마지막 업데이트가 2020~2022년(8.x~9.2.5)**이라, 한밤(12.x)에서 동일하게 동작하는지 최종 확인만 남음. 실계정에서 순서대로:

```
1) /script C_Calendar.OpenCalendar()
2) 테스트 버튼(하드웨어 이벤트) 클릭 핸들러 안에서:
   C_Calendar.CreateEvent()
   C_Calendar.EventSetTitle("WANION TEST")
   C_Calendar.EventSetType(1)  -- 레이드
   C_Calendar.EventSetTime(20, 0)
   C_Calendar.AddEvent()       -- ★ 반드시 클릭 직후 실행 (하드웨어 이벤트 요구)
3) 생성된 이벤트 열고, 큐 규칙 준수하며:
   if C_Calendar.CanSendInvite() then C_Calendar.EventInvite("부캐이름-아즈샤라") end
   -- CALENDAR_ACTION_PENDING 이벤트를 기다렸다가 다음 초대 발사
```
- 각 단계에서 "차단된 동작(ADDON_ACTION_BLOCKED)" 에러가 뜨는지 기록
- 3)을 5회 연속(큐 대기 포함) → 실제 처리 간격 측정 (20명 초대 소요시간 산정)
- 결과에 따라: 전부 통과 → 달력 기능 정식 채택 / EventInvite만 막힘 → 이벤트 생성+수동초대 반자동 / 전부 막힘 → 파티 초대·귓말 초대로만 운영 (플랜B로도 핵심 가치 유지)
- 구현 시 주의: 오염(taint) 회피를 위해 달력 관련 호출은 전부 **우리 애드온 자체 버튼의 클릭 핸들러**에서 직접 실행 (블리자드 달력 UI 함수 후킹 금지)

## 3. 와니온 애드온 v1 — 명령·기능 설계

### 슬래시 명령
```
/wanion              메인 창 열기 (임포트/초대/내보내기 탭)
/wanion invite       임포트된 명단 일괄 초대 시작 (진행바 + 실패 목록)
/wanion recall       미응답자만 재초대
/wanion sort         시뮬레이터 파티 배치 적용 (그룹 자동 재정렬)
/wanion snap         현재 공대 스냅샷 → 출석 코드 생성 (복사창)
/wanion cal          달력 이벤트 생성+초대 (검증 통과 시)
/wanion auto on|off  귓말 자동초대 토글 (키워드: "와니온" 또는 설정값)
```

### 기능 제안 7 (레이드 인원관리 편의)

1. **일괄 초대 + 리포트** — 초대 결과를 색으로: 수락(초록)/대기(노랑)/오프라인(회색)/다른진영·불가(빨강). 실패자만 [재시도]
2. **파티 배치 자동 적용** ★ — 웹 시뮬레이터에서 짠 1~4파티 배치를 코드에 포함 → `/wanion sort` 한 번에 인게임 공대 그룹이 그 배치로 재정렬. 시뮬레이터가 리모컨이 됨
3. **출석 스냅샷 → 픽스 대조** ★ — 출발 직후 `/wanion snap` → 코드 복사 → 웹 붙여넣기 → 픽스 명단과 자동 대조(출석 확정·노쇼 후보 자동 표시). 포인트 지급의 증거 데이터
4. **소집 귓말 브로드캐스트** — 픽스 명단 중 공대 밖 인원에게 일괄 귓속말 "와니온: 공대 출발합니다. 귓말 '와니온' 주시면 초대돼요"
5. **명단 diff 패널** — 임포트 명단 vs 현재 공대 실시간 비교: 아직 안 온 사람 / 명단에 없는 난입 인원 하이라이트
6. **벤치 호출** — 결원 발생 시 벤치 명단 순서대로 원클릭 귓말+초대
7. **역할 검증** — 임포트 명단의 역할(탱2힐4딜14)과 실제 공대 구성 불일치 경고 (탱이 3명 들어옴 등)

### 데이터 브릿지 포맷 (안)
```
WANION1;raidId;fix|r1:두부킴-아즈샤라:T:1,강철이빨-아즈샤라:T:1,빛나래-아즈샤라:H:2,...;chk=a1b2
   버전/일정ID/모드 ; 이름-서버:역할:파티번호 목록 ; 체크섬
```
- 웹 → 게임: 위 코드 (초대·배치·달력용) / 게임 → 웹: `WANIONSNAP1;...` (출석 스냅샷)
- 서버 통신 없음 = 정책 안전 + 오프라인 동작

## 4. 검증 출처 (260722 웹 검색)

- C_Calendar.EventInvite 명세 — AllowedWhenUntainted, 액션 큐(CALENDAR_ACTION_PENDING/CanSendInvite): warcraft.wiki.gg / wowpedia "API C_Calendar.EventInvite"
- C_Calendar.AddEvent 명세 — **하드웨어 이벤트 필수**, 체험계정 불가: warcraft.wiki.gg "API C_Calendar.AddEvent"
- C_PartyInfo.InviteUnit — 위키에 보호/제한 태그 없음(자유 호출), 8.2.5에서 네임스페이스 이동: warcraft.wiki.gg
- 일괄 달력초대 실존 애드온: Easy Calendar Invit(CurseForge, ~9.2.5), LOIHCal(CurseForge), CalendarExtras(WowAce), Group Calendar(legacy), Raid Inviter/EnhancedCalendar(WowAce)
- 달력초대 자동수락 실존: AIA Calendar Manager(CurseForge, 8.0.1~9.0.1) + github.com/Caedilla/AIA
- 이벤트당 초대 100명 제한 논의: WoWInterface 포럼 "Guild calendar mass invites > 100"

## 5. 관련 자산

- SADRT 프로젝트의 12.x 애드온 노하우 (한국어 UI, 콘텐츠 비종속 구조) 재사용
- NSRT 분석에서 확보한 후킹 패턴 (미니맵 버튼 = LDB+LDBIcon)
- 한밤 secret value 제약은 전투 데이터에만 해당 — 초대·달력·로스터 API와 무관 (별도 검증 완료)
