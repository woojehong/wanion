import { useState } from 'react';
import { saveTeamRoster } from '../lib/db';
import { normalizeRole } from '../lib/utils';
import { MonoLabel, Card, Avatar } from './ui';

// 정규 로스터 편집 (사양 7.5) — 공대 관리 페이지 전용.
// 저장 결과(teams.roster)는 레이드 상세의 '정규 로스터' 원클릭 붙여넣기가 소비한다.

const ROLE_KO = { tank: '탱', heal: '힐', dps: '딜' };
const inputCls =
  'rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep';

export default function RosterEditor({ teamId, roster, gamedata, onSaved }) {
  const { classes, servers } = gamedata;
  const [rows, setRows] = useState(() => (Array.isArray(roster) ? roster : []));
  const [charName, setCharName] = useState('');
  const [server, setServer] = useState(
    servers.find((s) => s.isDefault)?.ko || servers[0]?.ko || '아즈샤라'
  );
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [specId, setSpecId] = useState('');
  const [leader, setLeader] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);

  const cls = classes.find((c) => c.id === classId);
  const specs = cls?.specs || [];

  const addRow = () => {
    const name = charName.trim();
    if (!name) return;
    const spec = specs.find((s) => s.id === specId) || specs[0];
    if (!spec) return;
    if (rows.some((r) => (r.charName || '').trim().toLowerCase() === name.toLowerCase())) return;
    setRows((prev) => [
      ...prev,
      {
        charName: name,
        server,
        classId: cls.id,
        className: cls.name,
        classColor: cls.color,
        specId: spec.id,
        specName: spec.name,
        role: normalizeRole(spec.role),
        leader,
      },
    ]);
    setCharName('');
    setSpecId('');
    setLeader(false);
    setSaved(false);
  };

  const removeRow = (i) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveTeamRoster(teamId, rows);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      window.alert(e.message || '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const byRole = { tank: [], heal: [], dps: [] };
  rows.forEach((r, i) => (byRole[r.role] || byRole.dps).push({ ...r, _i: i }));

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <MonoLabel violet>REGULAR ROSTER</MonoLabel>
          <p className="text-[12px] text-sub">
            정규 로스터 — 레이드 상세에서 원클릭 붙여넣기의 원본 ({rows.length}명)
          </p>
        </div>
        <button className="btn-primary" disabled={busy || saved} onClick={save}>
          {busy ? '저장 중…' : saved ? '저장됨' : '저장'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded border border-line bg-surface2 p-3">
        <input
          className={`${inputCls} w-28`}
          placeholder="캐릭터명"
          value={charName}
          maxLength={12}
          onChange={(e) => setCharName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
        />
        <select className={inputCls} value={server} onChange={(e) => setServer(e.target.value)}>
          {servers.map((s) => (
            <option key={s.ko} value={s.ko}>{s.ko}</option>
          ))}
        </select>
        <select
          className={inputCls}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSpecId('');
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={inputCls} value={specId} onChange={(e) => setSpecId(e.target.value)}>
          <option value="">특성 선택</option>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({ROLE_KO[normalizeRole(s.role)]})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-sub">
          <input type="checkbox" checked={leader} onChange={(e) => setLeader(e.target.checked)} />
          리더
        </label>
        <button className="btn-ghost" onClick={addRow}>추가</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['tank', '탱커', 'bg-tank'],
          ['heal', '힐러', 'bg-heal'],
          ['dps', '딜러', 'bg-dps'],
        ].map(([key, label, dot]) => (
          <div key={key}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="text-[12px] font-bold">{label}</span>
              <span className="num font-mono text-[11px] text-sub">{byRole[key].length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {byRole[key].map((m) => (
                <div key={m._i} className="flex items-center gap-2 rounded border border-line bg-surface2 px-2 py-1.5">
                  <Avatar name={m.charName} color={m.classColor || '#8A70FF'} size="h-6 w-6" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold" style={{ color: m.classColor || undefined }}>
                    {m.charName}
                    {m.leader && <span className="ml-1 font-mono text-[9px] text-violet-hi">L</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-sub">{m.specName}</span>
                  <button className="shrink-0 text-[13px] leading-none text-sub hover:text-dps" onClick={() => removeRow(m._i)} title="삭제">
                    ×
                  </button>
                </div>
              ))}
              {!byRole[key].length && <p className="text-[11px] text-mute">—</p>}
            </div>
          </div>
        ))}
      </div>
      {!saved && <p className="mt-3 text-[11px] text-mute">변경 후 반드시 [저장]을 눌러주세요.</p>}
    </Card>
  );
}
