// WANION ↔ 인게임 애드온 브릿지 — 코드 문자열 생성/파싱.
// 서버 통신 없이 복사·붙여넣기로만 오가는 설계 (정책 안전).
// 애드온(P4)의 /wanion invite · /wanion sort · /wanion snap 이 이 포맷을 소비한다.
//
// 포맷:
//   초대  : WANION1;INV;<raidId>;<이름-서버:역할[:파티]>,... ;<체크섬>
//   배치  : WANION1;SORT;<raidId>;<이름-서버:파티번호>,... ;<체크섬>
//   스냅샷: WANIONSNAP1;<raidId>;<이름-서버>,... ;<체크섬>   (게임 → 웹)

const VERSION = 'WANION1';
const SNAP_VERSION = 'WANIONSNAP1';
const ROLE_CODE = { tank: 'T', heal: 'H', dps: 'D' };
const CODE_ROLE = { T: 'tank', H: 'heal', D: 'dps' };

/** 간단 체크섬 — 붙여넣기 훼손 감지용 (보안 목적 아님) */
export function checksum(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i += 1) {
    sum = (sum * 31 + payload.charCodeAt(i)) % 1679615; // 36^4 - 1
  }
  return sum.toString(36).padStart(4, '0');
}

function joinCode(parts) {
  const payload = parts.join(';');
  return `${payload};${checksum(payload)}`;
}

function member(app) {
  const server = app.server || '아즈샤라';
  return `${app.charName || app.nickname}-${server}`;
}

/**
 * [인게임 초대 코드 복사] — 픽스(확정) 멤버 명단.
 * @param raidId  레이드 문서 ID
 * @param apps    status==='active' 인 신청 목록
 * @param parties 선택: { [appId]: 파티번호(1~4) } (시뮬레이터 배치 확정 시)
 */
export function buildInviteCode(raidId, apps, parties = {}) {
  const list = apps
    .map((a) => {
      const base = `${member(a)}:${ROLE_CODE[a.role] || 'D'}`;
      const p = parties[a.id];
      return p ? `${base}:${p}` : base;
    })
    .join(',');
  return joinCode([VERSION, 'INV', raidId, list]);
}

/**
 * [인게임 배치 코드 복사] — 시뮬레이터의 1~4파티 배치.
 * @param assignment { 파티번호: app[] } 형태 (시뮬레이터 상태)
 */
export function buildSortCode(raidId, assignment) {
  const entries = [];
  Object.entries(assignment).forEach(([party, members]) => {
    (members || []).forEach((a) => entries.push(`${member(a)}:${party}`));
  });
  return joinCode([VERSION, 'SORT', raidId, entries.join(',')]);
}

/** 애드온이 뱉은 출석 스냅샷 코드 파싱 (웹에 붙여넣기 → 픽스 명단 대조) */
export function parseSnapshotCode(raw) {
  const trimmed = (raw || '').trim();
  const lastSep = trimmed.lastIndexOf(';');
  if (lastSep < 0) return { ok: false, error: '형식이 아닙니다.' };
  const payload = trimmed.slice(0, lastSep);
  const chk = trimmed.slice(lastSep + 1);
  if (checksum(payload) !== chk) return { ok: false, error: '코드가 손상되었습니다. 다시 복사해주세요.' };
  const parts = payload.split(';');
  if (parts[0] !== SNAP_VERSION) return { ok: false, error: '스냅샷 코드가 아닙니다.' };
  const [, raidId, list] = parts;
  const names = (list || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { ok: true, raidId, names };
}

/** (참고용) 초대/배치 코드 파싱 — 애드온 쪽 Lua 구현의 기준 명세 */
export function parseBridgeCode(raw) {
  const trimmed = (raw || '').trim();
  const lastSep = trimmed.lastIndexOf(';');
  if (lastSep < 0) return { ok: false, error: '형식이 아닙니다.' };
  const payload = trimmed.slice(0, lastSep);
  const chk = trimmed.slice(lastSep + 1);
  if (checksum(payload) !== chk) return { ok: false, error: '코드가 손상되었습니다.' };
  const [version, mode, raidId, list] = payload.split(';');
  if (version !== VERSION) return { ok: false, error: '버전이 다릅니다.' };
  const entries = (list || '')
    .split(',')
    .filter(Boolean)
    .map((tok) => {
      const [nameServer, a, b] = tok.split(':');
      if (mode === 'SORT') return { nameServer, party: Number(a) || null };
      return { nameServer, role: CODE_ROLE[a] || 'dps', party: Number(b) || null };
    });
  return { ok: true, mode, raidId, entries };
}
