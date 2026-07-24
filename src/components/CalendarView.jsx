import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonoLabel } from './ui';

// 난이도 정규화 — 'mythic' 또는 '신화' 어느 저장 형태든 동일 처리
const DIFF = {
  normal: { label: '일반', color: '#9ca3af' },
  heroic: { label: '영웅', color: '#3b82f6' },
  mythic: { label: '신화', color: '#fbbf24' },
};
const DIFF_ALIAS = { 일반: 'normal', 영웅: 'heroic', 신화: 'mythic' };
function diffOf(raw) {
  const id = DIFF[raw] ? raw : DIFF_ALIAS[raw] || 'heroic';
  return DIFF[id];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PER_CELL = 3;

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 월간 달력뷰 — kgusystem CalendarGrid 계승 (스케줄 3뷰 중 '달력' 축).
 * 하루 3개 초과 시 우선 3개 + "+N개 더보기"(셀 확장). 동일 정보 배지 반복 없이 시간·제목·현재/정원.
 */
export default function CalendarView({ raids }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [expanded, setExpanded] = useState(() => new Set());

  const byDate = useMemo(() => {
    const map = {};
    raids.forEach((r) => {
      const s = r.startAt?.toDate ? r.startAt.toDate() : null;
      if (!s) return;
      const k = keyOf(s);
      (map[k] = map[k] || []).push({ ...r, _start: s });
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a._start - b._start));
    return map;
  }, [raids]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = keyOf(today);
  const move = (n) => {
    setExpanded(new Set());
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  };
  const toggle = (k) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <div className="overflow-hidden rounded border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="num text-[16px] font-extrabold">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </h2>
          <MonoLabel violet>MONTHLY</MonoLabel>
        </div>
        <div className="flex gap-1">
          <button className="btn-secondary !px-2.5 !py-1 !text-[12px]" onClick={() => move(-1)}>이전</button>
          <button
            className="btn-secondary !px-2.5 !py-1 !text-[12px]"
            onClick={() => {
              setExpanded(new Set());
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >
            오늘
          </button>
          <button className="btn-secondary !px-2.5 !py-1 !text-[12px]" onClick={() => move(1)}>다음</button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`px-2 py-1.5 text-center text-[11px] font-bold ${i === 0 ? 'text-dps' : i === 6 ? 'text-tank' : 'text-sub'}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const k = keyOf(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = k === todayKey;
          const all = byDate[k] || [];
          const isOpen = expanded.has(k);
          const shown = isOpen ? all : all.slice(0, MAX_PER_CELL);
          const overflow = all.length - shown.length;
          return (
            <div
              key={i}
              className={`min-h-[96px] border-b border-r border-line/60 p-1.5 ${!inMonth ? 'opacity-35' : ''} ${
                isToday ? 'bg-violet/5' : ''
              }`}
            >
              <span
                className={`num inline-block rounded px-1 text-[11px] font-bold ${
                  isToday ? 'bg-violet/20 text-violet-hi' : d.getDay() === 0 ? 'text-dps' : d.getDay() === 6 ? 'text-tank' : 'text-sub'
                }`}
              >
                {d.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {shown.map((r) => {
                  const dm = diffOf(r.difficulty);
                  const filled = (r.counts?.tank || 0) + (r.counts?.heal || 0) + (r.counts?.dps || 0);
                  return (
                    <Link
                      key={r.id}
                      to={`/raid/${r.id}`}
                      className="flex items-center gap-1 truncate rounded-btn border border-line bg-surface2 px-1.5 py-1 text-[11px] font-semibold leading-tight transition-colors hover:border-violet"
                      title={`${r.title} · ${dm.label}`}
                    >
                      <span className="h-2.5 w-0.5 shrink-0 rounded-full" style={{ background: dm.color }} />
                      <span className="num shrink-0 text-mute">
                        {String(r._start.getHours()).padStart(2, '0')}:{String(r._start.getMinutes()).padStart(2, '0')}
                      </span>
                      <span className="truncate text-txt">{r.title}</span>
                      <span className="num ml-auto shrink-0 font-mono text-[10px] text-sub">{filled}/{r.totalCap}</span>
                    </Link>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => toggle(k)}
                    className="rounded-btn px-1.5 py-0.5 text-left text-[10px] font-semibold text-violet-hi hover:bg-violet/10"
                  >
                    +{overflow}개 더보기
                  </button>
                )}
                {isOpen && all.length > MAX_PER_CELL && (
                  <button
                    onClick={() => toggle(k)}
                    className="rounded-btn px-1.5 py-0.5 text-left text-[10px] font-semibold text-mute hover:bg-line/40"
                  >
                    접기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
