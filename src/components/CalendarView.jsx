import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonoLabel } from './ui';

const DIFF_LABEL = { normal: '일반', heroic: '영웅', mythic: '신화' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 월간 달력뷰 — kgusystem CalendarGrid 계승 (스케줄 3뷰 중 '달력' 축).
 * 라이브 레이드 문서 배열을 받아 날짜 셀에 칩으로 배치한다.
 */
export default function CalendarView({ raids }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

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
  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="rounded border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="num text-[16px] font-extrabold">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </h2>
          <MonoLabel violet>MONTHLY</MonoLabel>
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={() => move(-1)}>이전</button>
          <button className="btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>오늘</button>
          <button className="btn-ghost !px-2.5 !py-1 !text-[12px]" onClick={() => move(1)}>다음</button>
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
          const list = byDate[k] || [];
          return (
            <div
              key={i}
              className={`min-h-[92px] border-b border-r border-line/60 p-1.5 ${!inMonth ? 'opacity-35' : ''} ${
                isToday ? 'bg-violet/5' : ''
              }`}
            >
              <span className={`num inline-block rounded px-1 text-[11px] font-bold ${
                isToday ? 'bg-violet/20 text-violet-hi' : d.getDay() === 0 ? 'text-dps' : d.getDay() === 6 ? 'text-tank' : 'text-sub'
              }`}>
                {d.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {list.map((r) => {
                  const filled =
                    (r.counts?.tank || 0) + (r.counts?.heal || 0) + (r.counts?.dps || 0);
                  return (
                    <Link
                      key={r.id}
                      to={`/raid/${r.id}`}
                      className={`block truncate rounded border px-1.5 py-1 text-[11px] font-semibold leading-tight transition hover:border-violet ${
                        r.difficulty === 'mythic' ? 'border-violet-deep/60 bg-violet/10 text-violet-hi' : 'border-line bg-surface2 text-txt'
                      }`}
                      title={`${r.title} · ${DIFF_LABEL[r.difficulty] || ''}`}
                    >
                      {String(r._start.getHours()).padStart(2, '0')}:{String(r._start.getMinutes()).padStart(2, '0')} {r.title}
                      <span className="num ml-1 font-mono text-[10px] text-sub">{filled}/{r.totalCap}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
