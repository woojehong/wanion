# 와니온봇 배포 & 세팅 체크리스트 (v1)

> 코드 완료 상태(커밋 `1c0dddc`, `3be8f38`). 시크릿 2종은 이미 등록 완료.
> 아래 순서대로 하면 봇이 살아납니다. 소요 ~15분.

프로젝트 고정값
- Application(Client) ID: `1529664610838511779`
- Interactions Endpoint URL: `https://asia-northeast3-raidkorea-f34c9.cloudfunctions.net/discordInteractions`
- 공개키(코드에 하드코딩됨): `030c25727220ebcefad177736d2d8d6a9f0575925ae46c205596facb6a63016d`

---

## 1. GitHub push
프로젝트 루트에서:
```
git push
```

## 2. Functions + 규칙 + 인덱스 배포
```
firebase deploy --only functions,firestore:rules,firestore:indexes
```
- 새 함수 3종이 배포됨: `discordInteractions`, `onRaidWritten`, `discordCreateLinkCode`
- 기존 함수(bnetCallback 등)는 그대로. 시크릿은 이미 등록돼 있어 추가 입력 없음.
- 인덱스 빌드(apps.userId 컬렉션그룹)는 콘솔에서 수 분 걸릴 수 있음 — `/내신청` 은 빌드 완료 후 동작.

## 3. Interactions Endpoint URL 등록
Discord 개발자 포털 → 해당 애플리케이션 → **General Information** →
`INTERACTIONS ENDPOINT URL` 칸에 위 URL 붙여넣고 **Save Changes**.
- 저장 시 Discord가 검증용 PING을 보냄 → 봇이 서명검증 후 PONG → **저장 성공하면 검증 통과**.
- 저장이 거부되면: (a) 아직 배포 전이거나 (b) 포털의 Public Key가 위 값과 다른 경우.
  Public Key를 리셋한 적 있으면 `functions/discord/constants.js`의 `DISCORD_PUBLIC_KEY`를 새 값으로 교체 후 재배포.

## 4. 슬래시 명령 등록 (1회)
프로젝트 루트에서 봇 토큰을 넣어 실행:
```
# macOS/Linux
DISCORD_BOT_TOKEN=<봇토큰> node scripts/registerDiscordCommands.mjs
# Windows PowerShell
$env:DISCORD_BOT_TOKEN="<봇토큰>"; node scripts/registerDiscordCommands.mjs
```
- 8개 명령이 등록됨: `/연동 /일정 /내신청 /프로필 /신청 /취소 /픽스 /카드채널`
- 전역 명령은 반영에 수 분~최대 1시간. (명령을 추가/수정하면 이 스크립트만 재실행)

## 5. 봇 서버 초대
개발자 포털 → **OAuth2 → URL Generator**
- SCOPES: `bot`, `applications.commands`
- BOT PERMISSIONS: `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`
- 생성된 URL로 접속 → 한길련/TeamSAD 서버에 추가.

## 6. 카드보드 채널 지정
카드가 게시될 채널에서 (관리자/공대장 계정으로):
```
/카드채널 스코프:<자동완성에서 선택>
```
- 예: TeamSAD 공대 채널 → `공대 · TeamSAD`, 특정 길드 채널 → `길드 · …`, 전역 채널(플랫폼 운영자만) → `전역 (모든 레이드)`
- 지정 후, 해당 스코프로 개설되는 레이드가 이 채널에 자동 게시되고 신청 현황이 실시간 갱신됨.

## 7. 유저 계정 연동
각 유저: 와니온 **마이페이지 → DISCORD 카드 → "연동 코드 발급"** →
디스코드에서 `/연동 <6자리코드>` 입력 (코드 15분 유효). 연동해야 `/신청 /픽스 /프로필(본인)` 사용 가능.

## 8. (선택) 앱 이름 변경
개발자 포털 → General Information → NAME: `레코봇` → `와니온봇` 으로 변경 권장.

---

## 참고 · 설계 메모
- **비용 0원 유지**: 상주 프로세스 없음. 디스코드가 부를 때만 `discordInteractions`가 깨어남(한길련 봇 방식 계승).
- **권한**: 봇은 Admin SDK로 돌아 rules를 우회하므로, `/신청·/취소·/픽스`는 `db.js`의 정원 트랜잭션(캡 판정·counts 원자갱신)을 `functions/discord/raidOps.js`에서 그대로 재현함 → 웹/디코 동시 신청에도 정원 초과 불가.
- **연동 방식**: OAuth가 아닌 1회용 코드 방식 → `DISCORD_CLIENT_SECRET`은 v1에서 미사용(P3 역할 동기화용으로 예약).
- **최소 템렙 공대**: 디스코드는 템렙 확인이 불가해, `minIlvl`이 있는 레이드는 `/신청`이 웹 신청으로 안내함(설계상 의도).
- **카드 갱신 루프 방지**: 레이드 문서에 `discordCardSig`(내용 서명)를 역기록해, 카드 id 기록이 트리거를 재발화시켜도 내용 변화가 없으면 스킵.

## v1 이후 (다음 세션 후보)
- 노쇼 신고 접수 카드(승인/기각 버튼), 쪽지 DM 브릿지, 포럼 자동 프로비저닝, 역할 동기화(OAuth), 포인트 지급 알림(포인트 자동화 보류 해제 시).
