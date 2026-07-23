// 레이드 신청/취소/픽스 — src/lib/db.js의 트랜잭션 로직을 Admin SDK로 그대로 재현.
// Admin SDK는 firestore.rules를 우회하므로, 정원 판정(캡)과 counts 원자 갱신을
// 여기서 웹과 동일하게 보장해야 동시 신청 race로 인한 정원 초과가 구조적으로 막힌다.

import { FieldValue } from 'firebase-admin/firestore';
import { getCaps } from '../gamedata.js';

const ST = () => FieldValue.serverTimestamp();

/** 다가오는 레이드 — 종료 전, endAt 오름차순 */
export async function fetchUpcomingRaids(db, pageSize = 10) {
  const snap = await db
    .collection('raids')
    .where('deleted', '==', false)
    .where('endAt', '>', new Date())
    .orderBy('endAt', 'asc')
    .limit(pageSize)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchRaid(db, raidId) {
  const snap = await db.doc(`raids/${raidId}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchCharacters(db, uid) {
  const snap = await db.collection(`users/${uid}/characters`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchCharacter(db, uid, charId) {
  const snap = await db.doc(`users/${uid}/characters/${charId}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/** collectionGroup(apps) — 내 신청 전체 (userId 필드로 조회) */
export async function fetchMyApps(db, uid) {
  const snap = await db.collectionGroup('apps').where('userId', '==', uid).get();
  const rows = [];
  for (const d of snap.docs) {
    const raidRef = d.ref.parent.parent; // raids/{raidId}
    if (!raidRef) continue;
    rows.push({ appId: d.id, raidId: raidRef.id, ...d.data() });
  }
  return rows;
}

/**
 * 신청 — db.submitApplication 재현. appId = uid (웹과 동일, 조직당 1건 강제).
 * @param mode 'normal' | 'bench' | 'pending'
 * @returns 'active' | 'wait' | 'bench' | 'pending'
 */
export async function applyToRaid(db, { raidId, uid, appData, mode = 'normal' }) {
  return db.runTransaction(async (tx) => {
    const raidRef = db.doc(`raids/${raidId}`);
    const appRef = db.doc(`raids/${raidId}/apps/${uid}`);
    const [raidSnap, appSnap] = await Promise.all([tx.get(raidRef), tx.get(appRef)]);
    if (!raidSnap.exists) throw new Error('레이드를 찾을 수 없습니다.');
    const raid = raidSnap.data();
    if (raid.deleted) throw new Error('삭제된 레이드입니다.');
    if (appSnap.exists) throw new Error('이미 이 공대에 신청돼 있습니다. 변경하려면 먼저 `/취소` 하세요.');

    let status = 'wait';
    if (mode === 'bench') status = 'bench';
    else if (mode === 'pending') status = 'pending';
    else if (mode === 'normal') {
      const caps = getCaps(raid);
      const capMap = { tank: caps.tankCap, heal: caps.healerCap, dps: caps.dpsCap };
      const current = (raid.counts && raid.counts[appData.role]) || 0;
      status = current >= capMap[appData.role] ? 'wait' : 'active';
    }

    tx.set(appRef, { ...appData, status, createdAt: ST(), updatedAt: ST() });
    if (status === 'active') {
      tx.update(raidRef, { [`counts.${appData.role}`]: FieldValue.increment(1) });
    }
    return status;
  });
}

/**
 * 취소 — db.cancelApplication 재현. 신청서 삭제 + 취소기록 보존 + counts 보정을 한 트랜잭션으로.
 * @returns { cancelled: boolean } — 신청서가 없었으면 cancelled:false
 */
export async function cancelMyApplication(db, { raidId, uid, reason }) {
  return db.runTransaction(async (tx) => {
    const raidRef = db.doc(`raids/${raidId}`);
    const appRef = db.doc(`raids/${raidId}/apps/${uid}`);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) return { cancelled: false };
    const cur = appSnap.data();

    tx.delete(appRef);
    tx.delete(db.doc(`raids/${raidId}/memos/${uid}`));
    tx.set(db.collection(`raids/${raidId}/cancels`).doc(), {
      userId: cur.userId || uid,
      nickname: cur.nickname || null,
      charName: cur.charName || null,
      classId: cur.classId || null,
      className: cur.className || null,
      classColor: cur.classColor || null,
      specId: cur.specId || null,
      specName: cur.specName || null,
      role: cur.role || null,
      guildId: cur.guildId || null,
      guildName: cur.guildName || null,
      guildColor: cur.guildColor || null,
      prevStatus: cur.status || null,
      reason: (reason || '').trim() || null,
      cancelledAt: ST(),
    });
    if (cur.status === 'active' && cur.role) {
      tx.update(raidRef, { [`counts.${cur.role}`]: FieldValue.increment(-1) });
    }
    return { cancelled: true, prevStatus: cur.status };
  });
}

/** 확정(active) 신청자 목록 — 픽스·알림 대상 산출 */
export async function fetchActiveApps(db, raidId) {
  const snap = await db.collection(`raids/${raidId}/apps`).where('status', '==', 'active').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 픽스 — db.fixRoster 재현. 확정 인원으로 로스터 잠금 (포인트 지급 기준점) */
export async function fixRoster(db, raidId, fixedUserIds) {
  await db.doc(`raids/${raidId}`).update({
    fixed: true,
    fixedAt: ST(),
    fixedUserIds,
  });
}
