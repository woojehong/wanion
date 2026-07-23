# 와니온(WANION) — 다음 세션 시작 프롬프트

> 아래 내용을 새 세션 첫 메시지로 붙여넣으면 됩니다. (메모리의 unified-platform.md와 함께 읽힘)

---

수진, 와니온 개발 이어서 하자. 메모리(unified-platform.md)와 이 문서를 먼저 읽고 시작해.

## 현재 상태 (2026-07-23 세션 종료 기준)

**전부 코드 완료 + 대부분 배포·실증됨.** 폴더 `C:\VibeCoding Claude\wanion`, 기준 문서 `docs/WANION_P1_사양서.md`(v1.3).

- ✅ **P1 전체**: 엔진(트랜잭션 정원판정·구독다이어트), 공략게시판, 통합게시판(스코프 3층×관리형 카테고리), 길드·공대 실데이터, 관리자 콘솔 4탭, 핵심자산 5종(시너지·스왑·벤치·시뮬레이터·초대코드 — getCaps/healer 표기 치명버그 2건 픽스 포함)
- ✅ **P2 진행분**: 일일 출석 +10P(onDailyCheckin), **BNet 연동 풀스택**(만렙 캐릭 전원 자동등록·대표캐릭 강제선택·신청 하드게이트·1배넷=1계정 — **대표님 실기기 검증 완료**), MyPage 실데이터화, **길드 가입/공대 지원 플로우**(orgApplications 공용 엔진, BNet 게이트 rules 강제, 마스터/공대장 승인·관리 탭, 멤버십 권한 위임)
- ❌ **한길련 마이그레이션은 폐기 결정**(완전 새출발) — scripts/migrate는 백업 보존, 병합 브릿지 코드는 제거됨
- ⏸ **보류(대표님 지시)**: 레이드 출석 포인트(+100P·주3회캡)·공대장 보너스·공략 마일스톤

## 세션 시작 시 확인할 것

1. 마지막 커밋들(`222087b`, `1d27e0f` 공대지원+orgApplications)이 **push + `firebase deploy --only firestore:rules`** 됐는지 대표님께 확인 — 안 됐으면 그것부터
2. `/admin` 시드 실행 여부 (부트스트랩→시드)
3. 대표님이 관리자 콘솔에서 각 길드 마스터 임명했는지 (가입 승인의 전제)

## 남은 작업 (우선순위 순)

### 1. 디코봇 (P2 마지막 큰 조각)
- 설계 문서: `docs/WANION_디코봇_설계_세팅.md`. Discord App ID `1529664610838511779`(공개), 시크릿 2종(`DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`) `functions:secrets:set` 필요 — 대표님께 요청
- 범위: 레이드 생성 시 카드 채널 발행(kgu cardChannels 계승), 슬래시 명령(/일정 등), 포럼 자동생성(유지 확정 항목), Interactions 엔드포인트는 Functions onRequest로
- 앱 이름 "레코봇"→"와니온봇" 개명 권장 (대표님 작업)

### 2. 알림 센터
- 승격·강등·가입승인·픽스 알림을 notifications/{uid}/items로 통합 (사양 보완 9: 알림 센터로 통합, 쪽지·디코 DM 연동)
- 헤더에 벨 아이콘 + 미읽음 카운트(비정규화)

### 3. 레이드 생성 폼 고도화 (P1 잔여 디테일)
- RaidFormModal에 사양 v1.2 반영 점검: 손님파티 플래그, 수락모드(길드·연합=자동/글로벌=검토후, §7.4), allowedGuilds/waitGuilds/소분류 — 현재 구현 수준 확인 후 갭 보완
- 과거 레이드 복사→새 날짜(§7.6), 정규 로스터 원클릭 붙여넣기(§7.5 — teams.roster 편집 UI 포함)

### 4. 보류 해제 시: 포인트 자동화 완성
- 레이드 출석: 픽스+종료시각 경과→+100P, 주3회 캡(weeklyAttendance, 와우 리셋 목 기준) — Functions 스케줄러(0원 설계: 스케줄잡 3개 이내)
- 공대장 완주 +50P, 공략 마일스톤(순추천 10/30/50→100/200/300P, guides.rewardedMilestones), 공략 페널티(음수 글 3개↑→보상중지, §3.2)
- **수치는 전부 config/points 문서로** — 대표님 확정값 반영

### 5. P3 (별도 페이즈)
- BNet 상시검증(공개 길드 로스터 API — 길드 소속 캐릭 검증·전원탈퇴→제명제안), WCL 정공 리포트(§7.3 — 항목별 3단계 공개설정), 프로필 진도 갱신(§7.2 — KST 2시 + 수동버튼 10분 쿨다운 + 레이드 당일 저녁 스마트)
- 시즌 전환·계급 티어(수치 미정), 프로필카드 export, 상점

### 6. P4: 애드온 (/wanion invite·sort·snap)
- 웹 브릿지는 이미 완성(WANION1; 포맷 — 스왑 T+HD·손님 G·파티번호, `src/lib/bridge.js`가 명세). SADRT/NSRT 노하우 계승(메모리 참조)

### 잡무·기술부채
- firebase-functions v6→v7 업그레이드(breaking changes 검증 필요), functions의 BLIZZ_CLASSES 사본과 웹 constants 동기 유지
- 도메인 wanion.site 구매 시: 포털 3곳 redirect 추가 + Firebase 승인 도메인 + config.js origin + vite base + functions SITE_ORIGIN 교체
- TeamPage 로스터·프로그레스는 teams 문서 수동 입력 → WCL(P3)로 대체 예정

## 대표님 결정 대기 목록
- 포인트 수치 확정(현재 제안값: 일일10/출석100/공대장+50/마일스톤 100·200·300)
- 계급 티어 구간, 프로필카드 유료 요소(§7.2 후보: 배경·테두리·이펙트·칭호)
- 디코봇 시크릿 등록 + 봇 개명

## 작업 요령 (필수 숙지)
- **device git: `git status` 절대 금지** — FUSE가 unlink 불가라 index.lock/HEAD.lock이 남아 다음 커밋이 막힘. lock 발견 시 `mv .git/*.lock .git/_stale_locks/`. `git add -A && git -c user.name=hoojehong -c user.email=hwj.rouget@gmail.com commit -m "..."` 한 줄은 정상
- 빌드 검증: 컨테이너 ~/work/wanion 사본에서 `npx vite build` + `node --check functions/index.js` — **무결점 확인 후에만** device_commit_files로 로컬 반영
- device_commit_files가 mtime 가드로 거부하면: 이전에 내가 커밋한 파일인지 확인 후 force
- 큰 파일 Edit는 꼬리 잘림 주의 → python 전체쓰기 (메모리: large-html-edit-truncation)
- 코드에 '수진/수잔' 절대 금지, 매 패키지마다 커밋 + 메모리 갱신

첫 작업은 위 우선순위 1번(디코봇)부터. 시크릿이 준비 안 됐으면 코드 먼저 완성하고 배포만 대기시켜.
