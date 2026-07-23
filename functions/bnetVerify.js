// BNet 상시 로스터 검증 (P3) — 공개 길드 로스터 API로 소속 이탈 감지 → 제명 제안.
//
// 와니온 길드에 실제 와우 길드(realmSlug + guildSlug)를 바인딩해두면,
// 스케줄러가 공개 길드 로스터를 받아 각 멤버의 등록 캐릭터와 대조한다.
// 멤버의 캐릭터가 로스터에 하나도 없으면 → 길드마스터에게 '제명 제안' 카드를 띄운다.
// (실제 제명 결정은 마스터가 함 — 자동 제명은 하지 않음.)
//
// 소스=client_credentials 앱 토큰(progress.js 재사용). 캐릭 docId 규칙: `${realmSlug}-${name소문자}` (bnetCallback와 동일).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { BNET_CLIENT_SECRET, getClientToken } from './progress.js';
import { DISCORD_BOT_TOKEN } from './discord/index.js';
import { createNotification } from './notify.js';

const REGION = 'asia-northeast3';
const API_HOST = 'https://kr.api.blizzard.com';
const NS = 'profile-kr';

/** 공개 길드 로스터 → 캐릭 키 Set(`${realmSlug}-${name소문자}`). 실패 시 null */
async function fetchGuildRoster(token, realmSlug, guildSlug) {
  const url =
    `${API_HOST}/data/wow/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(guildSlug)}` +
    `/roster?namespace=${NS}&locale=ko_KR`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const set = new Set();
  (data.members || []).forEach((m) => {
    const nm = m.character?.name;
    const rs = m.character?.realm?.slug;
    if (nm && rs) set.add(`${rs}-${String(nm).toLowerCase()}`);
  });
  return set;
}

async function guildMasterUids(db, guildId) {
  const snap = await db
    .collection('memberships')
    .where('scopeType', '==', 'guild')
    .where('scopeId', '==', guildId)
    .where('role', '==', 'master')
    .get();
  return snap.docs.map((d) => d.data().uid);
}

/**
 * 한 길드 검증 — 멤버(member/officer)의 캐릭이 로스터에 없으면 제명 제안 생성(+마스터 알림).
 * 다시 로스터에 들어온 멤버의 기존 제안은 자동 해제.
 * @returns { skipped } | { proposed, cleared, checked }
 */
export async function verifyGuild(db, guildId, guild, token, opts = {}) {
  if (!guild?.wowRealmSlug || !guild?.wowGuildSlug) return { skipped: 'unbound' };
  const roster = await fetchGuildRoster(token, guild.wowRealmSlug, guild.wowGuildSlug);
  if (!roster) return { skipped: 'roster-fetch-failed' };

  const memSnap = await db
    .collection('memberships')
    .where('scopeType', '==', 'guild')
    .where('scopeId', '==', guildId)
    .get();
  const members = memSnap.docs.map((d) => d.data()).filter((m) => ['member', 'officer'].includes(m.role));

  const masters = await guildMasterUids(db, guildId);
  let proposed = 0;
  let cleared = 0;

  for (const m of members) {
    // eslint-disable-next-line no-await-in-loop
    const chars = await db.collection(`users/${m.uid}/characters`).get();
    const inGuild = chars.docs.some((c) => roster.has(c.id));
    const propRef = db.doc(`kickProposals/${guildId}_${m.uid}`);
    // eslint-disable-next-line no-await-in-loop
    const propSnap = await propRef.get();

    if (!inGuild) {
      if (propSnap.exists && propSnap.data().status === 'pending') continue; // 이미 제안됨
      // eslint-disable-next-line no-await-in-loop
      const uSnap = await db.doc(`users/${m.uid}`).get();
      const displayName = uSnap.exists ? uSnap.data().displayName || '모험가' : '모험가';
      // eslint-disable-next-line no-await-in-loop
      await propRef.set({
        guildId,
        uid: m.uid,
        displayName,
        battletag: (uSnap.exists && uSnap.data().battletag) || null,
        reason: 'no-char-in-guild',
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
      proposed += 1;
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        masters.map((mu) =>
          createNotification(
            db,
            mu,
            {
              type: 'kick_proposal',
              title: '길드 이탈 감지',
              body: `${displayName} 님의 캐릭터가 길드 로스터에 없어요 — 제명 여부를 검토해주세요.`,
              link: `/guild/${guildId}`,
            },
            { botToken: opts.botToken }
          )
        )
      );
    } else if (propSnap.exists) {
      // eslint-disable-next-line no-await-in-loop
      await propRef.delete(); // 복귀 — 제안 해제
      cleared += 1;
    }
  }

  await db.doc(`guilds/${guildId}`).set({ lastVerifyAt: FieldValue.serverTimestamp() }, { merge: true });
  return { proposed, cleared, checked: members.length };
}

/** [지금 검증] — 길드 마스터 수동 실행 */
export const verifyGuildNow = onCall(
  { region: REGION, secrets: [BNET_CLIENT_SECRET, DISCORD_BOT_TOKEN] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const guildId = request.data?.guildId;
    if (!guildId) throw new HttpsError('invalid-argument', 'guildId가 필요합니다.');
    const db = getFirestore();
    const [mem, plat, gSnap] = await Promise.all([
      db.doc(`memberships/${uid}_guild_${guildId}`).get(),
      db.doc(`memberships/${uid}_platform_platform`).get(),
      db.doc(`guilds/${guildId}`).get(),
    ]);
    const isMaster =
      (mem.exists && mem.data().role === 'master') ||
      (plat.exists && ['owner', 'staff'].includes(plat.data().role));
    if (!isMaster) throw new HttpsError('permission-denied', '길드 마스터만 검증할 수 있어요.');
    if (!gSnap.exists) throw new HttpsError('not-found', '길드를 찾을 수 없어요.');
    const guild = gSnap.data();
    if (!guild.wowRealmSlug || !guild.wowGuildSlug) {
      throw new HttpsError('failed-precondition', '먼저 실제 와우 길드(서버·길드명)를 연결해주세요.');
    }
    const token = await getClientToken(BNET_CLIENT_SECRET.value());
    const r = await verifyGuild(db, guildId, guild, token, { botToken: DISCORD_BOT_TOKEN.value() });
    return r;
  }
);

/** 매일 KST 05:00 — 바인딩된 모든 길드 검증 */
export const scheduledGuildVerify = onSchedule(
  { region: REGION, schedule: '0 5 * * *', timeZone: 'Asia/Seoul', secrets: [BNET_CLIENT_SECRET, DISCORD_BOT_TOKEN] },
  async () => {
    const db = getFirestore();
    const guilds = await db.collection('guilds').get();
    const bound = guilds.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.wowRealmSlug && g.wowGuildSlug);
    if (!bound.length) {
      console.log('guild verify: no bound guilds');
      return;
    }
    const token = await getClientToken(BNET_CLIENT_SECRET.value());
    for (const g of bound) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await verifyGuild(db, g.id, g, token, { botToken: DISCORD_BOT_TOKEN.value() });
        console.log(`guild ${g.id}:`, JSON.stringify(r));
      } catch (e) {
        console.error(`guild verify ${g.id} failed:`, e.message);
      }
    }
  }
);
