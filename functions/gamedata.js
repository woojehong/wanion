// WANION Cloud Functions — shared server-side game data (single source).
//
// 웹(src/lib/constants.js · utils.js)의 값과 반드시 동기 유지해야 하는 서버 사본.
// BNet 콜백·디스코드 봇이 이 파일 하나만 참조하도록 통합 (한길련 감사의 3중 복제 문제 재발 방지).

// Blizzard playable_class id → 와니온 게임데이터
export const BLIZZ_CLASSES = {
  1: { id: 'warrior', name: '전사', color: '#C69B6D' },
  2: { id: 'paladin', name: '성기사', color: '#F48CBA' },
  3: { id: 'hunter', name: '사냥꾼', color: '#AAD372' },
  4: { id: 'rogue', name: '도적', color: '#FFF468' },
  5: { id: 'priest', name: '사제', color: '#FFFFFF' },
  6: { id: 'deathknight', name: '죽음의 기사', color: '#C41E3A' },
  7: { id: 'shaman', name: '주술사', color: '#0070DD' },
  8: { id: 'mage', name: '마법사', color: '#3FC7EB' },
  9: { id: 'warlock', name: '흑마법사', color: '#8788EE' },
  10: { id: 'monk', name: '수도사', color: '#00FF98' },
  11: { id: 'druid', name: '드루이드', color: '#FF7C0A' },
  12: { id: 'demonhunter', name: '악마사냥꾼', color: '#A330C9' },
  13: { id: 'evoker', name: '기원사', color: '#33937F' },
};

// 난이도별 정원 (src/lib/constants.js DIFFICULTIES와 동일)
export const DIFFICULTIES = {
  normal: { totalCap: 30, defaultHealers: 6 },
  heroic: { totalCap: 30, defaultHealers: 6 },
  mythic: { totalCap: 20, defaultHealers: 4 },
};

export const TANK_CAP = 2;

/** 역할별 정원 계산 (src/lib/utils.js getCaps와 동일) */
export function getCaps(raid) {
  const diff = DIFFICULTIES[raid.difficulty];
  const totalCap = raid.totalCap ?? (diff ? diff.totalCap : 30);
  const healerCap = raid.healerCap ?? (diff ? diff.defaultHealers : 6);
  return {
    totalCap,
    tankCap: TANK_CAP,
    healerCap,
    dpsCap: Math.max(0, totalCap - TANK_CAP - healerCap),
  };
}

// 신청·counts·필터 체계는 'heal', 특성 데이터는 'healer' — 신청 생성 시 정규화 (utils.normalizeRole와 동일)
export function normalizeRole(role) {
  return role === 'healer' ? 'heal' : role;
}

// 역할 한글 표기 (딜러/힐러/탱커)
export const ROLE_LABEL = { tank: '탱커', heal: '힐러', dps: '딜러' };
export const ROLE_SHORT = { tank: '탱', heal: '힐', dps: '딜' };

// 난이도 한글·색 (임베드용)
export const DIFF_LABEL = { normal: '일반', heroic: '영웅', mythic: '신화' };
export const DIFF_COLOR = { normal: 0x9ca3af, heroic: 0x3b82f6, mythic: 0xfbbf24 };
