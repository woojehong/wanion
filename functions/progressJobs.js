// 프로필 진도 갱신 함수 (사양 7.2):
//  - refreshMyProgress      : [지금 갱신] 수동 (10분 쿨다운)
//  - scheduledProgressDaily : 매일 KST 02:00 기준 갱신
//  - scheduledProgressEvening: 레이드 당일 저녁(20~23시) 스마트 갱신
// 스케줄 잡 2개 (무료 쿼터 3개 이내 — 0원 설계).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import {
  BNET_CLIENT_SECRET,
  computeUserProgress,
  writeUserProgress,
  refreshAllProgress,
  refreshCharacterLevel,
} from './progress.js';
import { runDailyEconomy } from './economy.js';

const REGION = 'asia-northeast3';
const COOLDOWN_MS = 10 * 60 * 1000;

function kstDateKey(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** [지금 갱신] — 본인 진도 즉시 갱신 (10분 쿨다운) */
export const refreshMyProgress = onCall(
  { region: REGION, secrets: [BNET_CLIENT_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const db = getFirestore();
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists || !snap.data().bnetLinked) {
      throw new HttpsError('failed-precondition', 'Battle.net 연동이 필요합니다.');
    }
    // 캐릭터 레벨 갱신 모드 — 만렙 아닌 캐릭터 옆 [갱신] 버튼 (진도 쿨다운과 무관)
    const charId = request.data?.charId;
    if (charId) {
      try {
        const character = await refreshCharacterLevel(db, uid, charId, BNET_CLIENT_SECRET.value());
        return { character };
      } catch (e) {
        throw new HttpsError('internal', e.message || '캐릭터 갱신에 실패했어요.');
      }
    }
    const last = snap.data().progressRefreshedAt || 0;
    const remain = COOLDOWN_MS - (Date.now() - last);
    if (remain > 0) {
      throw new HttpsError(
        'resource-exhausted',
        `너무 자주 갱신했어요. ${Math.ceil(remain / 60000)}분 후 다시 시도해주세요.`
      );
    }
    const prog = await computeUserProgress(db, uid, BNET_CLIENT_SECRET.value());
    await writeUserProgress(db, uid, prog, { manual: true });
    return { progress: prog && !prog.empty ? prog : null };
  }
);

/** 매일 KST 02:00 — 전원 진도 갱신 */
export const scheduledProgressDaily = onSchedule(
  { region: REGION, schedule: '0 2 * * *', timeZone: 'Asia/Seoul', secrets: [BNET_CLIENT_SECRET] },
  async () => {
    const db = getFirestore();
    const r = await refreshAllProgress(db, BNET_CLIENT_SECRET.value());
    console.log('daily progress refresh:', JSON.stringify(r));
    // 포인트 경제 처리(잠금 상태면 내부에서 즉시 종료 — 무적립). 신규 함수 없이 흡수.
    try {
      const e = await runDailyEconomy(db);
      console.log('daily economy:', JSON.stringify(e));
    } catch (err) {
      console.error('daily economy failed:', err.message);
    }
  }
);

/** 레이드 당일 저녁(20~23시 매시) 스마트 갱신 — 오늘 레이드 없으면 스킵 */
export const scheduledProgressEvening = onSchedule(
  {
    region: REGION,
    schedule: '0 20,21,22,23 * * *',
    timeZone: 'Asia/Seoul',
    secrets: [BNET_CLIENT_SECRET],
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    // 오늘(KST) 시작 레이드 존재 여부 — 기존 인덱스(deleted+endAt) 재사용
    const snap = await db
      .collection('raids')
      .where('deleted', '==', false)
      .where('endAt', '>', now)
      .orderBy('endAt', 'asc')
      .limit(50)
      .get();
    const todayKey = kstDateKey(now);
    const hasToday = snap.docs.some((d) => {
      const s = d.data().startAt;
      const dt = s?.toDate ? s.toDate() : null;
      return dt && kstDateKey(dt) === todayKey;
    });
    if (!hasToday) {
      console.log('evening progress: no raid today, skip');
      return;
    }
    const r = await refreshAllProgress(db, BNET_CLIENT_SECRET.value());
    console.log('evening progress refresh:', JSON.stringify(r));
  }
);
