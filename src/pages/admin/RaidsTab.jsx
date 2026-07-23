import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeUpcomingRaids,
  fetchPastRaids,
  fetchDeletedRaids,
  softDeleteRaid,
  restoreRaid,
  hardDeleteRaid,
  fetchRaidLogs,
} from '../../lib/db';
import { SectionTitle, Card, Chip } from '../../components/ui';

const VIEWS = [
  { id: 'upcoming', label: '예정' },
  { id: 'past', label: '지난' },
  { id: 'deleted', label: '삭제됨' },
];

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LogViewer({ raidId }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    fetchRaidLogs(raidId).then(setLogs).catch(() => setLogs([]));
  }, [raidId]);
  if (!logs) return <p className="py-2 text-[12px] text-mute">로그 불러오는 중…</p>;
  if (!logs.length) {
    return <p className="py-2 text-[12px] text-mute">기록된 로그가 없습니다 — 로그는 Cloud Functions(P2~)가 기록합니다.</p>;
  }
  return (
    <div className="mt-1 flex flex-col gap-1">
      {logs.map((l) => (
        <p key={l.id} className="font-mono text-[11px] leading-relaxed text-sub">
          {fmtDate(l.at)} · {l.type || 'event'} · {l.message || JSON.stringify(l)}
        </p>
      ))}
    </div>
  );
}

export default function RaidsTab() {
  const [view, setView] = useState('upcoming');
  const [upcoming, setUpcoming] = useState(null);
  const [past, setPast] = useState(null);
  const [deleted, setDeleted] = useState(null);
  const [openLog, setOpenLog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => subscribeUpcomingRaids(setUpcoming), []);

  const reloadStatic = () => {
    fetchPastRaids().then(setPast).catch(() => setPast([]));
    fetchDeletedRaids().then(setDeleted).catch(() => setDeleted([]));
  };
  useEffect(() => { reloadStatic(); }, []);

  const run = async (fn, okText) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      reloadStatic();
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const softDel = (r) => {
    if (!window.confirm(`「${r.title}」을(를) 삭제(아카이브)할까요? 복원 가능합니다.`)) return;
    run(() => softDeleteRaid(r.id), '삭제됨 — [삭제됨] 탭에서 복원할 수 있습니다.');
  };

  const hardDel = (r) => {
    if (!window.confirm(`「${r.title}」을(를) 완전 삭제할까요?`)) return;
    if (!window.confirm('신청·메모·취소기록·로그가 모두 지워지며 되돌릴 수 없습니다. 계속할까요?')) return;
    run(() => hardDeleteRaid(r.id), '완전 삭제되었습니다.');
  };

  const list = view === 'upcoming' ? upcoming : view === 'past' ? past : deleted;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle ko="레이드 관리" en="RAIDS · ARCHIVE · LOGS" />
        <div className="mb-3 flex gap-1.5">
          {VIEWS.map((v) => (
            <Chip key={v.id} active={view === v.id} onClick={() => setView(v.id)}>{v.label}</Chip>
          ))}
        </div>
        <div className="flex flex-col">
          {(list || []).map((r, i) => {
            const total = (r.counts?.tank || 0) + (r.counts?.heal || 0) + (r.counts?.dps || 0);
            return (
              <div key={r.id} className={`py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="num w-24 shrink-0 font-mono text-[12px] text-sub">{fmtDate(r.startAt)}</span>
                  <Link to={`/raid/${r.id}`} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-txt hover:text-violet-hi">
                    {r.title}
                  </Link>
                  <span className="shrink-0 text-[12px] text-sub">{r.hostName}</span>
                  <span className="shrink-0 text-[12px] text-sub">{r.difficulty}</span>
                  <span className="num shrink-0 font-mono text-[12px] text-sub">{total}명</span>
                  {r.fixed && (
                    <span className="rounded border border-violet-deep px-1 font-mono text-[9px] tracking-[0.06em] text-violet-hi">FIXED</span>
                  )}
                  <span className="flex shrink-0 gap-2 text-[12px]">
                    <button className="text-sub hover:text-txt" onClick={() => setOpenLog(openLog === r.id ? null : r.id)}>
                      로그
                    </button>
                    {view === 'deleted' ? (
                      <>
                        <button className="text-sub hover:text-heal" disabled={busy} onClick={() => run(() => restoreRaid(r.id), '복원되었습니다.')}>
                          복원
                        </button>
                        <button className="text-sub hover:text-dps" disabled={busy} onClick={() => hardDel(r)}>
                          완전삭제
                        </button>
                      </>
                    ) : (
                      <button className="text-sub hover:text-dps" disabled={busy} onClick={() => softDel(r)}>
                        삭제
                      </button>
                    )}
                  </span>
                </div>
                {openLog === r.id && <LogViewer raidId={r.id} />}
              </div>
            );
          })}
          {list && !list.length && (
            <p className="py-6 text-center text-[13px] text-sub">해당하는 레이드가 없습니다.</p>
          )}
          {!list && <p className="py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
        </div>
      </Card>
      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}
