// 포인트 경제 자동화 (사양 3) — ★ 전면 잠금 설계.
//
// config/points.enabled === true 일 때만 지급한다. 미설정/false면 아무 것도 안 함(무적립).
// 대표님이 "시작!" 하면 config/points 문서에 { enabled: true } 만 켜면 활성화된다.
//
// 신규 Cloud Run 함수를 만들지 않기 위해(리전 CPU 쿼터 보존), scheduledProgressDaily(매일 2시)가
// runDailyEconomy(db)를 호출하는 방식으로 흡수한다.

import { FieldValue } from 'firebase-admin/firestore';

// 포인트 수치 — 웹 src/lib/constants.js POINTS와 동기 유지
const P = {
  RAID_ATTEND: 100,
  WEEKLY_ATTEND_CAP: 3,
  LEADER_BONUS: 50,
  GUIDE_MILESTONES: [
    { score: 10, reward: 100 },
    { score: 30, reward: 200 },
    { score: 50, reward: 300 },
  ],
};

/** 와우 리셋(목 08:00 KST) 기준 주차 키 — 주간 출석 캡용 */
function raidWeekKey(ms) {
  const kst = ms + 9 * 3600 * 1000; // KST 벽시계
  const shifted = kst - 8 * 3600 * 1000; // 목 08:00 → 주 경계(1970-01-01은 목요일)
  const weeks = Math.floor(shifted / (7 * 24 * 3600 * 1000));
  return `w${weeks}`;
}

/** 지갑 적립 (원장 멱등 키로 중복 방지). 이미 지급된 refId면 스킵. */
async function credit(db, { uid, type, amount, ledgerId, refId, season, extra }) {
  const ledgerRef = db.doc(`pointLedger/${ledgerId}`);
  await db.runTransaction(async (tx) => {
    const led = await tx.get(ledgerRef);
    if (led.exists) return; // 멱등
    // 주간 출석 캡
    if (extra?.weekRef) {
      const wk = await tx.get(extra.weekRef);
      const count = wk.exists ? wk.data().count || 0 : 0;
      if (count >= P.WEEKLY_ATTEND_CAP) return; // 캡 초과 — 미지급
      tx.set(extra.weekRef, { uid, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    tx.set(ledgerRef, {
      uid,
      type,
      amount,
      refId: refId || null,
      season: season || 1,
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
}

/** 종료+픽스된 레이드의 출석/공대장 보너스 지급 */
async function awardAttendance(db, season) {
  const now = Date.now();
  const snap = await db
    .collection('raids')
    .where('deleted', '==', false)
    .where('endAt', '<', new Date())
    .orderBy('endAt', 'desc')
    .limit(200)
    .get();

  for (const d of snap.docs) {
    const r = d.data();
    if (!r.fixed || r.attendanceAwarded) continue;
    const ids = Array.isArray(r.fixedUserIds) ? r.fixedUserIds : [];
    const endMs = r.endAt?.toMillis ? r.endAt.toMillis() : now;
    const weekKey = raidWeekKey(endMs);

    for (const uid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await credit(db, {
        uid,
        type: 'attend',
        amount: P.RAID_ATTEND,
        ledgerId: `attend_${d.id}_${uid}`,
        refId: d.id,
        season,
        extra: { weekRef: db.doc(`weeklyAttendance/${uid}_${weekKey}`) },
      });
    }
    // 공대장 완주 보너스 (생성자)
    if (r.createdBy) {
      // eslint-disable-next-line no-await-in-loop
      await credit(db, {
        uid: r.createdBy,
        type: 'leader',
        amount: P.LEADER_BONUS,
        ledgerId: `leader_${d.id}`,
        refId: d.id,
        season,
      });
    }
    // eslint-disable-next-line no-await-in-loop
    await d.ref.set({ attendanceAwarded: true }, { merge: true });
  }
}

/** 공략 순추천 마일스톤 (10/30/50 → 100/200/300P, 1회성) */
async function awardGuideMilestones(db, season) {
  const snap = await db.collection('guides').where('score', '>=', P.GUIDE_MILESTONES[0].score).get();
  for (const g of snap.docs) {
    const guide = g.data();
    const rewarded = Array.isArray(guide.rewardedMilestones) ? guide.rewardedMilestones : [];
    for (const m of P.GUIDE_MILESTONES) {
      if ((guide.score || 0) >= m.score && !rewarded.includes(m.score)) {
        // eslint-disable-next-line no-await-in-loop
        await credit(db, {
          uid: guide.authorId,
          type: 'guide',
          amount: m.reward,
          ledgerId: `guide_${g.id}_${m.score}`,
          refId: g.id,
          season,
        });
        // eslint-disable-next-line no-await-in-loop
        await g.ref.set({ rewardedMilestones: FieldValue.arrayUnion(m.score) }, { merge: true });
      }
    }
  }
}

/**
 * 일일 경제 처리 — scheduledProgressDaily에서 호출.
 * ★ config/points.enabled !== true 면 즉시 종료(무적립).
 */
export async function runDailyEconomy(db) {
  const cfg = (await db.doc('config/points').get()).data() || {};
  if (cfg.enabled !== true) return { skipped: 'locked' }; // 시즌 시작 전 — 아무 것도 안 함
  const season = Number(cfg.season) || 1;
  await awardAttendance(db, season);
  await awardGuideMilestones(db, season);
  return { ok: true, season };
}
