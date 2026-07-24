// WANION Cloud Functions — P2
//  onDailyCheckin: 일일 출석 포인트 지급 (+config/points.daily, KST 02:00 경계, 멱등)
//
// 배포: functions 폴더에서 npm install 후 프로젝트 루트에서
//   firebase deploy --only functions
// 요구: Blaze 요금제 (무료 호출 한도 내 운영 — 사양 '운영비 0원' 설계 준수)
//
// 참고: 한길련 병합 브릿지(claimLegacy)는 260723 대표님 결정으로 폐기 —
// 완전 새출발 전략 (전원 BNet 재가입, 직책은 관리자 콘솔 수동 임명).

// ★ 전역 옵션(리전·maxInstances)을 함수 모듈 import보다 먼저 적용 — 반드시 최상단.
import './globalOpts.js';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { BLIZZ_CLASSES } from './gamedata.js';
import {
  discordInteractions,
  onRaidWritten,
  discordCreateLinkCode,
} from './discord/index.js';
import {
  onOrgApplicationDecided,
  onRaidFixedNotify,
  onAppPromoted,
  onMembershipRoleChanged,
} from './notifications.js';
import {
  refreshMyProgress,
  scheduledProgressDaily,
  scheduledProgressEvening,
} from './progressJobs.js';
import { verifyGuildNow, scheduledGuildVerify } from './bnetVerify.js';
import { refreshTeamWclReport } from './wcl.js';

// 전역 옵션은 ./globalOpts.js에서 이미 설정됨 (import 시점).

initializeApp();
const db = getFirestore();

// ── Discord 봇 (와니온봇) — 구현은 functions/discord/*, 여기서는 재수출만 ──
export { discordInteractions, onRaidWritten, discordCreateLinkCode };
// ── 알림 센터 트리거 — 구현은 functions/notifications.js ──
export { onOrgApplicationDecided, onRaidFixedNotify, onAppPromoted, onMembershipRoleChanged };
// ── 프로필 진도 갱신 — 구현은 functions/progressJobs.js ──
export { refreshMyProgress, scheduledProgressDaily, scheduledProgressEvening };
// ── BNet 상시 로스터 검증 — 구현은 functions/bnetVerify.js ──
export { verifyGuildNow, scheduledGuildVerify };
// ── WCL 정공 리포트 — 구현은 functions/wcl.js ──
export { refreshTeamWclReport };

// ── Battle.net OAuth (P2-2) ──────────────────────────────────────────
// 콜백 = Functions 고정 주소 (사이트 도메인 변경에 면역 — 설계 결정).
// 배틀넷 개발자 포털의 Redirect URL에 BNET_CALLBACK_URL 등록 필요.

const BNET_CLIENT_ID = 'e08ef14078334fe2b1bade0cc1c5b152'; // 공개 식별자
const BNET_CLIENT_SECRET = defineSecret('BNET_CLIENT_SECRET');
const SITE_ORIGIN = 'https://woojehong.github.io/wanion'; // wanion.site 이전 시 교체
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'raidkorea-f34c9';
const BNET_CALLBACK_URL = `https://asia-northeast3-${PROJECT_ID}.cloudfunctions.net/bnetCallback`;
const STATE_TTL_MS = 10 * 60 * 1000;

// BLIZZ_CLASSES는 ./gamedata.js에서 import (디스코드 봇과 단일 소스 공유).

/** 연동 시작 — 1회용 state 발급 + 인가 URL 반환 (웹이 리다이렉트) */
export const bnetStartLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const state = randomUUID().replace(/-/g, '');
  await db.doc(`bnetStates/${state}`).set({ uid, createdAt: Date.now() });
  const url =
    'https://oauth.battle.net/authorize' +
    `?client_id=${BNET_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(BNET_CALLBACK_URL)}` +
    '&response_type=code&scope=wow.profile' +
    `&state=${state}`;
  return { url };
});

function redirectToSite(res, params) {
  const q = new URLSearchParams(params).toString();
  res.redirect(302, `${SITE_ORIGIN}/#/me?${q}`);
}

