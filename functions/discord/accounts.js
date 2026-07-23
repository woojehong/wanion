// 디스코드 ↔ 와니온 계정 연동 + 스코프 권한 판정 (Admin SDK).
// 봇은 Admin SDK로 돌아 firestore.rules를 우회하므로, 웹 규칙과 동일한 권한 로직을
// 여기서 코드로 재현해야 한다 (canManageRaid = firestore.rules의 동명 함수와 일치).

import { FieldValue } from 'firebase-admin/firestore';

const LINK_CODE_TTL_MS = 15 * 60 * 1000; // 15분

function randomCode() {
  // 사람이 디코에 타이핑하기 쉬운 6자리 (혼동 문자 0/O/1/I/L 제외)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/** 웹에서 호출 — 1회용 연동 코드 발급 (users/{uid} 존재 전제) */
export async function createLinkCode(db, uid) {
  // 기존 미사용 코드는 그대로 두고 새 코드 발급 (충돌 시 재시도)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    const ref = db.doc(`discordLinkCodes/${code}`);
    const snap = await ref.get();
    if (snap.exists) continue;
    await ref.set({ uid, createdAt: Date.now() });
    return code;
  }
  throw new Error('코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

/** 디스코드 유저 id → 와니온 uid (연동돼 있지 않으면 null) */
export async function resolveUid(db, discordUserId) {
  const snap = await db.doc(`discordLinks/${discordUserId}`).get();
  return snap.exists ? snap.data().uid : null;
}

/**
 * /연동 <코드> 처리 — 코드 소비 + 양방향 매핑 기록.
 * 규칙: 1 디스코드 = 1 와니온, 1 와니온 = 1 디스코드.
 * @returns {{ ok: boolean, error?: string, uid?: string, displayName?: string }}
 */
export async function linkByCode(db, { code, discordUserId, discordUsername }) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) return { ok: false, error: '코드 형식이 올바르지 않습니다. (영문+숫자 6자리)' };

  const codeRef = db.doc(`discordLinkCodes/${clean}`);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) return { ok: false, error: '코드를 찾을 수 없습니다. 마이페이지에서 새 코드를 발급받아주세요.' };
  const { uid, createdAt } = codeSnap.data();
  if (Date.now() - (createdAt || 0) > LINK_CODE_TTL_MS) {
    await codeRef.delete().catch(() => {});
    return { ok: false, error: '코드가 만료되었습니다(15분). 마이페이지에서 새 코드를 발급받아주세요.' };
  }

  // 이 디스코드 계정이 다른 와니온 계정에 이미 연동돼 있으면 차단
  const existingLink = await db.doc(`discordLinks/${discordUserId}`).get();
  if (existingLink.exists && existingLink.data().uid !== uid) {
    return { ok: false, error: '이 디스코드 계정은 이미 다른 와니온 계정에 연동돼 있습니다.' };
  }
  // 이 와니온 계정이 다른 디스코드 계정에 이미 연동돼 있으면 차단
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { ok: false, error: '연동 대상 계정을 찾을 수 없습니다.' };
  const existingDiscordId = userSnap.data().discordId;
  if (existingDiscordId && existingDiscordId !== discordUserId) {
    return { ok: false, error: '이 와니온 계정은 이미 다른 디스코드 계정과 연동돼 있습니다. 마이페이지에서 해제 후 다시 시도해주세요.' };
  }

  const batch = db.batch();
  batch.set(db.doc(`discordLinks/${discordUserId}`), {
    uid,
    discordUsername: discordUsername || null,
    linkedAt: FieldValue.serverTimestamp(),
  });
  batch.set(userRef, { discordId: discordUserId, discordUsername: discordUsername || null }, { merge: true });
  batch.delete(codeRef);
  await batch.commit();

  return { ok: true, uid, displayName: userSnap.data().displayName || '모험가' };
}

/** memberships/{uid}_{scopeType}_{scopeId} 역할 조회 */
export async function scopeRole(db, uid, scopeType, scopeId) {
  const snap = await db.doc(`memberships/${uid}_${scopeType}_${scopeId}`).get();
  return snap.exists ? snap.data().role : null;
}

export async function isPlatformAdmin(db, uid) {
  const role = await scopeRole(db, uid, 'platform', 'platform');
  return role === 'owner' || role === 'staff';
}

/**
 * firestore.rules canManageRaid(d)의 코드 재현 — 레이드 관리(픽스·승격 등) 권한.
 */
export async function canManageRaid(db, uid, raid) {
  if (!uid || !raid) return false;
  if (await isPlatformAdmin(db, uid)) return true;
  if (raid.hostType === 'user') return raid.hostId === uid;
  if (raid.hostType === 'guild') {
    const r = await scopeRole(db, uid, 'guild', raid.hostId);
    return r === 'master' || r === 'officer';
  }
  if (raid.hostType === 'team') {
    const r = await scopeRole(db, uid, 'team', raid.hostId);
    return r === 'leader' || r === 'officer';
  }
  if (raid.hostType === 'alliance') {
    const r = await scopeRole(db, uid, 'alliance', raid.hostId);
    return r === 'officer';
  }
  return false;
}

/** 카드채널 바인딩 권한 — 스코프 관리자(마스터/공대장/관리자) 또는 플랫폼 운영자 */
export async function canBindScope(db, uid, scopeType, scopeId) {
  if (await isPlatformAdmin(db, uid)) return true;
  if (scopeType === 'global') return false; // global은 플랫폼 운영자 전용
  const r = await scopeRole(db, uid, scopeType, scopeId);
  if (scopeType === 'guild') return r === 'master' || r === 'officer';
  if (scopeType === 'team') return r === 'leader' || r === 'officer';
  if (scopeType === 'alliance') return r === 'officer';
  return false;
}

/** 유저의 소속 목록 (조직명 조인) — /프로필 · /일정 내공대 필터 */
export async function fetchMemberships(db, uid) {
  const snap = await db.collection('memberships').where('uid', '==', uid).get();
  const COL = { guild: 'guilds', team: 'teams', alliance: 'alliances' };
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Promise.all(
    rows.map(async (m) => {
      if (m.scopeType === 'platform') return { ...m, orgName: '와니온 플랫폼' };
      try {
        const o = await db.doc(`${COL[m.scopeType] || 'guilds'}/${m.scopeId}`).get();
        return { ...m, orgName: o.exists ? o.data().name : m.scopeId };
      } catch {
        return { ...m, orgName: m.scopeId };
      }
    })
  );
}
