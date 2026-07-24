import { useState } from 'react';
import { saveOrg } from '../lib/db';
import { MonoLabel, Card } from './ui';

// 소개 탭 항목별 공개 범위 편집 — 공대장/관리자 전용.
// public=전체공개, members=공대원(소속원)만, private=관리자만(사실상 숨김).
const SECTIONS = [
  { key: 'roster', label: '정규 로스터' },
  { key: 'recentRaids', label: '최근 일정' },
  { key: 'members', label: '공대원 목록' },
];
const OPTS = [
  { id: 'public', label: '전체공개' },
  { id: 'members', label: '공대원만' },
  { id: 'private', label: '비공개' },
];

export default function VisibilityEditor({ scopeType, scopeId, current, onSaved }) {
  const [vis, setVis] = useState(() => ({ ...(current || {}) }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k, v) => setVis((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const clean = {};
      SECTIONS.forEach((s) => { clean[s.key] = vis[s.key] || 'public'; });
      await saveOrg(scopeType, scopeId, { visibility: clean });
      setMsg('공개 범위를 저장했어요.');
      onSaved?.();
    } catch (e) {
      setMsg(e.message || '저장에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 p-5">
      <MonoLabel violet>소개 탭 공개 범위</MonoLabel>
      <p className="mt-1 text-[12px] leading-relaxed text-sub">
        각 항목을 누구에게 보일지 정합니다 — <b className="text-txt">공대원만</b>은 소속원·관리자에게만 보이고, <b className="text-txt">비공개</b>는 소개 탭에서 항목 자체가 사라집니다.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {SECTIONS.map((s) => (
          <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5 first:border-0 first:pt-0">
            <span className="text-[13px] font-semibold text-txt">{s.label}</span>
            <div className="flex gap-1">
              {OPTS.map((o) => {
                const activeOpt = (vis[s.key] || 'public') === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => set(s.key, o.id)}
                    className={`rounded-btn border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      activeOpt ? 'border-violet-deep bg-violet/10 text-violet-hi' : 'border-line text-sub hover:text-txt'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
        {msg && <span className="text-[12px] text-sub">{msg}</span>}
      </div>
    </Card>
  );
}
