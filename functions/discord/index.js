// 와니온봇 Cloud Functions 배선.
//  - discordInteractions : Discord Interactions Endpoint (HTTP, 서명검증 후 라우팅)
//  - onRaidWritten       : 레이드 생성/변경/삭제 → 카드보드 동기화
//  - discordCreateLinkCode: 웹(마이페이지)에서 1회용 연동 코드 발급
//
// 리전은 각 함수 옵션에 명시한다. (main index.js의 setGlobalOptions보다 이 모듈이
// import 시점에 먼저 실행돼 전역 옵션을 못 받으므로, 명시 지정으로 asia-northeast3 보장)

import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

import { DISCORD_PUBLIC_KEY, InteractionResponseType } from './constants.js';
import { verifyDiscordRequest } from './verify.js';
import { routeInteraction } from './handlers.js';
import { syncRaidCards } from './cards.js';
import { createLinkCode } from './accounts.js';

const REGION = 'asia-northeast3';
export const DISCORD_BOT_TOKEN = defineSecret('DISCORD_BOT_TOKEN');

// initializeApp()은 main index.js 본문에서 실행되며, 아래 핸들러들은 요청 시점(그 이후)에만
// getFirestore()를 호출하므로 지연 획득으로 안전하다. (top-level 호출 금지)

/** Discord Interactions 엔드포인트 — 이 URL을 개발자 포털 Interactions Endpoint에 등록 */
export const discordInteractions = onRequest(
  { region: REGION, secrets: [DISCORD_BOT_TOKEN], maxInstances: 10, cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');
    const rawBody = req.rawBody; // firebase-functions가 제공하는 원본 바디 (서명 검증 필수)

    const valid = verifyDiscordRequest({
      publicKey: DISCORD_PUBLIC_KEY,
      signature,
      timestamp,
      rawBody,
    });
    if (!valid) {
      res.status(401).send('invalid request signature');
      return;
    }

    const interaction = req.body;
    try {
      const db = getFirestore();
      const response = await routeInteraction(db, DISCORD_BOT_TOKEN.value(), interaction);
      res.json(response);
    } catch (e) {
      console.error('discordInteractions failed:', e);
      // 3초 내 실패해도 사용자에게 최소 응답은 준다
      res.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '⚠️ 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', flags: 64 },
      });
    }
  }
);

/** 레이드 문서 변경 → 카드보드 동기화 (발행·갱신·삭제) */
export const onRaidWritten = onDocumentWritten(
  { region: REGION, document: 'raids/{raidId}', secrets: [DISCORD_BOT_TOKEN] },
  async (event) => {
    try {
      const db = getFirestore();
      await syncRaidCards(db, DISCORD_BOT_TOKEN.value(), event);
    } catch (e) {
      console.error('onRaidWritten failed:', e);
    }
  }
);

/** 마이페이지 → 1회용 디스코드 연동 코드 발급 */
export const discordCreateLinkCode = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const db = getFirestore();
  const code = await createLinkCode(db, uid);
  return { code };
});
