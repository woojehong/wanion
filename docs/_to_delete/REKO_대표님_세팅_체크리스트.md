# REKO 대표님 세팅 체크리스트

> 작성: 2026-07-22 · 수진
> **이 문서의 모든 항목은 대표님 계정으로 직접 하셔야 하는 것들입니다** (계정 생성·결제·비밀키 발급은 제가 대신할 수 없어요). 각 항목 끝의 `→ 수진에게`가 저에게 전달해주실 값입니다.
> 순서대로 하시면 됩니다. ★ = 지금 당장 해두면 좋은 것 (심사 대기시간 때문).

---

## 0. 도메인 ★

- [ ] 가비아 / Cloudflare Registrar / 후이즈 등에서 **raidkorea.site** 검색 → 구매 (연 1~2만원대)
  - 예비 후보: raidkorea.gg · reko.gg · raidkorea.kr
- [ ] 구매만 해두시면 됩니다. DNS 연결은 Firebase Hosting 붙일 때 제가 값 드릴게요
- `→ 수진에게`: 구매한 최종 도메인 이름

## 1. Firebase 프로젝트

- [ ] https://console.firebase.google.com → **프로젝트 추가** → 이름 `reko-platform` (또는 raidkorea)
  - Google 애널리틱스: 꺼도 됨 (나중에 추가 가능)
- [ ] **요금제를 Blaze(종량제)로 업그레이드** — 필수입니다. Functions에서 외부 API(블리자드·디스코드·WCL) 호출은 Blaze에서만 가능해요. 한길련도 같은 구조라 익숙하실 거예요. 현재 규모에선 실비용 거의 0원
  - [ ] 좌측 톱니 → 사용량 및 청구 → **예산 알림** 월 1만원 설정 (안전벨트)
- [ ] **Firestore Database** → 데이터베이스 만들기 → 위치 **asia-northeast3 (서울)** → 프로덕션 모드
- [ ] **Authentication** → 시작하기
- [ ] 프로젝트 개요 옆 톱니 → 프로젝트 설정 → 일반 → **웹 앱 추가** (`</>` 아이콘) → 이름 REKO → Hosting 체크 안 해도 됨
- `→ 수진에게`: 웹 앱 등록 후 나오는 **firebaseConfig 블록 전체** (apiKey, authDomain, projectId 등 — 이건 공개돼도 되는 값이라 채팅으로 주셔도 됩니다)

## 2. Google 로그인 (5분)

- [ ] Firebase 콘솔 → Authentication → **Sign-in method** → Google → 사용 설정 → 프로젝트 지원 이메일 선택 → 저장
- `→ 수진에게`: "구글 켰음" 한마디면 끝

## 3. Battle.net API ★ (심사 대기 있음 — 가장 먼저!)

- [ ] https://develop.battle.net → 우상단 로그인 (본인 배틀넷 계정)
- [ ] **API ACCESS** → 클라이언트 생성 (Create Client):
  - Client Name: `REKO`
  - Redirect URLs (둘 다 등록):
    - `http://localhost:5173/auth/bnet/callback` (개발용)
    - `https://raidkorea.site/auth/bnet/callback` (도메인 확정 후 추가/수정 가능)
  - Service URL: `https://raidkorea.site` (임시로 wowkorea.site 넣어도 됨)
  - Intended Use: "Community raid scheduling platform for Korean WoW guilds" 정도로 작성
- [ ] 생성되면 **Client ID / Client Secret** 확인 가능
- `→ 수진에게`: **Client ID만** 채팅으로. **Secret은 채팅에 올리지 마시고** 아래 8번 방식으로 직접 등록

## 4. Discord — 앱 + 봇 (레코봇) 만들기

> 한길련 봇(KWGU)과 별개로 **새 앱 "REKO"**를 만듭니다 (브랜딩 + 권한 분리). 방식은 한길련 봇과 동일한 HTTP Interactions(게이트웨이 상주 없음, Cloud Functions로 응답)라 서버비 0원.

### 4-A. 애플리케이션 생성
- [ ] https://discord.com/developers/applications → **New Application** → 이름 `REKO`
- [ ] General Information에서 아이콘(나중에 AI 생성 엠블럼)과 설명 입력
- [ ] 다음 세 값 확인:
  - **Application ID** (= Client ID)
  - **Public Key** (인터랙션 서명 검증용)
- `→ 수진에게`: Application ID + Public Key (공개값이라 채팅 OK)

### 4-B. OAuth2 (로그인 연동용)
- [ ] 좌측 **OAuth2** → Redirects에 추가:
  - `http://localhost:5173/auth/discord/callback`
  - `https://raidkorea.site/auth/discord/callback`
- [ ] Client Secret은 **Reset Secret**으로 발급 → 8번 방식으로 등록 (채팅 금지)

