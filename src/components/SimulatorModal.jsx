import { useEffect, useMemo, useState } from 'react';
import { fetchSimulation, saveSimulation } from '../lib/db';
import { buildSortCode } from '../lib/bridge';
import { MonoLabel, Chip } from './ui';

const ROLE_ICON = { tank: '방패', heal: '치유', dps: '공격' };
const ROLE_DOT = { tank: 'bg-tank', heal: 'bg-heal', dps: 'bg-dps' };

/**
 * 파티 배치 시뮬레이터 (핵심 자산 #4 — kgusystem SimulationModal 계승).
 * P1 방식: 클릭 배치 — 멤버 선택 → 파티 슬롯 클릭. 저장은 raids/{id}/sim 분리 문서.
 * [인게임 배치 코드]가 WANION1;SORT 포맷을 생성 → P4 애드온 /wanion sort가 소비.
 */
export default function SimulatorModal({ raid, apps, guests, onClose }) {
  const partyCount = Math.max(1, Math.ceil((raid.totalCap || 20) / 5));
  const [assign, setAssign] = useState({}); // { key: partyNo }
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSimulation(raid.id).then((a) => setAssign(a || {}));
  }, [raid.id]);

  // 배치 대상 풀: 확정 공대원 + 손님(손님파티)
  const pool = useMemo(() => {
    const members = apps
      .filter((a) => a.status === 'active')
      .map((a) => ({
        key: a.id,
        name: a.charName || a.nickname,
        server: a.server || '아즈샤라',
        color: a.classColor,
        role: a.role,
        isGuest: false,
      }));
    const gs = (guests || []).map((g) => ({
      key: `guest:${g.id}`,
      name: g.charName,
      server: g.server,
      color: g.classColor,
      role: null,
      isGuest: true,
    }));
    return [...members, ...gs];
  }, [apps, guests]);

  const unassigned = pool.filter((m) => !assign[m.key]);
  const partyMembers = (no) => pool.filter((m) => assign[m.key] === no);

  const place = (key, no) => {
    setAssign((prev) => ({ ...prev, [key]: no }));
    setSelected(null);
    setDirty(true);
  };
  const unplace = (key) => {
    setAssign((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveSimulation(raid.id, assign);
      setDirty(false);
    } finally {
      setBusy(false);
    }
  };

  const copySort = async () => {
    const grouped = {};
    pool.forEach((m) => {
      const no = assign[m.key];
      if (!no) return;
      (grouped[no] = grouped[no] || []).push({ charName: m.name, server: m.server, nickname: m.name });
    });
    const code = buildSortCode(raid.id, grouped);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 코드를 복사하세요', code);
    }
  };

  const MemberChip = ({ m, inParty }) => (
    <button
      onClick={() => (inParty ? unplace(m.key) : setSelected(selected === m.key ? null : m.key))}
      title={inParty ? '클릭하면 배치 해제' : '선택 후 파티 슬롯 클릭'}
      className={`flex w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-[12px] font-bold transition ${
        selected === m.key ? 'border-violet bg-violet/15' : 'border-line bg-surface2 hover:border-violet-deep'
      }`}
      style={{ color: m.color || '#EDEDF2' }}
    >
      {m.role && <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${ROLE_DOT[m.role]}`} />}
      <span className="min-w-0 flex-1 truncate">{m.name}</span>
      {m.isGuest && <span className="rounded bg-surface px-1 font-mono text-[9px] tracking-[0.04em] text-sub">손님</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-3xl rounded border border-line bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <MonoLabel violet>PARTY SIMULATOR</MonoLabel>
            <h2 className="text-[17px] font-extrabold">파티 배치 — {raid.title}</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost !py-1.5 !text-[12px]" onClick={copySort}>
              {copied ? '복사됨!' : '인게임 배치 코드'}
            </button>
            <button className="btn-primary !py-1.5 !text-[12px]" disabled={!dirty || busy} onClick={save}>
              {busy ? '저장 중…' : dirty ? '저장' : '저장됨'}
            </button>
            <button className="btn-ghost !py-1.5 !text-[12px]" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[200px_1fr]">
          {/* 미배치 풀 */}
          <div>
            <MonoLabel>POOL · {unassigned.length}</MonoLabel>
            <div className="mt-2 flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-1">
              {unassigned.map((m) => <MemberChip key={m.key} m={m} />)}
              {!unassigned.length && <span className="text-[12px] text-mute">전원 배치됨</span>}
            </div>
            {selected && (
              <p className="mt-2 text-[11px] leading-relaxed text-violet-hi">
                선택됨 — 오른쪽 파티의 [+ 배치]를 클릭하세요
              </p>
            )}
          </div>

          {/* 파티 그리드 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: partyCount }, (_, i) => i + 1).map((no) => {
              const members = partyMembers(no);
              return (
                <div key={no} className="rounded border border-line bg-surface2/50 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-txt">{no}파티</span>
                    <span className="num font-mono text-[11px] text-sub">{members.length}/5</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {members.map((m) => <MemberChip key={m.key} m={m} inParty />)}
                    {members.length < 5 && (
                      <button
                        disabled={!selected}
                        onClick={() => selected && place(selected, no)}
                        className={`rounded border border-dashed px-2 py-1 text-[11px] ${
                          selected
                            ? 'border-violet text-violet-hi hover:bg-violet/10'
                            : 'border-line/60 text-mute'
                        }`}
                      >
                        + 배치
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="border-t border-line px-5 py-3 text-[11px] text-mute">
          공대원(확정)과 손님이 배치 대상입니다. 저장은 별도 문서에 기록되어 공대 본문서를 건드리지 않습니다.
          인게임 배치 코드는 애드온 /wanion sort 명령이 그대로 적용합니다.
        </p>
      </div>
    </div>
  );
}
