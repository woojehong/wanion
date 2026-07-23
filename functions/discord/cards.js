// 레이드 카드보드 — 채널 자동 게시·실시간 갱신·삭제.
// onRaidWritten 트리거가 호출한다. 카드 메시지 id는 raids/{id}.discordCards 맵에 역기록하며,
// 그 역기록이 트리거를 재발화시켜 무한루프가 되지 않도록 discordCardSig(내용 서명) 가드를 둔다.

import { FieldValue } from 'firebase-admin/firestore';
import { postChannelMessage, editChannelMessage, deleteChannelMessage } from './api.js';
import { raidCardEmbed } from './embeds.js';

/** 카드 내용 서명 — 이 값이 바뀌면 카드 갱신이 필요하다는 뜻 */
export function cardSig(raid) {
  const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0);
  const c = raid.counts || {};
  return [
    raid.title,
    raid.difficulty,
    ms(raid.startAt),
    ms(raid.endAt),
    c.tank || 0,
    c.heal || 0,
    c.dps || 0,
    raid.fixed ? 1 : 0,
    raid.guestParty ? 1 : 0,
    raid.acceptMode,
    raid.minIlvl || 0,
    raid.hostName,
    raid.totalCap,
    raid.healerCap,
  ].join('|');
}

/** 이 레이드의 카드가 게시될 채널들 (호스트 스코프 + 전역 카드채널) */
export async function resolveCardChannels(db, raid) {
  const map = new Map(); // channelId → doc data
  const collect = (snap) => snap.docs.forEach((d) => map.set(d.id, { channelId: d.id, ...d.data() }));

  const queries = [
    db
      .collection('discordChannels')
      .where('kind', '==', 'cards')
      .where('scopeType', '==', raid.hostType)
      .where('scopeId', '==', raid.hostId)
      .get(),
    db.collection('discordChannels').where('kind', '==', 'cards').where('scopeType', '==', 'global').get(),
  ];
  const results = await Promise.all(queries.map((q) => q.catch(() => ({ docs: [] }))));
  results.forEach(collect);
  return [...map.values()];
}

async function deleteAllCards(token, discordCards) {
  const entries = Object.entries(discordCards || {});
  await Promise.all(
    entries.map(([channelId, messageId]) =>
      deleteChannelMessage(token, channelId, messageId).catch(() => {})
    )
  );
}

/**
 * 트리거 본체 — 생성/갱신/삭제에 따라 카드 동기화.
 * @param event onDocumentWritten 이벤트
 */
export async function syncRaidCards(db, token, event) {
  const raidId = event.params.raidId;
  const beforeSnap = event.data?.before;
  const afterSnap = event.data?.after;
  const before = beforeSnap?.exists ? beforeSnap.data() : null;
  const after = afterSnap?.exists ? afterSnap.data() : null;

  // 물리 삭제
  if (!after) {
    if (before?.discordCards) await deleteAllCards(token, before.discordCards);
    return;
  }

  // 소프트 삭제(deleted=true로 전환) → 카드 제거
  if (after.deleted) {
    if (!before?.deleted && after.discordCards && Object.keys(after.discordCards).length) {
      await deleteAllCards(token, after.discordCards);
      await afterSnap.ref.set(
        { discordCards: FieldValue.delete(), discordCardSig: FieldValue.delete() },
        { merge: true }
      );
    }
    return;
  }

  // 루프 가드: 우리가 방금 기록한 서명과 같으면(=내용 변화 없음) 아무 것도 안 함
  const sig = cardSig({ id: raidId, ...after });
  if (after.discordCardSig === sig) return;

  const channels = await resolveCardChannels(db, { id: raidId, ...after });
  const existing = after.discordCards || {};
  const nextCards = {};
  const embed = raidCardEmbed({ id: raidId, ...after });
  const payload = { embeds: [embed], allowed_mentions: { parse: [] } };

  for (const ch of channels) {
    const channelId = ch.channelId;
    const priorMsgId = existing[channelId];
    try {
      if (priorMsgId) {
        try {
          await editChannelMessage(token, channelId, priorMsgId, payload);
          nextCards[channelId] = priorMsgId;
        } catch (e) {
          // 메시지가 지워졌으면 재게시
          if (e.status === 404) {
            const msg = await postChannelMessage(token, channelId, payload);
            nextCards[channelId] = msg.id;
          } else {
            nextCards[channelId] = priorMsgId; // 일시 오류 — 기존 id 유지
          }
        }
      } else {
        const msg = await postChannelMessage(token, channelId, payload);
        nextCards[channelId] = msg.id;
      }
    } catch (e) {
      console.error(`card sync failed for channel ${channelId}:`, e.message);
    }
  }

  // 바인딩이 사라진 채널의 과거 카드 정리
  for (const [channelId, msgId] of Object.entries(existing)) {
    if (!nextCards[channelId]) {
      await deleteChannelMessage(token, channelId, msgId).catch(() => {});
    }
  }

  await afterSnap.ref.set({ discordCards: nextCards, discordCardSig: sig }, { merge: true });
}
