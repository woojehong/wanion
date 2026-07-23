# WANION P1-7 — 한길련(kgusystem) 입주 마이그레이션 가이드

> **⚠ 상태: 보류 (260723 대표님 결정 — 완전 새출발)**
> 한길련 데이터는 이관하지 않고 전원 BNet 재가입으로 새출발한다.
> 직책은 관리자 콘솔 → 조직·멤버십 탭에서 수동 임명, kgusystem은 읽기전용 아카이브로 유지.
> 아래 절차는 마음이 바뀔 경우를 위한 백업 플랜으로만 보존한다. (병합 브릿지 함수는 코드에서 제거됨 — git 이력 3f38d39 참조)

> 작성: 2026-07-23 · 대상: 대표님 (로컬 1회 실행) · 도구: `scripts/migrate/`

## 무엇이 어디로 가는가

| kgusystem (wowkorea) | → 와니온 (raidkorea-f34c9) | 비고 |
|---|---|---|
| `guilds/*` | `guilds/*` (merge) | **길드 ID 동일 체계** — 시드 보존 병합, 로고·색·순서 이관 |
| `users/*` | `legacyUsers/*` | 닉네임·캐릭터·역할 보존 + `suggestedMembership` (마스터→master, admin→officer, 일반→member). **P2 병합 브릿지가 claim 시 실제 memberships 부여** |
| `nicknames/*` | `legacyNicknames/*` | 구 인증 식별자 포함 — rules로 클라이언트 접근 전면 차단 |
| `raids/*` (+apps·memos·cancels·logs) | `raids/*` | `partyType: union/없음`→연합(kwgu), 길드id→해당 길드 host. `counts` 재계산, 역할 `healer`→`heal` 정규화, `acceptMode:'auto'` |
| `posts/*` (+comments) | `posts/*` | 전체 게시판(global 스코프)으로. 카테고리 id 동일(notice/free/recruit). `legacyAuthor:true` — 병합 전까지 본인 수정 불가 |

이관하지 않는 것: `authlinks`(구 인증 전용), `gamedata`(와니온 시드가 최신), `cardChannels`·`raidMeta`(P2에서 디코 재설정 시 재생성).

## 실행 순서 (약 15분)

### 0. 사전 조건
- [ ] 와니온 `firebase deploy --only firestore:rules,firestore:indexes` 완료 (legacy 컬렉션 잠금 포함)
- [ ] 와니온 `/admin` → 부트스트랩 + **시드 실행** 완료 (guilds 문서가 있어야 merge가 의미 있음)

### 1. 서비스 계정 키 2개 발급
1. [Firebase 콘솔](https://console.firebase.google.com) → **wowkorea(구)** 프로젝트 → ⚙설정 → 서비스 계정 → **새 비공개 키 생성** → `scripts/migrate/sa-source.json` 으로 저장
2. **raidkorea-f34c9(신)** 프로젝트 → 동일 → `scripts/migrate/sa-target.json`
- 두 파일은 `.gitignore`에 걸려 있어 커밋되지 않지만, **작업 종료 후 즉시 삭제**하세요.

### 2. 실행
```bash
cd "C:\VibeCoding Claude\wanion\scripts\migrate"
npm install                     # firebase-admin 설치 (1회)
npm test                        # 변환 로직 자체 검증 (통과 확인)
node migrate.mjs export         # 구 프로젝트 → out/source.json 덤프
node migrate.mjs transform      # 변환 + 리포트 출력 (경고 확인!)
node migrate.mjs import         # 드라이런 — 기록될 문서 수 확인
node migrate.mjs import --apply # 실제 기록
node migrate.mjs verify         # 문서 수 대조 → [검증 통과] 확인
```

### 3. 실행 후 확인 체크리스트
- [ ] 와니온 `/board` 지난 탭(관리자 콘솔 → 레이드 → 지난)에 구 레이드가 보인다
- [ ] `/community` 게시판에 구 공지·자유·구인 글이 작성자 닉네임과 함께 보인다
- [ ] `/guild/gyochaero` 등 길드 페이지에 로고·색이 이관돼 있다
- [ ] 관리자 콘솔 → 조직·멤버십: 아직 비어 있는 게 정상 (claim 전) — 급하면 수동 임명 가능
- [ ] `sa-source.json` / `sa-target.json` 삭제

## 설계 노트 (수진)
- **왜 legacyUsers인가**: 구 시스템은 닉네임+PIN(내부 이메일) 인증이라 신규 Google/BNet uid와 매칭 불가. 판정표에서 PIN 로그인은 폐기, "소셜+병합 브릿지로 대체" 확정 — 그 브릿지(P2)가 소비할 대기 데이터가 legacyUsers다. claim 흐름: 신규 로그인 → 닉네임+PIN 검증(Functions가 구 프로젝트 인증에 대조) → `claimedBy` 기록 → `suggestedMembership` 대로 memberships 자동 부여 + 과거 글/신청의 legacy id를 새 uid로 연결.
- **재실행 안전**: export/transform은 몇 번이든 안전. import --apply는 동일 id에 덮어쓰기(idempotent)라 중단 후 재실행해도 중복이 생기지 않는다.
- **counts 재계산**: 구 시스템은 counts 비정규화가 없었으므로 apps(active)에서 산출 — 이관 순간이 곧 정합성 기준점.
- **verify는 ≥ 판정**: 대상 프로젝트에 신규 데이터가 이미 있을 수 있어 "기대 이상이면 통과"로 본다.
