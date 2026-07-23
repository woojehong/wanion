// WANION mock dataset — 초안 프로토타입 전용.
// Firebase 이식 시 이 파일의 shape이 Firestore 문서 스키마의 기준이 된다.

export const ALLIANCE = {
  id: 'kwgu',
  name: '한길련',
  nameEn: 'KOREAN WOW GUILD UNION',
  desc: '4개 길드가 함께 굴리는 연합 레이드',
  founded: '2025.11',
};

export const GUILDS = [
  { id: 'wowfactory', name: '와우팩토리', server: '아즈샤라', alliance: 'kwgu', members: 35, verified: true, recruiting: false, avgIlvl: 279, founded: '2020.03' },
  { id: 'gyocharo', name: '교차로', server: '아즈샤라', alliance: 'kwgu', members: 42, verified: true, recruiting: true, avgIlvl: 282, founded: '2019.07' },
  { id: 'eyeyo', name: '이에요', server: '아즈샤라', alliance: 'kwgu', members: 28, verified: true, recruiting: true, avgIlvl: 277, founded: '2022.01' },
  { id: 'starfall', name: '스타폴', server: '아즈샤라', alliance: 'kwgu', members: 42, verified: true, recruiting: true, avgIlvl: 281, founded: '2023.11' },
  { id: 'dogs', name: '두부킴의유기견들', server: '아즈샤라', alliance: null, members: 23, verified: true, recruiting: false, avgIlvl: 284, founded: '2024.05' },
];

export const TEAMS = [
  {
    id: 'teamsad',
    name: 'TeamSAD',
    server: '아즈샤라',
    baseGuild: 'dogs',
    members: 18,
    recruiting: { dps: 2 },
    schedule: '격주 토 20:00–24:00',
    progress: { raid: '공허첨탑', difficulty: '신화', killed: 5, total: 8, lastKill: '무너지는 회랑', lastKillDate: '7/20', rankKr: '상위 12%' },
    stats: { tries: 187, attendance: 94, avgParse: 89.1 },
    bosses: [
      { name: '굶주린 어둠', date: '6/29' },
      { name: '속삭이는 심연', date: '7/4' },
      { name: '별삼킨 자', date: '7/8' },
      { name: '침묵의 대주교', date: '7/13' },
      { name: '무너지는 회랑', date: '7/20' },
      { name: '공허의 목소리', date: null },
      { name: '쌍둥이 공허군주', date: null },
      { name: '종막의 인도자', date: null },
    ],
  },
];

// status: recruiting | fixed | closed | done
export const RAIDS = [
  {
    id: 'r1',
    title: '공허첨탑 정기 공대',
    hostType: 'alliance',
    hostId: 'kwgu',
    hostName: '한길련 연합',
    leader: '후제킴',
    leaderNoGuild: false,
    difficulty: '신화',
    date: '2026-07-23',
    day: '목',
    time: '20:00–23:00',
    minIlvl: null,
    caps: { tank: 2, heal: 4, dps: 14 },
    counts: { tank: 0, heal: 0, dps: 2 },
    dday: 1,
    status: 'recruiting',
    desc: '연합 정기 공대입니다. 첫 참여자 환영, 오리엔테이션 19:40.',
  },
  {
    id: 'r2',
    title: '공허첨탑 신화 격주 트라이',
    hostType: 'team',
    hostId: 'teamsad',
    hostName: 'TeamSAD',
    leader: '두부킴',
    leaderNoGuild: false,
    difficulty: '신화',
    date: '2026-07-25',
    day: '토',
    time: '20:00–24:00',
    minIlvl: 285,
    caps: { tank: 2, heal: 4, dps: 14 },
    counts: { tank: 2, heal: 3, dps: 6 },
    dday: 3,
    status: 'recruiting',
    desc: '6넴 공허의 목소리 트라이. 오더 숙지 필수, 물약 지원.',
  },
  {
    id: 'r3',
    title: '주말 영웅 소프트런 — 초보 환영',
    hostType: 'user',
    hostId: 'nightcrow',
    hostName: '밤까마귀',
    leader: '밤까마귀',
    leaderNoGuild: true,
    difficulty: '영웅',
    date: '2026-07-26',
    day: '일',
    time: '14:00–17:00',
    minIlvl: 270,
    caps: { tank: 2, heal: 4, dps: 14 },
    counts: { tank: 1, heal: 2, dps: 5 },
    dday: 4,
    status: 'recruiting',
    desc: '느긋하게 트는 영웅 소프트런. 초보·복귀 유저 환영합니다.',
  },
  {
    id: 'r4',
    title: '교차로 길드 정기공대',
    hostType: 'guild',
    hostId: 'gyocharo',
    hostName: '교차로',
    leader: '신들바람',
    leaderNoGuild: false,
    difficulty: '영웅',
    date: '2026-07-22',
    day: '수',
    time: '21:00–24:00',
    minIlvl: null,
    caps: { tank: 2, heal: 4, dps: 14 },
    counts: { tank: 2, heal: 4, dps: 14 },
    dday: 0,
    status: 'closed',
    desc: '길드원 전용.',
  },
  {
    id: 'r5',
    title: '스타폴 신입 트라이',
    hostType: 'guild',
    hostId: 'starfall',
    hostName: '스타폴',
    leader: '새벽별',
    leaderNoGuild: false,
    difficulty: '영웅',
    date: '2026-08-01',
    day: '토',
    time: '20:00–23:00',
    minIlvl: null,
    caps: { tank: 2, heal: 4, dps: 14 },
    counts: { tank: 0, heal: 1, dps: 3 },
    dday: 10,
    status: 'recruiting',
    desc: '신입 길드원 합류 기념 트라이. 신입 환영.',
  },
];

