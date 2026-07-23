// 인터랙션 라우터 — 슬래시 명령 + 자동완성 처리.
// 서버리스 3초 제한 안에서 동기 응답한다(리전이 Firestore와 동일해 지연이 작음).
// 각 핸들러는 { type, data } 응답 객체를 반환하고, onRequest가 res.json으로 그대로 돌려준다.

import {
  InteractionType,
  InteractionResponseType,
  MessageFlags,
  raidUrl,
  myPageUrl,
} from './constants.js';
import { ROLE_LABEL, DIFF_LABEL } from '../gamedata.js';
import {
  resolveUid,
  linkByCode,
  canManageRaid,
  canBindScope,
  isPlatformAdmin,
  fetchMemberships,
} from './accounts.js';
import {
  fetchUpcomingRaids,
  fetchRaid,
  fetchCharacters,
  fetchCharacter,
  fetchMyApps,
  applyToRaid,
  cancelMyApplication,
  fetchActiveApps,
  fixRoster,
} from './raidOps.js';
import { scheduleEmbed, myAppsEmbed, profileEmbed, fmtDateTime } from './embeds.js';
import { postChannelMessage } from './api.js';
import { FieldValue } from 'firebase-admin/firestore';

const NOT_LINKED = `아직 계정 연동이 안 됐어요. 마이페이지에서 코드를 발급받아 \`/연동 <코드>\` 를 입력해주세요:\n${myPageUrl()}`;

// ── 응답 헬퍼 ────────────────────────────────────────────────────────
const R = InteractionResponseType;
function ephemeral(content) {
  return { type: R.CHANNEL_MESSAGE_WITH_SOURCE, data: { content, flags: MessageFlags.EPHEMERAL } };
}
function publicEmbed(embed) {
  return { type: R.CHANNEL_MESSAGE_WITH_SOURCE, data: { embeds: [embed] } };
}
function ephemeralEmbed(embed) {
  return { type: R.CHANNEL_MESSAGE_WITH_SOURCE, data: { embeds: [embed], flags: MessageFlags.EPHEMERAL } };
}
function autocomplete(choices) {
  return { type: R.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: choices.slice(0, 25) } };
}

// ── 인터랙션 파싱 ────────────────────────────────────────────────────
function getInvoker(interaction) {
  const u = interaction.member?.user || interaction.user;
  return { id: u?.id, username: u?.username || u?.global_name || null };
}
function optionMap(interaction) {
  const map = {};
  (interaction.data?.options || []).forEach((o) => {
    map[o.name] = o.value;
  });
  return map;
}
function focusedOption(interaction) {
  return (interaction.data?.options || []).find((o) => o.focused) || null;
}

function raidChoiceLabel(r) {
  const diff = DIFF_LABEL[r.difficulty] ? `[${DIFF_LABEL[r.difficulty]}] ` : '';
  const label = `${diff}${r.title} · ${fmtDateTime(r.startAt)}`;
  return label.length > 100 ? label.slice(0, 99) : label;
}

// ── 명령 핸들러 ──────────────────────────────────────────────────────

async function cmdLink(db, interaction) {
  const invoker = getInvoker(interaction);
  const opts = optionMap(interaction);
  const r = await linkByCode(db, {
    code: opts['코드'],
    discordUserId: invoker.id,
    discordUsername: invoker.username,
  });
  return ephemeral(
    r.ok
      ? `✅ 연동 완료 — **${r.displayName}** 님으로 연결됐어요! 이제 \`/신청\` \`/일정\` 을 쓸 수 있습니다.`
      : `❌ ${r.error}`
  );
}

