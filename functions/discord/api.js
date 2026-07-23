// Discord REST v10 헬퍼 — 봇 토큰으로 채널 메시지·DM 발행, 슬래시 명령 등록.
// 팔로업(원본 응답 수정)은 인터랙션 토큰(webhook)만으로 가능해 봇 토큰이 필요 없다.
// Node 22 내장 fetch 사용 (외부 HTTP 라이브러리 없음).

import { DISCORD_API, DISCORD_APP_ID } from './constants.js';

function botHeaders(token) {
  return { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
}

async function req(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Discord API ${res.status}: ${text?.slice(0, 300)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/** 채널에 메시지 발행 — 반환 객체의 id가 카드 갱신용 messageId */
export function postChannelMessage(token, channelId, payload) {
  return req(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: botHeaders(token),
    body: JSON.stringify(payload),
  });
}

/** 기존 메시지 수정 — 카드보드 실시간 갱신 */
export function editChannelMessage(token, channelId, messageId, payload) {
  return req(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: botHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function deleteChannelMessage(token, channelId, messageId) {
  return req(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: botHeaders(token),
  });
}

/** DM 발송 — DM 채널 생성 후 메시지 (상대가 서버 DM을 막아둔 경우 403 가능) */
export async function sendDirectMessage(token, userId, payload) {
  const channel = await req(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: botHeaders(token),
    body: JSON.stringify({ recipient_id: userId }),
  });
  return postChannelMessage(token, channel.id, payload);
}

/** 슬래시 명령 전역 일괄 등록 (등록 스크립트 전용) */
export function bulkOverwriteGlobalCommands(token, commands, appId = DISCORD_APP_ID) {
  return req(`${DISCORD_API}/applications/${appId}/commands`, {
    method: 'PUT',
    headers: botHeaders(token),
    body: JSON.stringify(commands),
  });
}

/** 인터랙션 원본(deferred) 응답 수정 — 인터랙션 토큰만 필요 (봇 토큰 불필요) */
export function editInteractionOriginal(interactionToken, payload, appId = DISCORD_APP_ID) {
  return req(`${DISCORD_API}/webhooks/${appId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
