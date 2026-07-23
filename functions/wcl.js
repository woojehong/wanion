// WCL(Warcraft Logs) 정공 리포트 (사양 7.3) — 공대의 실제 WCL 길드 로그를 조회·캐시.
//
// 소스: WCL v2 **client_credentials** 앱 토큰(공개 데이터 조회)으로 GraphQL 질의.
//  - 공대 관리 페이지에서 WCL 길드(이름·서버)를 연결하면, 그 길드의 최근 리포트(로그 세션)를 받아
//    wclReports/{teamId}에 캐시한다. 표시 범위(전체/공대원/비공개)는 teams.wclVisibility가 통제(rules).
//  - 스케줄러 없이 [지금 갱신] 수동(공대장·5분 쿨다운). 무료 스케줄 잡 한도(3개) 보존.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REGION = 'asia-northeast3';
const WCL_CLIENT_ID = '019f8cd6-3bf6-714e-a978-bfbb2a11badb'; // 공개 (config.js와 동일)
export const WCL_CLIENT_SECRET = defineSecret('WCL_CLIENT_SECRET');

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const GQL_URL = 'https://www.warcraftlogs.com/api/v2/client';

let tokenCache = { token: null, exp: 0 };

async function getWclToken(secret) {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.exp - 60_000) return tokenCache.token;
  const basic = Buffer.from(`${WCL_CLIENT_ID}:${secret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`WCL 토큰 발급 실패 (${res.status})`);
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: now + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

const REPORTS_QUERY = `query($guildName:String!,$serverSlug:String!,$serverRegion:String!){
  reportData{
    reports(guildName:$guildName,guildServerSlug:$serverSlug,guildServerRegion:$serverRegion,limit:8){
      data{ code title startTime endTime zone{ name } owner{ name } }
    }
  }
}`;

async function fetchReports(token, guildName, serverSlug, region) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: REPORTS_QUERY,
      variables: { guildName, serverSlug, serverRegion: region },
    }),
  });
  if (!res.ok) throw new Error(`WCL API 오류 (${res.status})`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(`WCL: ${j.errors[0].message}`);
  const data = j.data?.reportData?.reports?.data || [];
  return data.map((r) => ({
    code: r.code,
    title: r.title || null,
    startTime: r.startTime || null,
    endTime: r.endTime || null,
    zone: r.zone?.name || null,
    owner: r.owner?.name || null,
  }));
}

/** 한 공대의 WCL 리포트 캐시 갱신 */
export async function refreshTeamWcl(db, teamId, team, secret) {
  if (!team?.wclGuildName || !team?.wclServerSlug) return { skipped: 'unbound' };
  const region = team.wclRegion || 'KR';
  const token = await getWclToken(secret);
  const reports = await fetchReports(token, team.wclGuildName, team.wclServerSlug, region);
  await db.doc(`wclReports/${teamId}`).set({
    teamId,
    reports,
    guildName: team.wclGuildName,
    serverSlug: team.wclServerSlug,
    region,
    syncedAt: FieldValue.serverTimestamp(),
  });
  return { count: reports.length };
}

/** [지금 갱신] — 공대장·관리자 수동 (5분 쿨다운) */
export const refreshTeamWclReport = onCall(
  { region: REGION, secrets: [WCL_CLIENT_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const teamId = request.data?.teamId;
    if (!teamId) throw new HttpsError('invalid-argument', 'teamId가 필요합니다.');
    const db = getFirestore();
    const [mem, plat, tSnap] = await Promise.all([
      db.doc(`memberships/${uid}_team_${teamId}`).get(),
      db.doc(`memberships/${uid}_platform_platform`).get(),
      db.doc(`teams/${teamId}`).get(),
    ]);
    const isLeader =
      (mem.exists && ['leader', 'officer'].includes(mem.data().role)) ||
      (plat.exists && ['owner', 'staff'].includes(plat.data().role));
    if (!isLeader) throw new HttpsError('permission-denied', '공대장·관리자만 갱신할 수 있어요.');
    if (!tSnap.exists) throw new HttpsError('not-found', '공대를 찾을 수 없어요.');
    const team = tSnap.data();
    if (!team.wclGuildName || !team.wclServerSlug) {
      throw new HttpsError('failed-precondition', '먼저 WCL 길드(이름·서버)를 연결해주세요.');
    }
    const last = team.wclRefreshedAt || 0;
    if (Date.now() - last < 5 * 60 * 1000) {
      throw new HttpsError('resource-exhausted', '너무 자주 갱신했어요. 잠시 후 다시 시도해주세요.');
    }
    const r = await refreshTeamWcl(db, teamId, team, WCL_CLIENT_SECRET.value());
    await db.doc(`teams/${teamId}`).set({ wclRefreshedAt: Date.now() }, { merge: true });
    return r;
  }
);
