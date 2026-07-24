import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { subscribeUpcomingRaids, fetchMyMemberships, fetchMyApplications } from '../lib/db';
import { getCaps } from '../lib/utils';
import RaidFormModal from '../components/RaidFormModal';
import { MonoLabel, SectionTitle, Card, Chip, DDay, RosterMeter, HostBadge, PhaseIndex, StatusBadge, Segments, EmptyState } from '../components/ui';

const SCOPE_KO = { platform: '플랫폼', guild: '길드', team: '공대', alliance: '연합' };
const DIFF_META = {
  normal: { label: '일반', color: '#9ca3af' },
  heroic: { label: '영웅', color: '#3b82f6' },
  mythic: { label: '신화', color: '#fbbf24' },
};
const DIFF_ALIAS = { 일반: 'normal', 영웅: 'heroic', 신화: 'mythic' };
const diffMeta = (raw) => DIFF_META[DIFF_META[raw] ? raw : DIFF_ALIAS[raw] || 'heroic'];
const pad = (n) => String(n).padStart(2, '0');
const APPLIED_KO = { active: '확정', wait: '대기', bench: '벤치', pending: '승인 대기' };
const APPLIED_TONE = { active: 'ok', wait: 'warn', bench: 'default', pending: 'default' };

function adaptRaid(r) {
  const start = r.startAt?.toDate ? r.startAt.toDate() : new Date();
  const c = getCaps(r);
  const caps = { tank: c.tankCap, heal: c.healerCap, dps: c.dpsCap };
  const counts = { tank: r.counts?.tank || 0, heal: r.counts?.heal || 0, dps: r.counts?.dps || 0 };
  const filled = counts.tank + counts.heal + counts.dps;
  const full = filled >= caps.tank + caps.heal + caps.dps;
  const dm = diffMeta(r.difficulty || 'heroic');
  return {
    id: r.id, title: r.title || '공격대', hostType: r.hostType || 'user', hostName: r.hostName || '',
    hostId: r.hostId || null, leaderNoGuild: !!r.leaderNoGuild, difficulty: dm.label, diffColor: dm.color,
    dateLabel: `${start.getMonth() + 1}/${start.getDate()} (${'일월화수목금토'[start.getDay()]}) ${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minIlvl: r.minIlvl || null, caps, counts, dday: Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86400000)),
    status: full ? 'closed' : 'recruiting', phase: filled === 0 ? 'recruit' : full ? 'confirmed' : 'forming',
    guestParty: !!r.guestParty, _start: start,
  };
}

function PartyRow({ r, myStatus }) {
  const closed = r.status !== 'recruiting';
  return (
    <Link to={`/raid/${r.id}`} className={`group flex overflow-hidden rounded border border-line bg-surface transition-colors hover:border-violet-deep ${closed && !myStatus ? 'opacity-50' : ''}`}>
      <span className="w-1 shrink-0" style={{ background: r.diffColor }} />
      <div className="grid flex-1 gap-3 p-3.5 md:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {myStatus ? <StatusBadge tone={APPLIED_TONE[myStatus] || 'default'}>{APPLIED_KO[myStatus] || myStatus}</StatusBadge> : <PhaseIndex phase={r.phase} />}
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ color: r.diffColor, borderColor: `${r.diffColor}66` }}>{r.difficulty}</span>
            <h3 className="truncate text-[15px] font-bold group-hover:text-violet-hi">{r.title}</h3>
            {r.guestParty && <StatusBadge tone="violet">손님</StatusBadge>}
            {closed && !myStatus && <StatusBadge tone="mute">마감</StatusBadge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-sub">
            <HostBadge raid={r} />
            <span className="num">{r.dateLabel}</span>
            {r.minIlvl && <span className="num">템렙 {r.minIlvl}+</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-2.5 md:border-l md:border-t-0 md:pl-3 md:pt-0">
          <div className="min-w-0 flex-1"><RosterMeter caps={r.caps} counts={r.counts} /></div>
          <DDay n={r.dday} />
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { user, profile, uid, signInGoogle } = useApp();
  const [live, setLive] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [myApps, setMyApps] = useState(null); // [{raid, myStatus}]
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState('global'); // global | mine | applied

  useEffect(() => subscribeUpcomingRaids(setLive), []);
  useEffect(() => {
    if (!uid) { setMemberships([]); setMyApps([]); return; }
    fetchMyMemberships(uid).then(setMemberships).catch(() => setMemberships([]));
    fetchMyApplications(uid).then(setMyApps).catch(() => setMyApps([]));
  }, [uid]);

  const all = useMemo(() => (live ? live.map(adaptRaid) : []), [live]);
  // 글로벌 = 신청 가능한 모든 모집 파티
  const globalList = useMemo(() => all.filter((r) => r.status === 'recruiting').sort((a, b) => a.dday - b.dday), [all]);
  // 내 소속 = 내 길드·공대·연합이 여는 예정 일정
  const myScopeIds = useMemo(() => new Set(memberships.filter((m) => m.scopeId).map((m) => m.scopeId)), [memberships]);
  const mineList = useMemo(() => all.filter((r) => r.hostId && myScopeIds.has(r.hostId)).sort((a, b) => a._start - b._start), [all, myScopeIds]);
  // 내 신청 = 실제 내가 신청/확정/대기/벤치된 일정
  const appliedList = useMemo(
    () => (myApps || []).map((x) => ({ ...adaptRaid(x.raid), myStatus: x.myStatus })).sort((a, b) => a._start - b._start),
    [myApps]
  );

  const TABS = [
    { id: 'global', label: '글로벌', count: globalList.length, hint: '신청 가능한 전체 파티' },
    { id: 'mine', label: '내 소속', count: mineList.length, hint: '내 길드·공대가 여는 일정' },
    { id: 'applied', label: '내 신청', count: appliedList.length, hint: '내가 신청·확정된 일정' },
  ];
  const active = TABS.find((t) => t.id === tab) || TABS[0];
  const rows = tab === 'global' ? globalList : tab === 'mine' ? mineList : appliedList;
  const emptyMsg =
    tab === 'global'
      ? { t: '지금 모집 중인 파티가 없어요', d: '직접 파티를 열어 전국에서 모집해보세요.' }
      : tab === 'mine'
        ? { t: '소속 공대의 예정 일정이 없어요', d: memberships.filter((m) => m.scopeType !== 'platform').length ? '아직 열린 일정이 없습니다.' : '길드·공대에 가입하면 여기 모입니다.' }
        : { t: '신청한 일정이 없어요', d: '글로벌 탭에서 파티를 찾아 신청해보세요.' };

  const prog = profile?.progress || null;
  const name = profile?.displayName || user?.displayName || '모험가';
  const orgLink = (m) => (m.scopeType === 'guild' ? `/guild/${m.scopeId}` : m.scopeType === 'team' ? `/team/${m.scopeId}` : null);

  return (
    <main className="mx-auto max-w-content px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <MonoLabel violet>WELCOME BACK</MonoLabel>
          <h1 className="mt-1 text-[26px] font-extrabold">{name}님, 오늘 어떤 파티에 갈까요?</h1>
        </div>
        <button className="btn-primary" onClick={() => (user ? setFormOpen(true) : signInGoogle())}>파티 개설</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {/* 3분류 탭: 글로벌 · 내 소속 · 내 신청 */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span className="num ml-0.5 text-mute">{t.count}</span>
              </Chip>
            ))}
            <Link to="/board" className="ml-auto text-[12px] text-violet-hi hover:underline">전체 보드 →</Link>
          </div>
          <p className="mb-3 text-[12px] text-mute">{active.hint}</p>

          <div className="flex flex-col gap-2.5">
            {rows.slice(0, 8).map((r) => <PartyRow key={r.id} r={r} myStatus={r.myStatus} />)}
            {tab === 'applied' && myApps === null && (
              <p className="py-6 text-center text-[12px] text-mute">불러오는 중…</p>
            )}
            {rows.length === 0 && !(tab === 'applied' && myApps === null) && (
              <EmptyState title={emptyMsg.t} desc={emptyMsg.d} action={tab !== 'applied' ? <button className="btn-primary" onClick={() => setFormOpen(true)}>파티 개설</button> : <button className="btn-secondary" onClick={() => setTab('global')}>글로벌에서 찾기</button>} />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <MonoLabel violet>이번 주 진도</MonoLabel>
            {profile?.bnetLinked ? (
              prog ? (
                <>
                  <p className="mt-1.5 text-[14px] font-bold">
                    {prog.name} <span className="text-violet-hi">{prog.difficulty}</span>{' '}
                    <span className="num text-sub">{prog.killed}/{prog.total}</span>
                  </p>
                  {prog.total > 0 && <Segments done={prog.killed} total={prog.total} className="mt-2.5" />}
                  {prog.lastKill && <p className="mt-2 text-[11px] text-sub">최근 처치: {prog.lastKill}</p>}
                </>
              ) : (
                <p className="mt-1.5 text-[12px] text-sub">마이페이지에서 [지금 갱신]으로 진도를 불러올 수 있어요.</p>
              )
            ) : (
              <div className="mt-1.5">
                <p className="text-[12px] text-sub">Battle.net을 연동하면 진도가 자동 집계됩니다.</p>
                <Link to="/me" className="btn-secondary mt-2 inline-flex !py-1.5 !text-[12px]">연동하러 가기</Link>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <MonoLabel violet>내 소속</MonoLabel>
            <div className="mt-2 flex flex-col gap-1.5">
              {memberships.filter((m) => m.scopeType !== 'platform').map((m) => {
                const to = orgLink(m);
                const inner = (
                  <>
                    <MonoLabel className="w-9 shrink-0">{SCOPE_KO[m.scopeType] || m.scopeType}</MonoLabel>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{m.orgName}</span>
                  </>
                );
                return to ? (
                  <Link key={m.id} to={to} className="flex items-center gap-2 rounded-btn px-1.5 py-1.5 transition-colors hover:bg-surface2">{inner}</Link>
                ) : (
                  <div key={m.id} className="flex items-center gap-2 px-1.5 py-1.5">{inner}</div>
                );
              })}
              {!memberships.filter((m) => m.scopeType !== 'platform').length && (
                <p className="py-2 text-center text-[12px] text-mute">소속이 없습니다 — 길드 페이지에서 가입 신청을 해보세요.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <RaidFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </main>
  );
}
