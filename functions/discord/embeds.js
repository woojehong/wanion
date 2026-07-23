// 디스코드 임베드 빌더 — 레이드 카드보드 · /일정 · /프로필.
// 모든 시각은 KST(Asia/Seoul)로 표기 (서버는 UTC로 돌기 때문에 명시적 timeZone 필수).

import { getCaps, ROLE_SHORT, DIFF_LABEL, DIFF_COLOR } from '../gamedata.js';
import { raidUrl } from './constants.js';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** Firestore Timestamp | Date | ms → Date */
function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (v.seconds != null) return new Date(v.seconds * 1000);
  return null;
}

const kstParts = (d) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(d);
  const m = {};
  p.forEach((x) => (m[x.type] = x.value));
  return m;
};

/** "7/24 (목) 20:00" 형태 (KST) */
export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return '미정';
  const day = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const p = kstParts(d);
  return `${Number(p.month)}/${Number(p.day)} (${WEEKDAY[day.getDay()]}) ${p.hour}:${p.minute}`;
}

/** "20:00" 형태 (KST) */
export function fmtTime(v) {
  const d = toDate(v);
  if (!d) return '';
  const p = kstParts(d);
  return `${p.hour}:${p.minute}`;
}

const HOST_KO = { user: '개인', guild: '길드', team: '공대', alliance: '연합' };

/** 확정 인원 요약 문자열: "탱 2/2 · 힐 3/4 · 딜 9/14 (14/20)" */
export function countsLine(raid) {
  const caps = getCaps(raid);
  const c = raid.counts || { tank: 0, heal: 0, dps: 0 };
  const total = (c.tank || 0) + (c.heal || 0) + (c.dps || 0);
  return `탱 ${c.tank || 0}/${caps.tankCap} · 힐 ${c.heal || 0}/${caps.healerCap} · 딜 ${c.dps || 0}/${caps.dpsCap}  (${total}/${caps.totalCap})`;
}

/** 레이드 카드보드 임베드 (채널 자동 게시·갱신) */
export function raidCardEmbed(raid) {
  const diffKo = DIFF_LABEL[raid.difficulty] || raid.difficulty || '';
  const tags = [];
  if (raid.fixed) tags.push('🔒 픽스됨');
  if (raid.guestParty) tags.push('🚌 손님파티');
  if (raid.acceptMode === 'review') tags.push('📝 검토후수락');
  const fields = [
    { name: '일시', value: fmtDateTime(raid.startAt), inline: true },
    { name: '주최', value: `${HOST_KO[raid.hostType] || ''} ${raid.hostName || ''}`.trim() || '-', inline: true },
    { name: '난이도', value: diffKo, inline: true },
    { name: '모집 현황', value: countsLine(raid), inline: false },
  ];
  if (raid.minIlvl) fields.push({ name: '최소 템렙', value: `${raid.minIlvl}+`, inline: true });
  return {
    title: `${diffKo ? `[${diffKo}] ` : ''}${raid.title || '레이드'}`,
    url: raidUrl(raid.id),
    description: [tags.join('  '), raid.description ? `\n${String(raid.description).slice(0, 180)}` : '']
      .filter(Boolean)
      .join(' ')
      .trim() || undefined,
    color: DIFF_COLOR[raid.difficulty] ?? 0x8a70ff,
    fields,
    footer: { text: '와니온 · 신청은 /신청 또는 웹에서' },
  };
}

/** /일정 — 다가오는 레이드 목록 임베드 */
export function scheduleEmbed(raids, title = '다가오는 레이드') {
  if (!raids.length) {
    return {
      title,
      description: '예정된 레이드가 없습니다. 웹에서 파티를 개설해보세요.',
      color: 0x8a70ff,
    };
  }
  const fields = raids.slice(0, 10).map((r) => ({
    name: `${DIFF_LABEL[r.difficulty] ? `[${DIFF_LABEL[r.difficulty]}] ` : ''}${r.title}`,
    value: `${fmtDateTime(r.startAt)} · ${countsLine(r)}\n${raidUrl(r.id)}`,
  }));
  return { title, color: 0x8a70ff, fields, footer: { text: '와니온 · /신청 <공대> 로 바로 신청' } };
}

const STATUS_KO = { active: '확정', wait: '대기', bench: '벤치', pending: '승인 대기' };

/** /내신청 — 내 신청 현황 */
export function myAppsEmbed(rows) {
  if (!rows.length) {
    return {
      title: '내 신청 현황',
      description: '진행 중인 신청이 없습니다. `/일정` 에서 확인하고 `/신청` 해보세요.',
      color: 0x8a70ff,
    };
  }
  const fields = rows.slice(0, 10).map((r) => ({
    name: `${r.raidTitle}`,
    value: `${fmtDateTime(r.startAt)} · ${STATUS_KO[r.status] || r.status} · ${r.charName || ''} (${ROLE_SHORT[r.role] || ''})\n${raidUrl(r.raidId)}`,
  }));
  return { title: '내 신청 현황', color: 0x8a70ff, fields };
}

/** /프로필 — 누적 P·계급·대표 캐릭터 */
export function profileEmbed({ displayName, user, wallet, memberships }) {
  const main = user?.mainChar;
  const color = main?.classColor ? parseInt(String(main.classColor).replace('#', ''), 16) : 0x8a70ff;
  const fields = [
    { name: '보유 포인트', value: `${Number(wallet?.balance || 0).toLocaleString()} P`, inline: true },
    { name: '누적 획득', value: `${Number(wallet?.lifetime || 0).toLocaleString()} P`, inline: true },
    { name: 'Battle.net', value: user?.bnetLinked ? `✅ ${user.battletag || '연동됨'}` : '미연동', inline: true },
  ];
  if (main?.name) {
    fields.push({ name: '대표 캐릭터', value: `${main.name}${main.className ? ` · ${main.className}` : ''}${main.realm ? ` · ${main.realm}` : ''}`, inline: false });
  }
  if (memberships?.length) {
    const ROLE_KO = { owner: '소유자', staff: '운영진', master: '길드마스터', officer: '관리자', leader: '공대장', member: '멤버' };
    fields.push({
      name: '소속',
      value: memberships.map((m) => `${m.orgName} (${ROLE_KO[m.role] || m.role})`).join('\n').slice(0, 1000),
      inline: false,
    });
  }
  return {
    title: `${displayName || '모험가'} 님의 프로필`,
    color,
    fields,
    footer: { text: '와니온 · 포인트는 활동으로만 적립' },
  };
}
