// Discord Interactions 서명 검증 (Ed25519).
// Discord는 모든 인터랙션 요청에 X-Signature-Ed25519 / X-Signature-Timestamp 헤더를 실어 보내며,
// 애플리케이션 공개키로 (timestamp + rawBody)에 대한 서명을 검증해야 한다.
// 검증 실패 시 401을 돌려주지 않으면 Endpoint URL 등록 자체가 거부된다.
//
// node:crypto의 네이티브 Ed25519만 사용 (외부 의존성 0 — tweetnacl 불필요).

import { createPublicKey, verify as edVerify } from 'node:crypto';

// raw 32바이트 Ed25519 공개키를 SPKI(DER)로 감싸기 위한 고정 접두사.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function keyFromHex(hex) {
  const raw = Buffer.from(hex, 'hex');
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

/**
 * @param {object} p
 * @param {string} p.publicKey  애플리케이션 공개키(hex)
 * @param {string} p.signature  X-Signature-Ed25519 (hex)
 * @param {string} p.timestamp  X-Signature-Timestamp
 * @param {Buffer|string} p.rawBody  파싱 이전의 원본 요청 바디
 * @returns {boolean}
 */
export function verifyDiscordRequest({ publicKey, signature, timestamp, rawBody }) {
  if (!publicKey || !signature || !timestamp || rawBody == null) return false;
  try {
    const key = keyFromHex(publicKey);
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const message = Buffer.concat([Buffer.from(String(timestamp), 'utf8'), body]);
    const sig = Buffer.from(signature, 'hex');
    return edVerify(null, message, key, sig);
  } catch {
    return false;
  }
}
