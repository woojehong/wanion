// WANION Cloud Functions — P2-1
//  1) claimLegacy   : 한길련(kgusystem) 계정 병합 브릿지 (닉네임+PIN 검증 → 멤버십 자동 부여)
//  2) onDailyCheckin: 일일 출석 포인트 지급 (+config/points.daily, KST 02:00 경계, 멱등)
//
// 배포: functions 폴더에서 npm install 후 프로젝트 루트에서
//   firebase deploy --only functions
// 요구: Blaze 요금제 (무료 호출 한도 내 운영 — 사양 '운영비 0원' 설계 준수)

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 5 });

initializeApp();
const db = getFirestore();

// ── 구(kgusystem) 프로젝트 공개 식별자 — 비밀 아님 (웹앱에 공개돼 있던 값) ──
const SOURCE_WEB_API_KEY = 'AIzaSyDiehFiW2DYbEYMb7JzgP7wuMPW7lIvklU';
const PIN_PAD_SUFFIX = '#KGU'; // kgu padPin 규약: 4자리 PIN + 고정 접미사

const GENERIC_FAIL = '닉네임 또는 PIN이 올바르지 않습니다.';
const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1시간

/** 구 프로젝트 Identity Toolkit으로 자격 증명 검증 (성공 = 본인 확인) */
async function verifyLegacyCredentials(authEmail, pin) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${SOURCE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authEmail,
        password: `${pin}${PIN_PAD_SUFFIX}`,
        returnSecureToken: false,
      }),
    }
  );
  return res.ok;
}

/** 브루트포스 방어 — uid당 1시간 5회 (kgu 감사에서 지적된 PIN 브루트포스 취약점의 서버측 해결) */
async function checkAttempts(uid) {
  const ref = db.doc(`claimAttempts/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.exists ? snap.data() : null;
    const fresh = !d || now - (d.firstAt || 0) > ATTEMPT_WINDOW_MS;
    const count = fresh ? 1 : (d.count || 0) + 1;
    tx.set(ref, { count, firstAt: fresh ? now : d.firstAt, lastAt: now });
    return count <= ATTEMPT_LIMIT;
  });
}

export const claimLegacy = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const nickname = String(request.data?.nickname || '').trim();
  const pin = String(request.data?.pin || '').trim();
  if (!nickname || !/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', '닉네임과 4자리 PIN을 입력해주세요.');
  }

  if (!(await checkAttempts(uid))) {
    throw new HttpsError('resource-exhausted', '시도 횟수를 초과했습니다 — 1시간 후 다시 시도해주세요.');
  }

  // 1) 레거시 닉네임 → 구 인증 이메일
  const nickSnap = await db.doc(`legacyNicknames/${nickname}`).get();
  if (!nickSnap.exists) throw new HttpsError('not-found', GENERIC_FAIL);
  const { userId: legacyId, authEmail } = nickSnap.data();

  // 2) 구 프로젝트에 PIN 대조 (실패 사유는 통합 메시지 — 계정 존재 여부 노출 금지)
  if (!authEmail || !(await verifyLegacyCredentials(authEmail, pin))) {
    throw new HttpsError('permission-denied', GENERIC_FAIL);
  }

  // 3) 병합 트랜잭션 — claim 기록 + 멤버십 부여 + 프로필 연결
  const legacyRef = db.doc(`legacyUsers/${legacyId}`);
  const granted = await db.runTransaction(async (tx) => {
    const legacySnap = await tx.get(legacyRef);
    if (!legacySnap.exists) throw new HttpsError('not-found', '이관된 계정 데이터가 없습니다 — 운영자에게 문의해주세요.');
    const legacy = legacySnap.data();
    if (legacy.claimedBy && legacy.claimedBy !== uid) {
      throw new HttpsError('already-exists', '이미 다른 계정과 병합된 닉네임입니다 — 운영자에게 문의해주세요.');
    }

    const grants = [];
    const suggestions = [legacy.suggestedMembership, legacy.suggestedAllianceMembership].filter(Boolean);
    for (const s of suggestions) {
      const mRef = db.doc(`memberships/${uid}_${s.scopeType}_${s.scopeId}`);
      const mSnap = await tx.get(mRef);
      if (!mSnap.exists) {
        tx.set(mRef, {
          uid,
          scopeType: s.scopeType,
          scopeId: s.scopeId,
          role: s.role,
          via: 'legacy-claim',
          createdAt: FieldValue.serverTimestamp(),
        });
        grants.push(s);
      }
    }

    tx.set(legacyRef, { claimedBy: uid, claimedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(
      db.doc(`users/${uid}`),
      {
        legacyId,
        legacyNickname: legacy.nickname || nickname,
        legacyCharacters: legacy.characters || [], // P3 BNet 동기화 전 참고용 스냅샷
      },
      { merge: true }
    );
    return grants;
  });

  return {
    ok: true,
    nickname,
    memberships: granted.map((g) => ({ scopeType: g.scopeType, scopeId: g.scopeId, role: g.role })),
  };
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
  const amount = Number(configSnap.data()?.daily) || 10;
  const season = Number(configSnap.data()?.season) || 1;

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
