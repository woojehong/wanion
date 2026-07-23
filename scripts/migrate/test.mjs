// transform.mjs 단위 테스트 — 픽스처 기반, 의존성 없음: node test.mjs
import assert from 'node:assert/strict';
import { transformAll, computeCounts, mapHost, normalizeRole } from './transform.mjs';

const source = {
  guilds: [
    { id: 'gyochaero', name: '교차로', color: '#f59e0b' },
    { id: 'ieyo', name: '이에요', color: '#f472b6' },
  ],
  users: [
    {
      id: 'user_master1',
      nickname: '새벽별',
      guildId: 'gyochaero',
      role: 'user',
      isGuildMaster: true,
      leaderCapable: true,
      characters: [{ name: '새벽별', classId: 'warrior', specId: 'wa_protection' }],
      mainCharIndex: 0,
    },
    { id: 'user_admin1', nickname: '달그림자', guildId: 'ieyo', role: 'admin', isGuildMaster: false, characters: [] },
    { id: 'user_plain1', nickname: '서리엄니', guildId: 'gyochaero', role: 'user', isGuildMaster: false, characters: [] },
    { id: 'user_noguild', nickname: '떠돌이', guildId: 'none', role: 'user', isGuildMaster: false, characters: [] },
  ],
  nicknames: [{ id: '새벽별', userId: 'user_master1', authEmail: 'u1@kgu.com' }],
  raids: [
    {
      id: 'raid_union',
      title: '연합 정기 공대',
      partyType: 'union',
      difficulty: 'mythic',
      apps: [
        { id: 'user_master1', role: 'tank', status: 'active' },
        { id: 'user_admin1', role: 'healer', status: 'active', swapRoles: ['healer', 'dps'] },
        { id: 'user_plain1', role: 'dps', status: 'wait' },
      ],
      memos: [{ id: 'user_master1', text: '오더 담당' }],
      cancels: [{ id: 'c1', userId: 'user_x', role: 'healer', reason: '개인 사정' }],
      logs: [],
    },
    {
      id: 'raid_guild',
      title: '교차로 길드런',
      partyType: 'gyochaero',
      difficulty: 'heroic',
      deleted: true,
      apps: [],
      memos: [],
      cancels: [],
      logs: [],
    },
    { id: 'raid_legacy', title: '옛 공대 (partyType 없음)', apps: [], memos: [], cancels: [], logs: [] },
    { id: 'raid_ghost', title: '유령 길드런', partyType: 'ghost-guild', apps: [], memos: [], cancels: [], logs: [] },
  ],
  posts: [
    {
      id: 'p1',
      category: 'notice',
      title: '공지',
      body: '내용',
      pinned: true,
      authorId: 'user_master1',
      authorNickname: '새벽별',
      authorGuildId: 'gyochaero',
      authorRole: 'user',
      authorIsMaster: true,
      commentCount: 1,
      comments: [{ id: 'c1', body: '답글', authorId: 'user_plain1', authorNickname: '서리엄니', authorRole: 'user' }],
    },
  ],
};

// ── 단위 ─────────────────────────────────────────────────────────────
assert.equal(normalizeRole('healer'), 'heal');
assert.equal(normalizeRole('tank'), 'tank');
assert.deepEqual(mapHost({ partyType: 'union' }, {}), { hostType: 'alliance', hostId: 'kwgu', hostName: '한길련' });
assert.deepEqual(mapHost({}, {}), { hostType: 'alliance', hostId: 'kwgu', hostName: '한길련' });
assert.deepEqual(
  computeCounts([
    { role: 'healer', status: 'active' },
    { role: 'heal', status: 'active' },
    { role: 'dps', status: 'wait' },
  ]),
  { tank: 0, heal: 2, dps: 0 }
);

// ── 통합 ─────────────────────────────────────────────────────────────
const t = transformAll(source);

// 레이드 host 매핑
const union = t.raids.find((r) => r.id === 'raid_union');
assert.equal(union.hostType, 'alliance');
assert.equal(union.hostName, '한길련');
assert.deepEqual(union.counts, { tank: 1, heal: 1, dps: 0 }); // wait 미포함, healer→heal
assert.equal(union.acceptMode, 'auto');
assert.equal(union.apps[1].role, 'heal');
assert.deepEqual(union.apps[1].swapRoles, ['heal', 'dps']);
assert.equal(union.cancels[0].role, 'heal');

const guildRaid = t.raids.find((r) => r.id === 'raid_guild');
assert.equal(guildRaid.hostType, 'guild');
assert.equal(guildRaid.hostName, '교차로');
assert.equal(guildRaid.deleted, true);

const legacy = t.raids.find((r) => r.id === 'raid_legacy');
assert.equal(legacy.hostType, 'alliance'); // partyType 없음 = union 규칙 계승

assert.equal(t.report.warnings.length, 1); // ghost-guild 경고
assert.match(t.report.warnings[0], /ghost-guild/);

// 유저 → legacyUsers + 멤버십 제안
const master = t.legacyUsers.find((u) => u.id === 'user_master1');
assert.deepEqual(master.suggestedMembership, { scopeType: 'guild', scopeId: 'gyochaero', role: 'master' });
assert.deepEqual(master.suggestedAllianceMembership, { scopeType: 'alliance', scopeId: 'kwgu', role: 'officer' });
assert.equal(master.claimedBy, null);
const admin = t.legacyUsers.find((u) => u.id === 'user_admin1');
assert.equal(admin.suggestedMembership.role, 'officer');
const plain = t.legacyUsers.find((u) => u.id === 'user_plain1');
assert.equal(plain.suggestedMembership.role, 'member');
const noguild = t.legacyUsers.find((u) => u.id === 'user_noguild');
assert.equal(noguild.suggestedMembership, null);

// 게시글 → 전체 게시판 스코프
const post = t.posts[0];
assert.equal(post.scopeType, 'global');
assert.equal(post.boardId, 'global');
assert.equal(post.scopeId, null);
assert.equal(post.authorName, '새벽별');
assert.equal(post.legacyAuthor, true);
assert.equal(post.authorNickname, undefined); // 구 필드 제거
assert.equal(post.comments[0].authorName, '서리엄니');

// 리포트 수치
assert.equal(t.report.counts.raids, 4);
assert.equal(t.report.counts.apps, 3);
assert.equal(t.report.memberships.master, 1);
assert.equal(t.report.memberships.officer, 1);
assert.equal(t.report.memberships.member, 1);
assert.equal(t.report.memberships.none, 1);
assert.equal(t.report.hostBreakdown.alliance, 2);
assert.equal(t.report.hostBreakdown.guild, 2);

console.log('transform.mjs — 모든 테스트 통과 (assertions OK)');