/** OAuth 콜백 — 토큰 교환 → 프로필 조회 → 만렙 캐릭터 전원 자동 등록 (사양 §4) */
export const bnetCallback = onRequest({ secrets: [BNET_CLIENT_SECRET] }, async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return redirectToSite(res, { bnet: 'error', reason: 'missing-params' });

    // 1) state 검증 (1회용 · 10분 TTL)
    const stateRef = db.doc(`bnetStates/${state}`);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) return redirectToSite(res, { bnet: 'error', reason: 'state' });
    const { uid, createdAt } = stateSnap.data();
    await stateRef.delete();
    if (Date.now() - createdAt > STATE_TTL_MS) {
      return redirectToSite(res, { bnet: 'error', reason: 'expired' });
    }

    // 2) 토큰 교환
    const basic = Buffer.from(`${BNET_CLIENT_ID}:${BNET_CLIENT_SECRET.value()}`).toString('base64');
    const tokenRes = await fetch('https://oauth.battle.net/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: BNET_CALLBACK_URL,
      }),
    });
    if (!tokenRes.ok) return redirectToSite(res, { bnet: 'error', reason: 'token' });
    const { access_token: accessToken } = await tokenRes.json();

    // 3) 계정 정보 (battletag + 계정 고유 id)
    const userRes = await fetch('https://oauth.battle.net/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return redirectToSite(res, { bnet: 'error', reason: 'userinfo' });
    const { sub: bnetSub, battletag } = await userRes.json();

    // 4) 한 배틀넷 계정 = 한 와니온 계정 (부계정 어뷰징 1차 방어)
    const linkRef = db.doc(`bnetLinks/${bnetSub}`);
    const linkSnap = await linkRef.get();
    if (linkSnap.exists && linkSnap.data().uid !== uid) {
      return redirectToSite(res, { bnet: 'error', reason: 'already-linked' });
    }

    // 5) WoW 프로필 — 만렙 캐릭터만 전원 자동 등록 (선택제 아님 — 사양 §4 확정)
    const profRes = await fetch(
      'https://kr.api.blizzard.com/profile/user/wow?namespace=profile-kr&locale=ko_KR',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!profRes.ok) return redirectToSite(res, { bnet: 'error', reason: 'profile' });
    const prof = await profRes.json();

    const maxLevel = Number((await db.doc('config/game').get()).data()?.maxLevel) || 90;
    // 만렙 캐릭터가 하나라도 있으면 만렙만 등록, 하나도 없으면 전체 등록(만렙여부 표기).
    // → 만렙 0개 계정도 대표 캐릭터를 지정할 수 있게(경고와 함께). 신청은 만렙만 허용.
    const allChars = (prof.wow_accounts || []).flatMap((a) => a.characters || []);
    const maxChars = allChars.filter((c) => (c.level || 0) >= maxLevel);
    const source = maxChars.length ? maxChars : allChars;
    const chars = source.map((c) => {
      const cls = BLIZZ_CLASSES[c.playable_class?.id] || null;
      const level = c.level || 0;
      return {
        docId: `${c.realm?.slug || 'unknown'}-${String(c.name || '').toLowerCase()}`,
        name: c.name,
        realm: c.realm?.name || c.realm?.slug || '',
        realmSlug: c.realm?.slug || '',
        level,
        isMax: level >= maxLevel,
        classId: cls?.id || null,
        className: cls?.name || null,
        classColor: cls?.color || null,
        bnetCharId: c.id || null,
      };
    });

    // 6) 기록 — 캐릭터는 전량 교체(탈퇴·삭제 캐릭 잔재 방지)
    const charCol = db.collection(`users/${uid}/characters`);
    const existing = await charCol.get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    chars.forEach(({ docId, ...data }) => {
      batch.set(charCol.doc(docId), { ...data, verified: true, syncedAt: FieldValue.serverTimestamp() });
    });
    batch.set(linkRef, { uid, battletag, linkedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(
      db.doc(`users/${uid}`),
      {
        bnetLinked: true,
        battletag: battletag || null,
        bnetSyncedAt: FieldValue.serverTimestamp(),
        charCount: chars.length,
      },
      { merge: true }
    );
    await batch.commit();

    return redirectToSite(res, { bnet: 'linked', chars: String(chars.length) });
  } catch (e) {
    console.error('bnetCallback failed', e);
    return redirectToSite(res, { bnet: 'error', reason: 'internal' });
  }
});

// ── 일일 출석 포인트 ─────────────────────────────────────────────────

/** KST 02:00 리셋 기준의 dateKey (YYYYMMDD) — 클라이언트 계산식과 동일해야 함 */
function checkinDateKey(ms) {
  const shifted = new Date(ms + (9 - 2) * 3600 * 1000); // UTC+9(KST) − 2h(리셋 경계)
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export const onDailyCheckin = onDocumentCreated('dailyCheckins/{checkinId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const { uid, dateKey } = snap.data() || {};
  if (!uid || !dateKey || event.params.checkinId !== `${uid}_${dateKey}`) return;

  // 자정 직후 클럭 드리프트 허용: 이벤트 시각 기준 오늘 또는 5분 전 키만 유효
  const now = Date.now();
  if (dateKey !== checkinDateKey(now) && dateKey !== checkinDateKey(now - 5 * 60 * 1000)) {
    await snap.ref.set({ rejected: true, reason: 'invalid-dateKey' }, { merge: true });
    return;
  }

  const configSnap = await db.doc('config/points').get();
  const cfg = configSnap.data() || {};

  // ★ 포인트 전면 잠금 (시즌 시작 전) — config/points.enabled === true 일 때만 지급.
  // 대표님이 "시작!" 하기 전엔 출석을 기록만 하고 포인트는 일절 적립하지 않는다.
  // 활성화: config/points 문서에 { enabled: true } 설정 (관리자).
  if (cfg.enabled !== true) {
    await snap.ref.set({ paid: false, heldReason: 'season-not-started' }, { merge: true });
    return;
  }

  const amount = Number(cfg.daily) || 10;
  const season = Number(cfg.season) || 1;

  const ledgerRef = db.doc(`pointLedger/daily_${uid}_${dateKey}`);
  await db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return; // 멱등 — 재실행/중복 트리거 방어
    tx.set(ledgerRef, {
      uid,
      type: 'daily',
      amount,
      refId: dateKey,
      season,
      at: FieldValue.serverTimestamp(),
    });
    tx.set(
      db.doc(`wallets/${uid}`),
      {
        balance: FieldValue.increment(amount),
        lifetime: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
});
