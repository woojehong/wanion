#!/usr/bin/env node
// 와니온봇 슬래시 명령 전역 등록 (1회 세팅 · 명령 추가/변경 시 재실행).
//
// 사용법 (프로젝트 루트에서):
//   DISCORD_BOT_TOKEN=<봇토큰> node scripts/registerDiscordCommands.mjs
//
// - 봇 토큰은 Discord 개발자 포털 > Bot > Reset Token 에서 발급한 값.
// - 전역 명령은 반영에 최대 1시간이 걸릴 수 있음(테스트 서버 즉시 반영이 필요하면 길드 등록으로 전환).
// - 이 스크립트는 firebase-admin 등 서버 의존성 없이 표준 fetch만 사용한다.

import { COMMANDS } from '../functions/discord/commands.js';
import { bulkOverwriteGlobalCommands } from '../functions/discord/api.js';

const token = process.env.DISCORD_BOT_TOKEN || process.argv[2];
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN 환경변수(또는 첫 번째 인자)로 봇 토큰을 넘겨주세요.');
  process.exit(1);
}

try {
  const result = await bulkOverwriteGlobalCommands(token, COMMANDS);
  console.log(`✅ 슬래시 명령 ${result.length}개 등록 완료:`);
  result.forEach((c) => console.log(`   /${c.name} — ${c.description}`));
  console.log('\n전역 명령은 서버에 반영되기까지 수 분~최대 1시간이 걸릴 수 있습니다.');
} catch (e) {
  console.error('❌ 등록 실패:', e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
}
