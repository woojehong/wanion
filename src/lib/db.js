import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { CLASSES, SYNERGIES, SERVERS, SEED_GUILDS, SEED_ZONES } from './constants';
import { getCaps } from './utils';

// ─────────────────────────────────────────────────────────────────────
// WANION db layer — kgusystem 엔진 계승 + 두 가지 구조 개선:
//  1) 구독 다이어트: 전체 컬렉션 구독 금지. raids는 endAt 기준 기간 쿼리,
//     역할별 인원은 raids 문서의 counts 필드(비정규화)로 해결 → apps N구독 제거.
//  2) 정원 판정 트랜잭션화: 신청/승격/취소가 counts와 원자적으로 갱신되어
//     동시 신청 race로 인한 정원 초과가 구조적으로 불가능.
// ─────────────────────────────────────────────────────────────────────

// ── Game data ────────────────────────────────────────────────────────

export async function loadGamedata() {
  const [classesSnap, synergiesSnap, serversSnap] = await Promise.all([
    getDoc(doc(db, 'gamedata', 'classes')),
    getDoc(doc(db, 'gamedata', 'synergies')),
    getDoc(doc(db, 'gamedata', 'servers')),
  ]);
  return {
    classes: classesSnap.exists() ? classesSnap.data().list : CLASSES,
    synergies: synergiesSnap.exists() ? synergiesSnap.data().list : SYNERGIES,
    servers: serversSnap.exists() ? serversSnap.data().list : SERVERS,
  };
}

