// 와니온봇 공개 식별자 — 시크릿 아님 (src/lib/config.js OAUTH.discord와 동일).
// 봇 토큰/클라이언트 시크릿은 Firebase Functions Secrets에만 존재한다.

export const DISCORD_APP_ID = '1529664610838511779'; // Application (Client) ID — 공개
export const DISCORD_PUBLIC_KEY =
  '030c25727220ebcefad177736d2d8d6a9f0575925ae46c205596facb6a63016d'; // 서명 검증용 공개키

export const DISCORD_API = 'https://discord.com/api/v10';

// 사이트 주소 (임베드 링크용) — wanion.site 이전 시 index.js SITE_ORIGIN과 함께 교체
export const SITE_ORIGIN = 'https://woojehong.github.io/wanion';

// Interaction / response type 상수 (Discord API v10)
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
};

export const MessageFlags = { EPHEMERAL: 64 };

// 슬래시 명령 옵션 타입
export const CommandOptionType = {
  SUB_COMMAND: 1,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
};

export function raidUrl(raidId) {
  return `${SITE_ORIGIN}/#/raid/${raidId}`;
}
export function boardUrl() {
  return `${SITE_ORIGIN}/#/board`;
}
export function myPageUrl() {
  return `${SITE_ORIGIN}/#/me`;
}