async function cmdSchedule(db, interaction) {
  const opts = optionMap(interaction);
  const scope = opts['범위'] || 'all';
  let raids = await fetchUpcomingRaids(db, 15);
  let title = '다가오는 레이드';
  if (scope === 'mine') {
    const invoker = getInvoker(interaction);
    const uid = await resolveUid(db, invoker.id);
    if (!uid) return ephemeral(NOT_LINKED);
    const ms = await fetchMemberships(db, uid);
    const scopes = new Set(ms.map((m) => `${m.scopeType}:${m.scopeId}`));
    raids = raids.filter(
      (r) => scopes.has(`${r.hostType}:${r.hostId}`) || (r.hostType === 'user' && r.hostId === uid)
    );
    title = '내 공대 일정';
  }
  return ephemeralEmbed(scheduleEmbed(raids.slice(0, 10), title));
}

async function cmdMyApps(db, interaction) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return ephemeral(NOT_LINKED);
  const apps = (await fetchMyApps(db, uid)).slice(0, 20);
  const now = Date.now();
  const rows = [];
  for (const a of apps) {
    const raid = await fetchRaid(db, a.raidId);
    if (!raid || raid.deleted) continue;
    const endMs = raid.endAt?.toMillis ? raid.endAt.toMillis() : 0;
    if (endMs && endMs < now) continue;
    rows.push({ ...a, raidTitle: raid.title, startAt: raid.startAt });
  }
  rows.sort((x, y) => (x.startAt?.toMillis?.() || 0) - (y.startAt?.toMillis?.() || 0));
  return ephemeralEmbed(myAppsEmbed(rows));
}

async function cmdProfile(db, interaction) {
  const invoker = getInvoker(interaction);
  const opts = optionMap(interaction);
  const targetDiscordId = opts['유저'] || invoker.id;
  const isSelf = targetDiscordId === invoker.id;
  const uid = await resolveUid(db, targetDiscordId);
  if (!uid) return ephemeral(isSelf ? NOT_LINKED : '그 유저는 아직 와니온 계정을 연동하지 않았어요.');
  const [userSnap, walletSnap, memberships] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`wallets/${uid}`).get(),
    fetchMemberships(db, uid),
  ]);
  const user = userSnap.data() || {};
  const embed = profileEmbed({
    displayName: user.displayName,
    user,
    wallet: walletSnap.exists ? walletSnap.data() : null,
    memberships,
  });
  return publicEmbed(embed);
}

async function cmdApply(db, interaction) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return ephemeral(NOT_LINKED);
  const profileSnap = await db.doc(`users/${uid}`).get();
  const profile = profileSnap.data() || {};
  if (!profile.bnetLinked || !profile.mainCharId) {
    return ephemeral(
      `레이드 신청에는 Battle.net 연동과 대표 캐릭터 설정이 필요해요. 마이페이지에서 먼저 설정해주세요:\n${myPageUrl()}`
    );
  }
  const opts = optionMap(interaction);
  const raidId = opts['공대'];
  const charId = opts['캐릭터'];
  const role = opts['역할'];
  const bench = !!opts['벤치'];
  if (!['tank', 'heal', 'dps'].includes(role)) return ephemeral('역할을 다시 선택해주세요.');

  const raid = await fetchRaid(db, raidId);
  if (!raid || raid.deleted) return ephemeral('레이드를 찾을 수 없어요. `/일정` 에서 다시 확인해주세요.');
  if (raid.endAt?.toMillis && raid.endAt.toMillis() < Date.now()) return ephemeral('이미 종료된 레이드예요.');
  if (raid.minIlvl != null) {
    return ephemeral(
      `이 공대는 최소 템렙(${raid.minIlvl}+)이 있어 템렙 확인이 필요해요. 웹에서 신청해주세요:\n${raidUrl(raidId)}`
    );
  }
  const ch = await fetchCharacter(db, uid, charId);
  if (!ch) return ephemeral('캐릭터를 찾을 수 없어요. 자동완성 목록에서 골라주세요.');

  const appData = {
    userId: uid,
    nickname: profile.displayName || '',
    guildId: 'none',
    guildName: '무소속',
    guildColor: '#64748b',
    charName: ch.name,
    server: ch.realm || '아즈샤라',
    classId: ch.classId || null,
    className: ch.className || null,
    classColor: ch.classColor || null,
    specId: null,
    specName: ROLE_LABEL[role] || null,
    allSpecNames: [ROLE_LABEL[role]].filter(Boolean),
    role,
    range: null,
    ilvl: 0,
    leaderCapable: false,
    isGuildMaster: false,
    swap: false,
    swapRoles: [],
    seq: Date.now(),
    isReservation: false,
    via: 'discord',
  };
  const mode = bench ? 'bench' : raid.acceptMode === 'review' ? 'pending' : 'normal';
  try {
    const status = await applyToRaid(db, { raidId, uid, appData, mode });
    const label = { active: '✅ 확정', wait: '🕒 대기', bench: '🪑 벤치', pending: '📝 승인 대기' }[status] || status;
    return ephemeral(
      `${label} — **${raid.title}** 에 ${ROLE_LABEL[role]}(**${ch.name}**)로 신청됐어요.\n${raidUrl(raidId)}`
    );
  } catch (e) {
    return ephemeral(`❌ ${e.message || '신청에 실패했어요.'}`);
  }
}

