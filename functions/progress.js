// 프로필 레이드 진도 파이프라인 (사양 7.2) — 블리자드 캐릭터 encounters API.
//
// 소스: Battle.net **client_credentials** 앱 토큰으로 캐릭터 레이드 진도를 조회한다.
//  - 계정 단위(/profile/user/wow)는 유저 토큰(24h 만료)이 필요하지만,
//    캐릭터 단위(/profile/wow/character/.../encounters/raids)는 앱 토큰으로 조회 가능 →
//    유저 재인증 없이 스케줄러가 상시 갱신할 수 있다 (0원·무만료).
//  - 대상 인스턴스: config/game.progressInstanceId 지정 시 그걸, 없으면 응답의 최신 인스턴스 자동 감지.

import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';

const BNET_CLIENT_ID = 'e08ef14078334fe2b1bade0cc1c5b152'; // 공개 식별자 (index.js와 동일)
export const BNET_CLIENT_SECRET = defineSecret('BNET_CLIENT_SECRET');

const API_HOST = 'https://kr.api.blizzard.com';
const NAMESPACE = 'profile-kr';
const LOCALE = 'ko_KR';

// 난이도 우선순위 (높은 것부터) — 블리자드 difficulty.type ↔ 와니온 표기
const DIFF_ORDER = [
  { type: 'MYTHIC', ko: '신화' },
  { type: 'HEROIC', ko: '영웅' },
  { type: 'NORMAL', ko: '일반' },
  { type: 'LFR', ko: '공찾' },
];

// 앱 토큰 캐시 (웜 인스턴스 내 재사용)
let tokenCache = { token: null, exp: 0 };

export async function getClientToken(secret) {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.exp - 60_000) return tokenCache.token;
  const basic = Buffer.from(`${BNET_CLIENT_ID}:${secret}`).toString('base64');
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`client_credentials token 실패 (${res.status})`);
  const json = await res.json();
  tokenCache = { token: json.access_token, exp: now + (json.expires_in || 86400) * 1000 };
  return tokenCache.token;
}

/** 특정 인스턴스의 최고 난이도 진도 요약 추출 */
function summarizeInstance(instance) {
  const modes = instance.modes || [];
  // 난이도 우선순위대로, 클리어(킬)가 하나라도 있는 최고 난이도 채택. 없으면 최고 난이도의 0/total.
  let best = null;
  for (const d of DIFF_ORDER) {
    const mode = modes.find((m) => m.difficulty?.type === d.type);
    if (!mode) continue;
    const prog = mode.progress || {};
    const killed = prog.completed_count || 0;
    const total = prog.total_count || (prog.encounters ? prog.encounters.length : 0);
    // 최근 킬 계산
    let lastKill = null;
    let lastKillAt = 0;
    (prog.encounters || []).forEach((e) => {
      const ts = e.last_kill_timestamp || 0;
      if (ts > lastKillAt) {
        lastKillAt = ts;
        lastKill = e.encounter?.name || null;
      }
    });
    const summary = {
      difficulty: d.ko,
      difficultyType: d.type,
      killed,
      total,
      lastKill,
      lastKillAt: lastKillAt || null,
    };
    if (killed > 0) return summary; // 킬이 있는 최고 난이도 확정
    if (!best) best = summary; // 킬 없으면 최고 난이도 기록(폴백)
  }
  return best;
}

/** 응답에서 대상 인스턴스 선택: 지정 id 우선, 없으면 최신(마지막 확장의 마지막) */
function pickInstance(raidsData, wantedId) {
  const expansions = raidsData.expansions || [];
  if (wantedId) {
    for (const ex of expansions) {
      const inst = (ex.instances || []).find((i) => i.instance?.id === Number(wantedId));
      if (inst) return inst;
    }
    return null; // 지정했는데 캐릭이 그 인스턴스 데이터가 없음
  }
  const lastEx = expansions[expansions.length - 1];
  const insts = lastEx?.instances || [];
  return insts[insts.length - 1] || null;
}

/**
 * 한 캐릭터의 레이드 진도 조회 → 요약.
 * @param char { name, realmSlug }
 * @returns { name, instanceId, difficulty, killed, total, lastKill, lastKillAt } | null
 */
