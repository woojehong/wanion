// WANION ↔ 인게임 애드온 브릿지 — 코드 문자열 생성/파싱.
// 서버 통신 없이 복사·붙여넣기로만 오가는 설계 (정책 안전).
// 애드온(P4)의 /wanion invite · /wanion sort · /wanion snap 이 이 포맷을 소비한다.
//
// 포맷:
//   초대  : WANION1;INV;<raidId>;<이름-서버:역할[+스왑역할들][:파티]>,... ;<체크섬>
//           역할코드 T/H/D, 손님은 G. 스왑 예: T+HD = 메인 탱커, 힐·딜 전환 가능
//   배치  : WANION1;SORT;<raidId>;<이름-서버:파티번호>,... ;<체크섬>
//   스냅샷: WANIONSNAP1;<raidId>;<이름-서버>,... ;<체크섬>   (게임 → 웹)

const VERSION = 'WANION1';
const SNAP_VERSION = 'WANIONSNAP1';
const ROLE_CODE = { tank: 'T', heal: 'H', dps: 'D', guest: 'G' };
const CODE_ROLE = { T: 'tank', H: 'heal', D: 'dps', G: 'guest' };

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
 * [인게임 초대 코드 복사] — 픽스(확정) 멤버 + 손님 명단 (사양 7.1: 손님 포함이 핵심 목적).
 * @param raidId  레이드 문서 ID
 * @param apps    status==='active' 인 신청 목록 (a.swapRoles 있으면 스왑 정보 포함)
 * @param opts    { parties: { [appId | 'guest:'+guestId]: 파티번호 }, guests: [{id, charName, server}] }
 */
export function buildInviteCode(raidId, apps, opts = {}) {
  const { parties = {}, guests = [] } = opts;
  const tokens = apps.map((a) => {
    let roleSeg = ROLE_CODE[a.role] || 'D';
    if (a.swapRoles && a.swapRoles.length) {
      roleSeg += `+${a.swapRoles.map((r) => ROLE_CODE[r] || '').join('')}`;
    }
    const p = parties[a.id];
    return p ? `${member(a)}:${roleSeg}:${p}` : `${member(a)}:${roleSeg}`;
  });
  guests.forEach((g) => {
    const p = parties[`guest:${g.id}`];
    const base = `${member(g)}:G`;
    tokens.push(p ? `${base}:${p}` : base);
  });
  return joinCode([VERSION, 'INV', raidId, tokens.join(',')]);
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
      // 역할 세그먼트: "T" | "T+HD" (메인+스왑 가능 역할들)
      const [main, swapsRaw] = (a || 'D').split('+');
      const swapRoles = (swapsRaw || '')
        .split('')
        .map((c) => CODE_ROLE[c])
        .filter((r) => r && r !== 'guest');
      return { nameServer, role: CODE_ROLE[main] || 'dps', swapRoles, party: Number(b) || null };
    });
  return { ok: true, mode, raidId, entries };
}
