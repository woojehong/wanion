// WANION Cloud Functions — P2
//  onDailyCheckin: 일일 출석 포인트 지급 (+config/points.daily, KST 02:00 경계, 멱등)
//
// 배포: functions 폴더에서 npm install 후 프로젝트 루트에서
//   firebase deploy --only functions
// 요구: Blaze 요금제 (무료 호출 한도 내 운영 — 사양 '운영비 0원' 설계 준수)
//
// 참고: 한길련 병합 브릿지(claimLegacy)는 260723 대표님 결정으로 폐기 —
// 완전 새출발 전략 (전원 BNet 재가입, 직책은 관리자 콘솔 수동 임명).

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 5 });

initializeApp();
const db = getFirestore();

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