export async function fetchCharacterProgress(token, char, wantedInstanceId) {
  const realm = char.realmSlug || char.realm || '';
  const name = String(char.name || '').toLowerCase();
  if (!realm || !name) return null;
  const url =
    `${API_HOST}/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name)}` +
    `/encounters/raids?namespace=${NAMESPACE}&locale=${LOCALE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null; // 404 등 (해당 캐릭 미공개·삭제) — 조용히 스킵
  const data = await res.json();
  const inst = pickInstance(data, wantedInstanceId);
  if (!inst) return null;
  const summary = summarizeInstance(inst);
  if (!summary) return null;
  return { name: inst.instance?.name || null, instanceId: inst.instance?.id || null, ...summary };
}

/**
 * 유저의 대표 캐릭터(없으면 최고 레벨) 기준 진도 계산.
 * @returns progress 객체 | null (연동 안 됨·캐릭 없음)
 */
export async function computeUserProgress(db, uid, secret) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return null;
  const user = userSnap.data();
  if (!user.bnetLinked) return null;

  // 대표 캐릭 우선, 없으면 최고 레벨 캐릭
  let char = null;
  if (user.mainCharId) {
    const c = await db.doc(`users/${uid}/characters/${user.mainCharId}`).get();
    if (c.exists) char = c.data();
  }
  if (!char) {
    const chars = await db.collection(`users/${uid}/characters`).get();
    const rows = chars.docs.map((d) => d.data()).sort((a, b) => (b.level || 0) - (a.level || 0));
    char = rows[0] || null;
  }
  if (!char) return null;

  const cfg = (await db.doc('config/game').get()).data() || {};
  const wantedInstanceId = cfg.progressInstanceId || null;

  const token = await getClientToken(secret);
  const prog = await fetchCharacterProgress(token, char, wantedInstanceId);
  if (!prog) return { configured: !!wantedInstanceId, empty: true };
  return { ...prog, charName: char.name || null };
}

/** users/{uid}.progress 기록 (Admin SDK — 클라이언트 쓰기 없음) */
export async function writeUserProgress(db, uid, progress, { manual = false } = {}) {
  const patch = {
    progress: progress && !progress.empty ? { ...progress, syncedAt: FieldValue.serverTimestamp() } : null,
    progressSyncedAt: FieldValue.serverTimestamp(),
  };
  if (manual) patch.progressRefreshedAt = Date.now();
  await db.doc(`users/${uid}`).set(patch, { merge: true });
}

/** 캐릭터 요약 조회 → 현재 레벨 (앱 토큰, 재로그인 불필요) */
export async function fetchCharacterLevel(token, char) {
  const realm = char.realmSlug || char.realm || '';
  const name = String(char.name || '').toLowerCase();
  if (!realm || !name) return null;
  const url =
    `${API_HOST}/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name)}` +
    `?namespace=${NAMESPACE}&locale=${LOCALE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.level === 'number' ? data.level : null;
}

/** 한 캐릭터의 레벨을 재조회 → level·isMax 갱신 (대표면 mainChar 스냅샷도 갱신) */
export async function refreshCharacterLevel(db, uid, charId, secret) {
  const ref = db.doc(`users/${uid}/characters/${charId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('캐릭터를 찾을 수 없습니다.');
  const char = snap.data();
  const token = await getClientToken(secret);
  const level = await fetchCharacterLevel(token, char);
  if (level == null) {
    return { level: char.level || 0, isMax: char.isMax !== false, updated: false };
  }
  const maxLevel = Number((await db.doc('config/game').get()).data()?.maxLevel) || 90;
  const isMax = level >= maxLevel;
  await ref.set({ level, isMax, syncedAt: FieldValue.serverTimestamp() }, { merge: true });
  const userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.exists && userSnap.data().mainCharId === charId) {
    await db.doc(`users/${uid}`).set(
      { mainChar: { ...(userSnap.data().mainChar || {}), level, isMax } },
      { merge: true }
    );
  }
  return { level, isMax, updated: true };
}

/** BNet 연동 유저 전원 진도 갱신 (스케줄러용) — 소규모 전제 순차/청크 */
export async function refreshAllProgress(db, secret) {
  const snap = await db.collection('users').where('bnetLinked', '==', true).get();
  const uids = snap.docs.map((d) => d.id);
  const CHUNK = 5;
  let ok = 0;
  for (let i = 0; i < uids.length; i += CHUNK) {
    const slice = uids.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      slice.map(async (uid) => {
        try {
          const prog = await computeUserProgress(db, uid, secret);
          await writeUserProgress(db, uid, prog);
          ok += 1;
        } catch (e) {
          console.error(`progress refresh failed for ${uid}:`, e.message);
        }
      })
    );
  }
  return { total: uids.length, ok };
}