export const ROSTER_SAMPLE = [
  { name: '어둠속삭임', cls: '흑마법사', color: '#8788EE', spec: '고통', ilvl: 489, role: 'dps', confirmed: true },
  { name: '돌진하는소', cls: '전사', color: '#C69B6D', spec: '무기', ilvl: 485, role: 'dps', confirmed: true },
];

export const ME = {
  id: 'hooje',
  name: '후제',
  joined: '2026.07',
  roles: ['플랫폼 운영자', '무소속 공대장'],
  connections: { google: 'hwj.***@gmail.com', discord: '후제#0722', bnet: { linked: true, syncedAt: '09:12', chars: 3 }, wcl: null },
  characters: [
    { name: '후제킴', cls: '흑마법사', color: '#8788EE', spec: '고통', ilvl: 285, level: 90, guild: 'dogs', guildName: '두부킴의유기견들', verified: true, main: true },
    { name: '후제딜', cls: '사냥꾼', color: '#AAD372', spec: '야수', ilvl: 281, level: 90, guild: 'starfall', guildName: '스타폴', verified: true, main: false },
    { name: '후제탱', cls: '전사', color: '#C69B6D', spec: '방어', ilvl: 278, level: 90, guild: null, guildName: '무소속(미등록 길드)', verified: false, main: false },
  ],
  memberships: [
    { scope: 'GUILD', name: '두부킴의유기견들', role: '길드 마스터' },
    { scope: 'ALLIANCE', name: '한길련', role: '연합 운영진' },
    { scope: 'TEAM', name: 'TeamSAD', role: '공대장' },
  ],
  points: {
    balance: 1250,
    lifetime: 4850,
    weeklyEarned: 2,
    weeklyCap: 3,
    streakWeeks: 7,
    tier: { name: '백부장', next: '천부장', progress: 4850, nextAt: 6000 },
    ledger: [
      { date: '7/20', label: '공허첨탑 신화 출석', amount: 100 },
      { date: '7/18', label: '상점 · 칭호 「공허를 걷는 자」', amount: -400 },
      { date: '7/16', label: '공허첨탑 영웅 출석', amount: 100 },
      { date: '7/9', label: '노쇼 벌점 (관리자 확정)', amount: -300 },
    ],
  },
};

export const WEEK = [
  { d: 19, day: '일' },
  { d: 20, day: '월' },
  { d: 21, day: '화' },
  { d: 22, day: '수', today: true },
  { d: 23, day: '목', event: true },
  { d: 24, day: '금' },
  { d: 25, day: '토', event: true },
];

export const DIFF_COLOR = { 신화: 'text-violet-hi', 영웅: 'text-sub', 일반: 'text-mute' };

export function guildById(id) {
  return GUILDS.find((g) => g.id === id) || null;
}
export function teamById(id) {
  return TEAMS.find((t) => t.id === id) || null;
}
export function raidById(id) {
  return RAIDS.find((r) => r.id === id) || null;
}
