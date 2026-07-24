import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeUpcomingRaids } from '../lib/db';
import { useApp } from '../context/AppContext';
import RaidFormModal from '../components/RaidFormModal';
import CalendarView from '../components/CalendarView';
import { getCaps } from '../lib/utils';
import { MonoLabel, SectionTitle, Chip, DDay, RosterMeter, HostBadge, PhaseIndex, StatusBadge, EmptyState } from '../components/ui';

// 난이도 정규화 — 저장이 'mythic' 또는 '신화' 어느 쪽이어도 동일하게 처리 (잠재 불일치 방지)
const DIFF_META = {
  normal: { id: 'normal', label: '일반', color: '#9ca3af' },
  heroic: { id: 'heroic', label: '영웅', color: '#3b82f6' },
  mythic: { id: 'mythic', label: '신화', color: '#fbbf24' },
};
const DIFF_ALIAS = { 일반: 'normal', 영웅: 'heroic', 신화: 'mythic' };
function diffMeta(raw) {
  const id = DIFF_META[raw] ? raw : DIFF_ALIAS[raw] || 'heroic';
  return DIFF_META[id];
}

// Firestore 레이드 문서 → 보드 로우 형태로 변환
function adaptRaid(r) {
  const start = r.startAt?.toDate ? r.startAt.toDate() : new Date();
  const end = r.endAt?.toDate ? r.endAt.toDate() : start;
  const pad = (n) => String(n).padStart(2, '0');
  const c = getCaps(r);
  const caps = { tank: c.tankCap, heal: c.healerCap, dps: c.dpsCap };
  const counts = {
    tank: r.counts?.tank || 0,
    heal: r.counts?.heal || 0,
    dps: r.counts?.dps || 0,
  };
  const filled = counts.tank + counts.heal + counts.dps;
  const full = filled >= caps.tank + caps.heal + caps.dps;
  const dm = diffMeta(r.difficulty || 'heroic');
  return {
    id: r.id,
    title: r.title || '공격대',
    hostType: r.hostType || 'user',
    hostName: r.hostName || '',
    leader: r.leader || '',
    leaderNoGuild: !!r.leaderNoGuild,
    difficulty: dm.label,
    diffColor: dm.color,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    day: '일월화수목금토'[start.getDay()],
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`,
    minIlvl: r.minIlvl || null,
    caps,
    counts,
    dday: Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86400000)),
    status: full ? 'closed' : 'recruiting',
    phase: filled === 0 ? 'recruit' : full ? 'confirmed' : 'forming',
    guestParty: !!r.guestParty,
  };
}

const HOST_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'alliance', label: '연합' },
  { id: 'guild', label: '길드' },
  { id: 'team', label: '공대' },
  { id: 'user', label: '개인' },
];
const DIFF_FILTERS = ['전체', '일반', '영웅', '신화'];
const ROLE_FILTERS = [
  { id: 'all', label: '전체 역할' },
  { id: 'tank', label: '탱커 자리' },
  { id: 'heal', label: '힐러 자리' },
  { id: 'dps', label: '딜러 자리' },
];
const GUEST_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'guest', label: '손님파티' },
  { id: 'normal', label: '일반' },
];

export default function BoardPage() {
  const [host, setHost] = useState('all');
  const [diff, setDiff] = useState('전체');
  const [role, setRole] = useState('all');
  const [guest, setGuest] = useState('all');
  const [live, setLive] = useState(null); // null=로딩, []=실데이터 없음
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState('board'); // board | calendar
  const { user, signInGoogle } = useApp();

  useEffect(() => subscribeUpcomingRaids(setLive), []);

  const source = useMemo(() => (live ? live.map(adaptRaid) : []), [live]);

  // 이번 주 스트립 — 오늘 기준 일~토, 레이드 있는 날 점 표시
  const weekStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const eventDays = new Set(
      (live || [])
        .map((r) => (r.startAt?.toDate ? r.startAt.toDate() : null))
        .filter(Boolean)
        .map(keyOf)
    );
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        d: d.getDate(),
        day: '일월화수목금토'[d.getDay()],
        today: d.getTime() === today.getTime(),
        event: eventDays.has(keyOf(d)),
      };
    });
  }, [live]);

  const list = useMemo(
    () =>
      source
        .filter((r) => (host === 'all' ? true : r.hostType === host))
        .filter((r) => (diff === '전체' ? true : r.difficulty === diff))
        .filter((r) => (role === 'all' ? true : r.status === 'recruiting' && r.counts[role] < r.caps[role]))
        .filter((r) => (guest === 'all' ? true : guest === 'guest' ? r.guestParty : !r.guestParty))
        .sort((a, b) => {
          const ac = a.status === 'recruiting' ? 0 : 1;
          const bc = b.status === 'recruiting' ? 0 : 1;
          return ac - bc || a.dday - b.dday;
        }),
    [host, diff, role, guest, source]
  );

  const recruitingCount = source.filter((r) => r.status === 'recruiting').length;

  return (
    <main className="mx-auto max-w-content px-4 py-8">
      {/* 헤더 밴드 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <MonoLabel violet>GLOBAL PARTY BOARD</MonoLabel>
          <h1 className="mt-1 text-[26px] font-extrabold">지금 모집 중인 공격대</h1>
          <p className="mt-1 text-[13px] text-sub">소속이 없어도 공대장이 될 수 있습니다 — 누구나 파티를 열고, 전국에서 모집하세요.</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="num text-[20px] font-extrabold text-violet-hi">{recruitingCount}</div>
            <MonoLabel>모집 중</MonoLabel>
          </div>
          <div className="text-right">
            <div className="num text-[20px] font-extrabold">{source.length}</div>
            <MonoLabel>이번 주 일정</MonoLabel>
          </div>
          <button className="btn-primary" onClick={() => (user ? setFormOpen(true) : signInGoogle())}>
            파티 개설
          </button>
        </div>
      </div>

      {/* 주간 스트립 */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded border border-line bg-surface p-2">
        {weekStrip.map((w, i) => (
          <div
            key={i}
            className={`flex min-w-[60px] flex-1 flex-col items-center rounded-btn px-2 py-1.5 ${
              w.today ? 'border border-violet-deep bg-violet/10' : ''
            }`}
          >
            <span className="text-[10px] text-sub">{w.day}</span>
            <span className={`num text-[15px] font-bold ${w.today ? 'text-violet-hi' : 'text-txt'}`}>{w.d}</span>
            <span className={`mt-0.5 h-1 w-1 rounded-full ${w.event ? 'bg-violet' : 'bg-transparent'}`} />
          </div>
        ))}
      </div>

      {/* 필터 툴바 */}
      <div className="mb-6 space-y-2 rounded border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-label mr-1">주최</span>
          {HOST_FILTERS.map((f) => (
            <Chip key={f.id} active={host === f.id} onClick={() => setHost(f.id)}>{f.label}</Chip>
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            <Chip active={view === 'board'} onClick={() => setView('board')}>보드</Chip>
            <Chip active={view === 'calendar'} onClick={() => setView('calendar')}>달력</Chip>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-label mr-1">난이도</span>
          {DIFF_FILTERS.map((d) => (
            <Chip key={d} active={diff === d} onClick={() => setDiff(d)}>{d}</Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="mono-label mr-1">빈자리</span>
          {ROLE_FILTERS.map((f) => (
            <Chip key={f.id} active={role === f.id} onClick={() => setRole(f.id)}>{f.label}</Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="mono-label mr-1">손님</span>
          {GUEST_FILTERS.map((f) => (
            <Chip key={f.id} active={guest === f.id} onClick={() => setGuest(f.id)}>{f.label}</Chip>
          ))}
        </div>
      </div>

      {view === 'calendar' && <CalendarView raids={live && live.length ? live : []} />}
      {view === 'calendar' && (!live || !live.length) && (
        <p className="mt-3 text-center text-[12px] text-mute">등록된 실데이터 공대가 아직 없습니다.</p>
      )}

      {view === 'board' && (
        <>
          <SectionTitle ko="모집 공고" en={`OPEN RECRUITS · ${list.length}`} />
          <div className="flex flex-col gap-2.5">
            {list.map((r) => {
              const closed = r.status !== 'recruiting';
              return (
                <Link
                  key={r.id}
                  to={`/raid/${r.id}`}
                  className={`group flex overflow-hidden rounded border border-line bg-surface transition-colors hover:border-violet-deep ${
                    closed ? 'opacity-50' : ''
                  }`}
                >
                  {/* 좌측 난이도 액센트 바 */}
                  <span className="w-1 shrink-0" style={{ background: r.diffColor }} />
                  <div className="grid flex-1 gap-4 p-4 md:grid-cols-[1fr_260px]">
                    {/* 좌: 상태·난이도·제목 / 주최·공대장 / 일시·조건 */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PhaseIndex phase={r.phase} />
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                          style={{ color: r.diffColor, borderColor: `${r.diffColor}66` }}
                        >
                          {r.difficulty}
                        </span>
                        <h3 className="truncate text-[16px] font-bold group-hover:text-violet-hi">{r.title}</h3>
                        {r.guestParty && <StatusBadge tone="violet">손님</StatusBadge>}
                        {closed && <StatusBadge tone="mute">마감</StatusBadge>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-sub">
                        <HostBadge raid={r} />
                        <span className="num">{r.date.slice(5).replace('-', '/')} ({r.day}) {r.time}</span>
                        {r.minIlvl && <span className="num">템렙 {r.minIlvl}+</span>}
                      </div>
                    </div>
                    {/* 우: 역할 슬롯 미터 / D-day·신청 */}
                    <div className="flex items-center gap-4 border-t border-line pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                      <div className="min-w-0 flex-1">
                        <RosterMeter caps={r.caps} counts={r.counts} />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <DDay n={r.dday} />
                        {!closed && <span className="btn-primary !px-3 !py-1.5 !text-[13px]">신청</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {list.length === 0 && (
              <EmptyState
                title="조건에 맞는 모집 공고가 없습니다"
                desc="필터를 넓히거나, 직접 파티를 열어 전국에서 모집해보세요."
                action={
                  <button className="btn-primary" onClick={() => (user ? setFormOpen(true) : signInGoogle())}>
                    파티 개설
                  </button>
                }
              />
            )}
          </div>
        </>
      )}

      <RaidFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </main>
  );
}