### 4-C. 봇 설정
- [ ] 좌측 **Bot** → 봇 이름 확인(레코 / REKO), 아이콘 설정
- [ ] **Reset Token** → 봇 토큰 발급 → 8번 방식으로 등록 (채팅 절대 금지 — 유출 시 봇 탈취됩니다)
- [ ] Privileged Gateway Intents: **전부 꺼진 상태 그대로 두세요** (HTTP 방식이라 불필요)
- [ ] Bot → **Public Bot 끄기** (아무나 초대 못 하게)

### 4-D. 서버에 봇 초대
- [ ] 좌측 OAuth2 → **URL Generator**:
  - Scopes: `bot`, `applications.commands`
  - Bot Permissions: `View Channels` `Send Messages` `Embed Links` `Attach Files` `Manage Messages` `Read Message History` `Create Public Threads` `Send Messages in Threads` `Mention Everyone`
- [ ] 생성된 URL로 이동 → 초대할 서버 선택: 한길련 디코, TeamSAD(후제공방) 디코 등 관리 권한 있는 서버
- [ ] 알림 카드가 올라갈 채널에서 봇이 보이는지 확인

### 4-E. Interactions Endpoint (제가 함수 배포한 뒤에)
- [ ] 제가 Cloud Functions 배포 후 URL을 드리면 → General Information → **Interactions Endpoint URL**에 붙여넣고 저장 (디스코드가 자동 검증)
- [ ] 슬래시 명령 등록은 제가 스크립트로 처리합니다 (한길련 방식 그대로)

## 5. Warcraft Logs API

- [ ] https://www.warcraftlogs.com → 로그인 → 우상단 프로필 → **API Clients** (https://www.warcraftlogs.com/api/clients/)
- [ ] **Create Client**:
  - Name: `REKO`
  - Redirect URL: `https://raidkorea.site/auth/wcl/callback` (+ localhost도)
  - Public/Private: Private 유지
- `→ 수진에게`: Client ID는 채팅 OK, Secret은 8번 방식
- 참고: 길드/공대 프로그레스 같은 공개 데이터는 이 클라이언트 자격만으로 조회 가능(유저 연동 없이도 시작 가능)

## 6. raider.io (선택, 키 불필요)

- [ ] 할 일 없음 — 공개 API라 바로 씁니다. 프로그레스 표시 백업 소스

## 7. GitHub 저장소

- [ ] github.com에서 새 저장소 `raidkorea` 생성 (Private 권장 — 공개 전환은 나중에)
- [ ] 로컬 `C:\VibeCoding Claude\raidkorea`에서: `git init` → GitHub Desktop으로 publish (평소 방식)
- 배포는 한길련처럼 GitHub Pages + Firebase Functions 조합 또는 Firebase Hosting 단일 — **제 추천은 Firebase Hosting**(도메인·Functions·리라이트 일원화). P1에서 확정

## 8. 비밀키 등록 방법 (Secret 전용 통로)

> Client Secret / Bot Token은 절대 채팅·카톡·메모장에 남기지 마세요. 아래 명령으로 Firebase에 직접 저장하면 저는 이름만 알고 값은 못 봅니다 (한길련 봇과 같은 방식).

- [ ] PowerShell에서 (firebase-tools 설치돼 있으니):
```powershell
cd "C:\VibeCoding Claude\raidkorea"
firebase login          # 처음 한 번
firebase use reko-platform

firebase functions:secrets:set BNET_CLIENT_SECRET
firebase functions:secrets:set DISCORD_CLIENT_SECRET
firebase functions:secrets:set DISCORD_BOT_TOKEN
firebase functions:secrets:set WCL_CLIENT_SECRET
```
각 명령 실행 시 값 붙여넣기 → 엔터. 끝.
- `→ 수진에게`: "시크릿 4개 등록 완료"라고만 알려주세요

## 9. (참고) 이미 하신 것 / 제가 하는 것

| 완료 | 항목 |
|---|---|
| ✅ | raidkorea 폴더 + 프로토타입 v0.1 (수진) |
| ✅ | kgusystem P0 버그픽스 — **git push + `firebase deploy --only firestore` 아직이면 한 번 해주세요** (한길련 쪽) |
| 수진 담당 | Functions 코드(OAuth 브로커·봇·워커), Firestore 규칙, 슬래시 명령 등록, DNS 연결값 안내, 마이그레이션 스크립트 |

## 10. 요약 — 오늘 하면 좋은 것 TOP 3

1. **Battle.net 클라이언트 생성** (심사 대기 때문에 1순위)
2. **Firebase 프로젝트 + Blaze + Firestore(서울) + Google 로그인** (10분 컷)
3. **도메인 구매** (raidkorea.site)

나머지(디코 앱·WCL·시크릿)는 이번 주 중 아무 때나 하시면 P1~P2 일정에 지장 없습니다.
