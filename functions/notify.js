// 알림 센터 — 알림 문서 생성 + (연동 유저 한정) 디스코드 DM.
// 알림은 Functions만 생성한다(클라이언트가 남의 알림을 위조할 수 없도록 rules로 강제).
// 웹 헤더 벨이 notifications/{uid}/items를 구독하고, 본인만 read 처리·삭제할 수 있다.

import { FieldValue } from 'firebase-admin/firestore';
import { sendDirectMessage } from './discord/api.js';
import { SITE_ORIGIN } from './discord/constants.js';

/**
 * 알림 1건 생성 (+ 연동 시 디코 DM).
 * @param uid 수신자 와니온 uid
 * @param payload { type, title, body, link }  link은 해시 경로(예: '/raid/abc')
 * @param opts { botToken } 있으면 discordId 보유 유저에게 DM 시도 (실패해도 알림은 남음)
 */
export async function createNotification(db, uid, { type, title, body, link }, opts = {}) {
  if (!uid || !title) return;
  const ref = db.collection(`notifications/${uid}/items`).doc();
  await ref.set({
    type,
    title,
    body: body || null,
    link: link || null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  const token = opts.botToken;
  if (!token) return;
  try {
    const snap = await db.doc(`users/${uid}`).get();
    const discordId = snap.exists ? snap.data().discordId : null;
    if (!discordId) return;
    const url = link ? (String(link).startsWith('http') ? link : `${SITE_ORIGIN}/#${link}`) : null;
    await sendDirectMessage(token, discordId, {
      embeds: [
        {
          title: `[와니온] ${title}`,
          description: [body, url].filter(Boolean).join('\n') || undefined,
          color: 0x8a70ff,
        },
      ],
    });
  } catch (e) {
    console.error('notification DM failed:', e.message);
  }
}