/** 최초 1회 시드 (플랫폼 운영자 전용) — 게임데이터 + 창립 길드 + 시즌 던전 */
export async function seedInitialData() {
  const batch = writeBatch(db);
  batch.set(doc(db, 'gamedata', 'classes'), { list: CLASSES });
  batch.set(doc(db, 'gamedata', 'synergies'), { list: SYNERGIES });
  batch.set(doc(db, 'gamedata', 'servers'), { list: SERVERS });
  SEED_GUILDS.forEach((g) => {
    const { id, ...rest } = g;
    batch.set(doc(db, 'guilds', id), { ...rest, createdAt: serverTimestamp() }, { merge: true });
  });
  SEED_ZONES.forEach((z) => {
    const { id, bosses, ...rest } = z;
    batch.set(doc(db, 'zones', id), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
    bosses.forEach((name, i) => {
      batch.set(doc(db, 'zones', id, 'bosses', `b${i + 1}`), { name, order: i + 1 }, { merge: true });
    });
  });
  batch.set(doc(db, 'meta', 'seed'), { done: true, at: serverTimestamp() });
  await batch.commit();
}

// ── Zones & bosses (공략게시판 · 킬 타임라인 공용) ────────────────────

export async function fetchActiveZones() {
  const snap = await getDocs(query(collection(db, 'zones'), where('active', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBosses(zoneId) {
  const snap = await getDocs(query(collection(db, 'zones', zoneId, 'bosses'), orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Raids ────────────────────────────────────────────────────────────

/**
 * 다가오는 레이드 구독 — 종료 시각이 지나지 않은 것만.
 * (kgusystem의 무필터 전체 구독을 대체하는 핵심 다이어트 지점)
 */
export function subscribeUpcomingRaids(cb) {
  const q = query(
    collection(db, 'raids'),
    where('deleted', '==', false),
    where('endAt', '>', Timestamp.now()),
    orderBy('endAt', 'asc')
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export function subscribeRaid(raidId, cb) {
  return onSnapshot(
    doc(db, 'raids', raidId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null)
  );
}

/** 지난 레이드(아카이브) — 실시간 불필요, 페이지 단위 getDocs */
export async function fetchPastRaids(pageSize = 30) {
  const q = query(
    collection(db, 'raids'),
    where('deleted', '==', false),
    where('endAt', '<=', Timestamp.now()),
    orderBy('endAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 레이드 생성 — host 스코프(hostType: alliance|guild|team|user, hostId) 필수.
 * counts는 역할별 확정 인원의 비정규화 캐시로, 모든 변경이 트랜잭션을 경유한다.
 */
export async function createRaid(data, createdBy) {
  const ref = await addDoc(collection(db, 'raids'), {
    acceptMode: 'auto', // 'auto' | 'review' — 길드·연합=auto, 글로벌=review (호출부에서 지정)
    guestParty: false,
    feePublic: false,
    ...data,
    createdBy,
    startAt: Timestamp.fromDate(data.startAt),
    endAt: Timestamp.fromDate(data.endAt),
    counts: { tank: 0, heal: 0, dps: 0 },
    deleted: false,
    fixed: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateRaid(raidId, data) {
  const payload = { ...data };
  if (payload.startAt instanceof Date) payload.startAt = Timestamp.fromDate(payload.startAt);
  if (payload.endAt instanceof Date) payload.endAt = Timestamp.fromDate(payload.endAt);
  return updateDoc(doc(db, 'raids', raidId), payload);
}

export function softDeleteRaid(raidId) {
  return updateDoc(doc(db, 'raids', raidId), { deleted: true, deletedAt: serverTimestamp() });
}

export function restoreRaid(raidId) {
  return updateDoc(doc(db, 'raids', raidId), { deleted: false, deletedAt: null });
}

/** 완전 삭제 — 모든 서브컬렉션(apps/memos/logs/cancels) 포함, 500건 배치 한도 준수 */
export async function hardDeleteRaid(raidId) {
  const subcollections = ['apps', 'memos', 'logs', 'cancels'];
  const snaps = await Promise.all(
    subcollections.map((name) => getDocs(collection(db, 'raids', raidId, name)))
  );
  const refs = snaps.flatMap((snap) => snap.docs.map((d) => d.ref));
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'raids', raidId));
}

/** 픽스 — 출발 직전 로스터 잠금. 종료 후 포인트 지급의 기준점 (지급은 Functions) */
export function fixRoster(raidId, fixedUserIds) {
  return updateDoc(doc(db, 'raids', raidId), {
    fixed: true,
    fixedAt: serverTimestamp(),
    fixedUserIds,
  });
}

// ── Applications (정원 판정 = 트랜잭션) ──────────────────────────────

export function appDocRef(raidId, appId) {
  return doc(db, 'raids', raidId, 'apps', appId);
}

export function memoDocRef(raidId, appId) {
  return doc(db, 'raids', raidId, 'memos', appId);
}

export function subscribeApps(raidId, cb) {
  return onSnapshot(
    collection(db, 'raids', raidId, 'apps'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

/**
 * 신청 제출.
 * @param mode 'normal' | 'bench' | 'waitOnly' | 'pending'
 *   normal   → 트랜잭션 안에서 정원 확인: 자리 있으면 active, 없으면 wait
 *   bench    → 정원 무관 bench
 *   waitOnly → 자격 규칙상 대기만 가능한 경우 (3단계 자격 판정은 호출부 책임)
 *   pending  → 검토후수락 모드(글로벌 파티 등): 정원 미점유, 관리자 승인 시 배치
 */
export async function submitApplication(raidId, appId, appData, memoText, mode = 'normal') {
  await runTransaction(db, async (tx) => {
    const raidRef = doc(db, 'raids', raidId);
    const raidSnap = await tx.get(raidRef);
    if (!raidSnap.exists()) throw new Error('레이드를 찾을 수 없습니다.');
    const raid = raidSnap.data();
    if (raid.deleted) throw new Error('삭제된 레이드입니다.');

    let status = 'wait';
    if (mode === 'bench') status = 'bench';
    else if (mode === 'pending') status = 'pending';
    else if (mode === 'normal') {
      const caps = getCaps(raid);
      const capMap = { tank: caps.tankCap, heal: caps.healerCap, dps: caps.dpsCap };
      const current = (raid.counts && raid.counts[appData.role]) || 0;
      status = current >= capMap[appData.role] ? 'wait' : 'active';
    }

    tx.set(appDocRef(raidId, appId), {
      ...appData,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (status === 'active') {
      tx.update(raidRef, { [`counts.${appData.role}`]: increment(1) });
    }
    if (memoText && memoText.trim()) {
      tx.set(memoDocRef(raidId, appId), { text: memoText.trim(), updatedAt: serverTimestamp() });
    }
  });
}

/**
 * 신청 수정 — 역할·상태가 바뀌면 counts를 원자적으로 보정.
 * prev: { role, status } 수정 전 값 (호출부가 보유한 스냅샷)
 */
export async function updateApplication(raidId, appId, prev, patch, memoText) {
  await runTransaction(db, async (tx) => {
    const raidRef = doc(db, 'raids', raidId);
    const appRef = appDocRef(raidId, appId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) throw new Error('신청서를 찾을 수 없습니다.');
    const cur = appSnap.data();

    const before = { role: prev.role ?? cur.role, status: prev.status ?? cur.status };
    const after = { role: patch.role ?? before.role, status: patch.status ?? before.status };

    tx.update(appRef, { ...patch, updatedAt: serverTimestamp() });

    const delta = {};
    if (before.status === 'active') delta[before.role] = (delta[before.role] || 0) - 1;
    if (after.status === 'active') delta[after.role] = (delta[after.role] || 0) + 1;
    const updates = {};
    Object.entries(delta).forEach(([role, n]) => {
      if (n !== 0) updates[`counts.${role}`] = increment(n);
    });
    if (Object.keys(updates).length) tx.update(raidRef, updates);
  });
  if (memoText !== undefined) {
    if (memoText && memoText.trim()) {
      await setDoc(memoDocRef(raidId, appId), { text: memoText.trim(), updatedAt: serverTimestamp() });
    } else {
      await deleteDoc(memoDocRef(raidId, appId));
    }
  }
}

/**
 * 검토후수락 승인 — pending 신청을 정원 확인과 함께 active/wait로 배치.
 * (거절은 cancelApplication에 사유를 담아 처리)
 */
export async function approveApplication(raidId, appId) {
  await runTransaction(db, async (tx) => {
    const raidRef = doc(db, 'raids', raidId);
    const appRef = appDocRef(raidId, appId);
    const [raidSnap, appSnap] = await Promise.all([tx.get(raidRef), tx.get(appRef)]);
    if (!raidSnap.exists() || !appSnap.exists()) throw new Error('대상을 찾을 수 없습니다.');
    const raid = raidSnap.data();
    const app = appSnap.data();
    if (app.status !== 'pending') throw new Error('승인 대기 상태가 아닙니다.');
    const caps = getCaps(raid);
    const capMap = { tank: caps.tankCap, heal: caps.healerCap, dps: caps.dpsCap };
    const current = (raid.counts && raid.counts[app.role]) || 0;
    const status = current >= capMap[app.role] ? 'wait' : 'active';
    tx.update(appRef, { status, updatedAt: serverTimestamp() });
    if (status === 'active') tx.update(raidRef, { [`counts.${app.role}`]: increment(1) });
  });
}

/**
 * 신청 취소 — 신청서 삭제 + 취소 기록 보존 + counts 보정을 한 트랜잭션으로.
 * appSnapshot은 취소 기록용 비정규화 데이터 (kgusystem 철학 계승).
 */
export async function cancelApplication(raidId, appId, appSnapshot, reason) {
  const a = appSnapshot || {};
  await runTransaction(db, async (tx) => {
    const raidRef = doc(db, 'raids', raidId);
    const appRef = appDocRef(raidId, appId);
    const appSnap = await tx.get(appRef);
    const cur = appSnap.exists() ? appSnap.data() : a;

    tx.delete(appRef);
    tx.delete(memoDocRef(raidId, appId));
    tx.set(doc(collection(db, 'raids', raidId, 'cancels')), {
      userId: a.userId || cur.userId || appId,
      nickname: a.nickname || cur.nickname || null,
      charName: a.charName || cur.charName || null,
      classId: a.classId || cur.classId || null,
      className: a.className || cur.className || null,
      classColor: a.classColor || cur.classColor || null,
      specId: a.specId || cur.specId || null,
      specName: a.specName || cur.specName || null,
      role: a.role || cur.role || null,
      guildId: a.guildId || cur.guildId || null,
      guildName: a.guildName || cur.guildName || null,
      guildColor: a.guildColor || cur.guildColor || null,
      prevStatus: a.status || cur.status || null,
      reason: (reason || '').trim() || null,
      cancelledAt: serverTimestamp(),
    });
    if (appSnap.exists() && cur.status === 'active' && cur.role) {
      tx.update(raidRef, { [`counts.${cur.role}`]: increment(-1) });
    }
  });
}

export function deleteCancelRecord(raidId, cancelId) {
  return deleteDoc(doc(db, 'raids', raidId, 'cancels', cancelId));
}

export function subscribeCancels(raidId, { isAdmin, userId }, cb) {
  const col = collection(db, 'raids', raidId, 'cancels');
  const q = isAdmin ? col : query(col, where('userId', '==', userId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export async function fetchMemo(raidId, appId) {
  const snap = await getDoc(memoDocRef(raidId, appId));
  return snap.exists() ? snap.data().text : '';
}

export async function fetchAllMemos(raidId) {
  const snap = await getDocs(collection(db, 'raids', raidId, 'memos'));
  const map = {};
  snap.docs.forEach((d) => {
    map[d.id] = d.data().text;
  });
  return map;
}

// ── Guides (공략게시판) ──────────────────────────────────────────────

/**
 * scopeKeys — 공략 다중 공개 (크로스 포스팅). 예: ['global', 'guild:starfall', 'team:teamsad']
 * 글은 하나, 노출 스코프만 배열로 관리. 추천수는 공유되고 베스트3는 스코프별 산출.
 */
export async function createGuide({ zoneId, bossId, difficulty, title, body, links, author, scopeKeys }) {
  const ref = await addDoc(collection(db, 'guides'), {
    zoneId,
    bossId,
    scopeKeys: scopeKeys && scopeKeys.length ? scopeKeys : ['global'],
    difficulty: difficulty || null,
    title: title.trim(),
    body,
    links: links || [],
    authorId: author.uid,
    // 작성자 표기 = 대표 캐릭터 스냅샷 (클래스컬러 포함, 이후 변경돼도 유지)
    authorChar: author.charName,
    authorClassId: author.classId,
    authorClassColor: author.classColor,
    up: 0,
    down: 0,
    score: 0,
    rewardedMilestones: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 공략 투표 — 1인 1표, 변경/취소 가능, 익명 표시(표는 본인만 조회 가능).
 * up/down/score 카운터를 투표 문서와 원자적으로 갱신.
 * @param value 1(도움됨) | -1(도움 안 됨) | 0(취소)
 */
export async function voteGuide(guideId, uid, value) {
  await runTransaction(db, async (tx) => {
    const guideRef = doc(db, 'guides', guideId);
    const voteRef = doc(db, 'guides', guideId, 'votes', uid);
    const [guideSnap, voteSnap] = await Promise.all([tx.get(guideRef), tx.get(voteRef)]);
    if (!guideSnap.exists()) throw new Error('공략을 찾을 수 없습니다.');
    if (guideSnap.data().authorId === uid) throw new Error('본인 공략에는 투표할 수 없습니다.');

    const prev = voteSnap.exists() ? voteSnap.data().value : 0;
    if (prev === value) return; // 변화 없음

    let dUp = 0;
    let dDown = 0;
    if (prev === 1) dUp -= 1;
    if (prev === -1) dDown -= 1;
    if (value === 1) dUp += 1;
    if (value === -1) dDown += 1;

    if (value === 0) tx.delete(voteRef);
    else tx.set(voteRef, { value, at: serverTimestamp() });

    tx.update(guideRef, {
      up: increment(dUp),
      down: increment(dDown),
      score: increment(dUp - dDown),
    });
  });
}

/** 베스트 공략 3 — 순추천 상위 고정 노출용 */
export async function fetchBestGuides(zoneId, bossId, scopeKey = 'global', topN = 3) {
  const q = query(
    collection(db, 'guides'),
    where('scopeKeys', 'array-contains', scopeKey),
    where('zoneId', '==', zoneId),
    where('bossId', '==', bossId),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.score > 0);
}

/** 공략 목록 — sort: 'recent'(기본, 등록 최신순) | 'helpful'(도움순) */
export async function fetchGuides(zoneId, bossId, scopeKey = 'global', sort = 'recent', pageSize = 30) {
  const order = sort === 'helpful' ? orderBy('score', 'desc') : orderBy('createdAt', 'desc');
  const q = query(
    collection(db, 'guides'),
    where('scopeKeys', 'array-contains', scopeKey),
    where('zoneId', '==', zoneId),
    where('bossId', '==', bossId),
    order,
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function deleteGuide(guideId) {
  return deleteDoc(doc(db, 'guides', guideId));
}

// ── Points (읽기 전용 — 지급·차감은 Cloud Functions 전용) ────────────

export function subscribeWallet(uid, cb) {
  return onSnapshot(
    doc(db, 'wallets', uid),
    (snap) => cb(snap.exists() ? snap.data() : { balance: 0, lifetime: 0, streakWeeks: 0 }),
    () => cb(null)
  );
}

export async function fetchLedger(uid, pageSize = 20) {
  const q = query(
    collection(db, 'pointLedger'),
    where('uid', '==', uid),
    orderBy('at', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 일일 출석 체크 — 클라이언트는 출석 문서 생성만 담당.
 * 문서 ID(uid_YYYYMMDD)가 중복 방지 키이며, 포인트 지급은 Functions 트리거가 수행.
 */
export function requestDailyCheckin(uid, dateKey) {
  return setDoc(doc(db, 'dailyCheckins', `${uid}_${dateKey}`), {
    uid,
    dateKey,
    at: serverTimestamp(),
  });
}

// ── Guests (손님파티 전용) ───────────────────────────────────────────
// 공개 정보(guests: 캐릭명·서버·클래스·유형)와 업비(guestFees: 골드)를 문서 분리.
// Firestore는 필드 단위 보안이 불가능하므로, 업비 비공개 요구는 컬렉션 분리로 구현한다.
// 관리 권한(생성자+슈퍼)과 열람 범위는 firestore.rules가 강제.

export function subscribeGuests(raidId, cb) {
  return onSnapshot(
    collection(db, 'raids', raidId, 'guests'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

export function upsertGuest(raidId, guestId, data) {
  const ref = guestId
    ? doc(db, 'raids', raidId, 'guests', guestId)
    : doc(collection(db, 'raids', raidId, 'guests'));
  return setDoc(
    ref,
    {
      charName: data.charName,
      server: data.server,
      classId: data.classId, // 필수 — 시너지 힌트 직결
      className: data.className || null,
      classColor: data.classColor || null,
      guestType: data.guestType || null, // 깡/업적/탈것/주사위 등 (선택)
      party: data.party || null, // 시뮬레이터 배치용
      linkedUid: data.linkedUid || null, // BNet 연동 회원 손님(포인트 지급 대상)
      status: data.status || 'confirmed', // confirmed | applied(손님 지원, 승인 대기)
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function removeGuest(raidId, guestId) {
  // 업비 문서까지 함께 정리
  const batch = writeBatch(db);
  batch.delete(doc(db, 'raids', raidId, 'guests', guestId));
  batch.delete(doc(db, 'raids', raidId, 'guestFees', guestId));
  return batch.commit();
}

/** 업비 설정 — 생성자·슈퍼관리자만 (rules 강제) */
export function setGuestFee(raidId, guestId, gold) {
  return setDoc(doc(db, 'raids', raidId, 'guestFees', guestId), {
    gold: Number(gold) || 0,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeGuestFees(raidId, cb) {
  return onSnapshot(
    collection(db, 'raids', raidId, 'guestFees'),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data().gold;
      });
      cb(map);
    },
    () => cb({}) // 권한 없음(비공개) — 빈 맵
  );
}

/** 손님파티 → 일반 파티 전환 가드: 손님이 남아 있으면 에러 */
export async function assertNoGuests(raidId) {
  const snap = await getDocs(collection(db, 'raids', raidId, 'guests'));
  if (!snap.empty) {
    throw new Error('손님이 남아 있습니다. 손님을 제거하거나 일반 공대원으로 변경해주세요.');
  }
}

// ── 정규 로스터 (정공) ───────────────────────────────────────────────

export function saveTeamRoster(teamId, roster) {
  return updateDoc(doc(db, 'teams', teamId), { roster, rosterUpdatedAt: serverTimestamp() });
}

// ── 플랫폼 부트스트랩 (최초 1회 — meta/super 없을 때만 규칙이 허용) ──

export async function bootstrapPlatformOwner(uid) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'memberships', `${uid}_platform_platform`), {
    uid,
    scopeType: 'platform',
    scopeId: 'platform',
    role: 'owner',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'meta', 'super'), { uid, createdAt: serverTimestamp() });
  await batch.commit();
}

export async function isBootstrapped() {
  const snap = await getDoc(doc(db, 'meta', 'super'));
  return snap.exists();
}