async function cmdCancel(db, interaction) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return ephemeral(NOT_LINKED);
  const opts = optionMap(interaction);
  const r = await cancelMyApplication(db, { raidId: opts['공대'], uid, reason: '본인 취소 (디스코드)' });
  return ephemeral(
    r.cancelled ? '✅ 신청을 취소했어요.' : '취소할 신청이 없어요. (이미 취소됐거나 신청한 적 없음)'
  );
}

async function buildMentions(db, userIds) {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const parts = await Promise.all(
    uniq.map(async (uid) => {
      try {
        const s = await db.doc(`users/${uid}`).get();
        const did = s.exists ? s.data().discordId : null;
        return did ? `<@${did}>` : null;
      } catch {
        return null;
      }
    })
  );
  return parts.filter(Boolean).join(' ');
}

async function cmdFix(db, token, interaction) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return ephemeral(NOT_LINKED);
  const opts = optionMap(interaction);
  const raidId = opts['공대'];
  const raid = await fetchRaid(db, raidId);
  if (!raid || raid.deleted) return ephemeral('레이드를 찾을 수 없어요.');
  if (!(await canManageRaid(db, uid, raid))) return ephemeral('픽스는 공대장/관리자만 할 수 있어요.');
  const active = await fetchActiveApps(db, raidId);
  if (!active.length) return ephemeral('확정 인원이 없어 픽스할 수 없어요.');
  const ids = active.map((a) => a.id);
  await fixRoster(db, raidId, ids);

  // 출발 알림 — 확정 인원 멘션하여 명령 실행 채널에 공지
  if (interaction.channel_id) {
    const mentions = await buildMentions(db, active.map((a) => a.userId));
    const content = `🔒 **${raid.title}** 픽스 완료 — 출발 확정!\n집결 ${fmtDateTime(raid.startAt)} · 확정 ${ids.length}명\n${mentions}`.trim();
    await postChannelMessage(token, interaction.channel_id, {
      content,
      allowed_mentions: { parse: ['users'] },
    }).catch((e) => console.error('fix alert failed:', e.message));
  }
  return ephemeral(`✅ 픽스 완료 — 확정 ${ids.length}명. 채널에 출발 알림을 보냈어요.`);
}

