import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RAIDS, WEEK } from '../lib/mock';
import { MonoLabel, SectionTitle, Chip, DDay, SlotSquares, HostBadge } from '../components/ui';

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

export default function BoardPage() {
  const [host, setHost] = useState('all');
  const [diff, setDiff] = useState('전체');
  const [role, setRole] = useState('all');

  const list = useMemo(
    () =>
      RAIDS.filter((r) => (host === 'all' ? true : r.hostType === host))
        .filter((r) => (diff === '전체' ? true : r.difficulty === diff))
        .filter((r) => (role === 'all' ? true : r.status === 'recruiting' && r.counts[role] < r.caps[role]))
        .sort((a, b) => {
          // 모집 중이 먼저, 그 안에서 마감 임박순
          const ac = a.status === 'recruiting' ? 0 : 1;
          const bc = b.status === 'recruiting' ? 0 : 1;
          return ac - bc || a.dday - b.dday;
        }),
    [host, diff, role]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* 헤더 밴드 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <MonoLabel violet>GLOBAL PARTY BOARD</MonoLabel>
          <h1 className="mt-1 text-[26px] font-extrabold">지금 모집 중인 공격대</h1>
          <p className="mt-1 text-[13px] text-sub">소속이 없어도 공대장이 될 수 있습니다 — 누구나 파티를 열고, 전국에서 모집하세요.</p>
        </div>
        <div className="flex gap-5">
          <div className="text-right">
            <div className="num text-[20px] font-extrabold text-violet-hi">{RAIDS.filter((r) => r.status === 'recruiting').length}</div>
            <MonoLabel>RECRUITING</MonoLabel>
          </div>
          <div className="text-right">
            <div className="num text-[20px] font-extrabold">{RAIDS.length}</div>
            <MonoLabel>THIS WEEK</MonoLabel>
          </div>
        </div>
      </div>

      {/* 주간 스트립 */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded border border-line bg-surface p-2">
        {WEEK.map((w) => (
          <div
            key={w.d}
            className={`flex min-w-[64px] flex-1 flex-col items-center rounded px-2 py-1.5 ${
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
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {HOST_FILTERS.map((f) => (
          <Chip key={f.id} active={host === f.id} onClick={() => setHost(f.id)}>{f.label}</Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {DIFF_FILTERS.map((d) => (
          <Chip key={d} active={diff === d} onClick={() => setDiff(d)}>{d}</Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {ROLE_FILTERS.map((f) => (
          <Chip key={f.id} active={role === f.id} onClick={() => setRole(f.id)}>{f.label}</Chip>
        ))}
        <span className="ml-auto text-[12px] text-sub">마감 임박순</span>
      </div>

      {/* 모집 로우 */}
      <SectionTitle ko="모집 공고" en={`OPEN RECRUITS · ${list.length}`} />
      <div className="flex flex-col gap-3">
        {list.map((r) => {
          const closed = r.status !== 'recruiting';
          return (
            <Link
              key={r.id}
              to={`/raid/${r.id}`}
              className={`group grid gap-4 rounded border border-line bg-surface p-4 transition hover:border-violet-deep md:grid-cols-[1fr_auto] ${
                closed ? 'opacity-45' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${r.difficulty === '신화' ? 'border-violet-deep text-violet-hi' : 'border-line text-sub'}`}>
                    {r.difficulty}
                  </span>
                  <h3 className="truncate text-[16px] font-bold group-hover:text-violet-hi">{r.title}</h3>
                  {closed && <span className="text-[11px] font-semibold text-mute">모집 마감</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-sub">
                  <HostBadge raid={r} />
                  <span className="num">
                    {r.date.slice(5).replace('-', '/')} ({r.day}) {r.time}
                  </span>
                  {r.minIlvl && <span className="num">템렙 {r.minIlvl}+</span>}
                </div>
                <div className="mt-3">
                  <SlotSquares caps={r.caps} counts={r.counts} compact />
                </div>
              </div>
              <div className="flex items-center gap-3 md:flex-col md:items-end md:justify-between">
                <DDay n={r.dday} />
                {!closed && <span className="btn-primary !px-3 !py-1.5 !text-[13px]">신청</span>}
              </div>
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="rounded border border-line bg-surface p-10 text-center text-[13px] text-sub">
            조건에 맞는 모집 공고가 없습니다 — 직접 파티를 열어보세요.
          </div>
        )}
      </div>
    </main>
  );
}
