// WANION (와니온) platform configuration — PUBLIC identifiers only.
// Secrets (client secrets, bot token) NEVER live here; they are stored in
// Firebase Functions Secrets (see docs/WANION_대표님_세팅_체크리스트.md §8).

export const OAUTH = {
  bnet: {
    clientId: 'e08ef14078334fe2b1bade0cc1c5b152', // registered 2026-07-22
    region: 'kr',
    scope: 'wow.profile',
    redirectPath: '/auth/bnet/callback',
  },
  discord: {
    clientId: '1529664610838511779', // registered 2026-07-23
    publicKey: '030c25727220ebcefad177736d2d8d6a9f0575925ae46c205596facb6a63016d',
    scope: 'identify',
    redirectPath: '/auth/discord/callback',
  },
  wcl: {
    clientId: '', // TODO: Warcraft Logs v2 client (대표님 등록 후)
    redirectPath: '/auth/wcl/callback',
  },
};

// firebaseConfig — public identifiers (safe to commit)
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBrkyh2fvepBDA6nzziX8iW1E-8U8m_xqY',
  authDomain: 'raidkorea-f34c9.firebaseapp.com',
  projectId: 'raidkorea-f34c9',
  storageBucket: 'raidkorea-f34c9.firebasestorage.app',
  messagingSenderId: '1089613716211',
  appId: '1:1089613716211:web:c088e91a9abd7812d5f586',
};

export const SITE = {
  // 임시 배포 주소. 플랫폼 이름·도메인 확정 시 이 값과 vite.config.js의 base만 교체
  origin: 'https://woojehong.github.io/wanion',
  name: 'WANION',
  nameKo: '와니온',
  madeBy: '후제공방',
};