async function cmdBindCardChannel(db, interaction) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return ephemeral(NOT_LINKED);
  if (!interaction.channel_id) return ephemeral('채널 안에서 실행해주세요.');
  const opts = optionMap(interaction);
  const [scopeType, scopeId] = String(opts['스코프'] || '').split(':');
  if (!scopeType || !scopeId) return ephemeral('스코프를 자동완성 목록에서 골라주세요.');
  if (!(await canBindScope(db, uid, scopeType, scopeId))) {
    return ephemeral('이 스코프의 카드채널을 설정할 권한이 없어요. (관리자/공대장 전용)');
  }
  await db.doc(`discordChannels/${interaction.channel_id}`).set({
    guildDiscordId: interaction.guild_id || null,
    scopeType,
    scopeId,
    kind: 'cards',
    boundBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ephemeral(
    '✅ 이 채널을 카드보드로 지정했어요. 앞으로 해당 스코프의 레이드가 이 채널에 자동 게시·갱신됩니다.'
  );
}

// ── 자동완성 ─────────────────────────────────────────────────────────

async function autocompleteRaid(db, query) {
  const raids = await fetchUpcomingRaids(db, 25);
  const q = String(query || '').trim().toLowerCase();
  const filtered = q ? raids.filter((r) => (r.title || '').toLowerCase().includes(q)) : raids;
  return autocomplete(filtered.map((r) => ({ name: raidChoiceLabel(r), value: r.id })));
}

async function autocompleteCharacter(db, interaction, query) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return autocomplete([]);
  const chars = await fetchCharacters(db, uid);
  const q = String(query || '').trim().toLowerCase();
  const filtered = q ? chars.filter((c) => (c.name || '').toLowerCase().includes(q)) : chars;
  return autocomplete(
    filtered.map((c) => ({
      name: `${c.name}${c.className ? ` · ${c.className}` : ''}${c.realm ? ` · ${c.realm}` : ''}`.slice(0, 100),
      value: c.id,
    }))
  );
}

async function autocompleteScope(db, interaction, query) {
  const invoker = getInvoker(interaction);
  const uid = await resolveUid(db, invoker.id);
  if (!uid) return autocomplete([]);
  const choices = [];
  const ROLE_ORG = { guild: '길드', team: '공대', alliance: '연합' };
  const ms = await fetchMemberships(db, uid);
  for (const m of ms) {
    const canBind =
      (m.scopeType === 'guild' && ['master', 'officer'].includes(m.role)) ||
      (m.scopeType === 'team' && ['leader', 'officer'].includes(m.role)) ||
      (m.scopeType === 'alliance' && m.role === 'officer');
    if (canBind) {
      choices.push({ name: `${ROLE_ORG[m.scopeType]} · ${m.orgName}`, value: `${m.scopeType}:${m.scopeId}` });
    }
  }
  if (await isPlatformAdmin(db, uid)) {
    choices.push({ name: '전역 (모든 레이드)', value: 'global:global' });
  }
  const q = String(query || '').trim().toLowerCase();
  const filtered = q ? choices.filter((c) => c.name.toLowerCase().includes(q)) : choices;
  return autocomplete(filtered);
}

async function handleAutocomplete(db, interaction) {
  const name = interaction.data?.name;
  const focused = focusedOption(interaction);
  if (!focused) return autocomplete([]);
  if ((name === '신청' || name === '취소' || name === '픽스') && focused.name === '공대') {
    return autocompleteRaid(db, focused.value);
  }
  if (name === '신청' && focused.name === '캐릭터') {
    return autocompleteCharacter(db, interaction, focused.value);
  }
  if (name === '카드채널' && focused.name === '스코프') {
    return autocompleteScope(db, interaction, focused.value);
  }
  return autocomplete([]);
}

// ── 최상위 라우터 ────────────────────────────────────────────────────
export async function routeInteraction(db, token, interaction) {
  if (interaction.type === InteractionType.PING) {
    return { type: InteractionResponseType.PONG };
  }
  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    return handleAutocomplete(db, interaction);
  }
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;
    switch (name) {
      case '연동':
        return cmdLink(db, interaction);
      case '일정':
        return cmdSchedule(db, interaction);
      case '내신청':
        return cmdMyApps(db, interaction);
      case '프로필':
        return cmdProfile(db, interaction);
      case '신청':
        return cmdApply(db, interaction);
      case '취소':
        return cmdCancel(db, interaction);
      case '픽스':
        return cmdFix(db, token, interaction);
      case '카드채널':
        return cmdBindCardChannel(db, interaction);
      default:
        return ephemeral('알 수 없는 명령이에요.');
    }
  }
  // MESSAGE_COMPONENT / MODAL_SUBMIT — v1 미사용, 조용히 확인만
  return { type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE };
}
