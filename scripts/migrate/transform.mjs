// WANION P1-7 — kgusystem(한길련) → 와니온 데이터 변환 (순수 로직, 테스트 가능)
//
// 입력(source): export 단계가 만든 JSON 묶음
//   { guilds:[{id,...}], users:[{id,...}], nicknames:[{id,...}],
//     raids:[{id,..., apps:[], memos:[], cancels:[], logs:[]}],
//     posts:[{id,..., comments:[]}] }
// 출력(target): 와니온 스키마 문서 묶음 + 리포트
//
// 원칙:
//  - 원본 필드는 verbatim 보존 + 와니온 필수 필드 오버레이 (비정규화 철학 계승)
//  - 레거시 유저는 legacyUsers 대기 컬렉션으로 — P2 병합 브릿지가 claim 시
//    suggestedMembership 대로 memberships를 부여한다 (kgu 폐기 항목: PIN 로그인)
//  - 역할 표기 정규화: 'healer' → 'heal' (와니온 counts·필터 체계)

export const ALLIANCE_ID = 'kwgu';
export const ALLIANCE_NAME = '한길련';

export function normalizeRole(role) {
  return role === 'healer' ? 'heal' : role;
}

function mapMembershipRole(user) {
  if (user.isGuildMaster) return 'master';
  if (user.role === 'admin') return 'officer';
  return 'member';
}

/** kgu partyType('union' | guildId | 없음) → 와니온 host 스코프 */
export function mapHost(raid, guildNameById) {
  const pt = raid.partyType;
  if (!pt || pt === 'union') {
    return { hostType: 'alliance', hostId: ALLIANCE_ID, hostName: ALLIANCE_NAME };
  }
  return { hostType: 'guild', hostId: pt, hostName: guildNameById[pt] || pt };
}

/** apps에서 확정 인원 counts 재계산 (마이그레이션 = counts 비정규화의 원천) */
export function computeCounts(apps) {
  const counts = { tank: 0, heal: 0, dps: 0 };
  (apps || []).forEach((a) => {
    if (a.status !== 'active') return;
    const r = normalizeRole(a.role);
    if (counts[r] != null) counts[r] += 1;
  });
  return counts;
}

function transformApp(app) {
  const out = { ...app, role: normalizeRole(app.role) };
  if (Array.isArray(app.swapRoles)) out.swapRoles = app.swapRoles.map(normalizeRole);
  return out;
}

function transformRaid(raid, guildNameById, warnings) {
  const host = mapHost(raid, guildNameById);
  if (host.hostType === 'guild' && !guildNameById[host.hostId]) {
    warnings.push(`raid ${raid.id}: 알 수 없는 길드 partyType='${raid.partyType}' — 이름 없이 이관`);
  }
  const apps = (raid.apps || []).map(transformApp);
  return {
    ...raid,
    ...host,
    counts: computeCounts(apps),
    acceptMode: raid.acceptMode || 'auto', // kgu는 전부 자동수락
    guestParty: false,
    feePublic: false,
    fixed: !!raid.fixed,
    deleted: !!raid.deleted,
    apps,
    memos: raid.memos || [],
    cancels: (raid.cancels || []).map((c) => ({ ...c, role: c.role ? normalizeRole(c.role) : c.role })),
    logs: raid.logs || [],
  };
}

function transformPost(post) {
  const { authorNickname, authorGuildId, authorRole, authorIsMaster, ...rest } = post;
  return {
    ...rest,
    boardId: 'global',
    scopeType: 'global',
    scopeId: null,
    category: post.category || 'free', // notice/free/recruit — 와니온 기본 카테고리와 동일 id
    authorName: authorNickname || '옛길드원',
    authorClassColor: null,
    pinned: !!post.pinned,
    commentCount: post.commentCount || 0,
    legacyAuthor: true, // authorId는 kgu 레거시 id — claim 병합 전까지 본인 수정 불가
    comments: (post.comments || []).map((c) => {
      const { authorNickname: cn, authorGuildId: cg, authorRole: cr, authorIsMaster: cm, ...crest } = c;
      return { ...crest, authorName: cn || '옛길드원', authorClassColor: null, legacyAuthor: true };
    }),
  };
}

function transformUser(user) {
  const membership =
    user.guildId && user.guildId !== 'none'
      ? { scopeType: 'guild', scopeId: user.guildId, role: mapMembershipRole(user) }
      : null;
  return {
    ...user,
    suggestedMembership: membership,
    // 창립 연합 소속 길드원은 연합 멤버십도 함께 제안 (한길련 = 창립연합)
    suggestedAllianceMembership:
      membership && user.isGuildMaster
        ? { scopeType: 'alliance', scopeId: ALLIANCE_ID, role: 'officer' }
        : null,
    claimedBy: null, // P2 병합 브릿지가 Google/BNet 계정 uid로 채움
  };
}

export function transformAll(source) {
  const warnings = [];
  const guildNameById = {};
  (source.guilds || []).forEach((g) => {
    guildNameById[g.id] = g.name;
  });

  const guilds = (source.guilds || []).map((g) => ({ ...g })); // 동일 id 체계 — merge 이관
  const legacyUsers = (source.users || []).map(transformUser);
  const legacyNicknames = (source.nicknames || []).map((n) => ({ ...n }));
  const raids = (source.raids || []).map((r) => transformRaid(r, guildNameById, warnings));
  const posts = (source.posts || []).map(transformPost);

  const report = {
    counts: {
      guilds: guilds.length,
      legacyUsers: legacyUsers.length,
      legacyNicknames: legacyNicknames.length,
      raids: raids.length,
      apps: raids.reduce((n, r) => n + r.apps.length, 0),
      memos: raids.reduce((n, r) => n + r.memos.length, 0),
      cancels: raids.reduce((n, r) => n + r.cancels.length, 0),
      logs: raids.reduce((n, r) => n + r.logs.length, 0),
      posts: posts.length,
      comments: posts.reduce((n, p) => n + p.comments.length, 0),
    },
    memberships: {
      master: legacyUsers.filter((u) => u.suggestedMembership?.role === 'master').length,
      officer: legacyUsers.filter((u) => u.suggestedMembership?.role === 'officer').length,
      member: legacyUsers.filter((u) => u.suggestedMembership?.role === 'member').length,
      none: legacyUsers.filter((u) => !u.suggestedMembership).length,
    },
    hostBreakdown: {
      alliance: raids.filter((r) => r.hostType === 'alliance').length,
      guild: raids.filter((r) => r.hostType === 'guild').length,
    },
    warnings,
  };

  return { guilds, legacyUsers, legacyNicknames, raids, posts, report };
}
