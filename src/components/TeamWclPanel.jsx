import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { saveTeamWclBinding } from '../lib/db';
import { MonoLabel, Card } from './ui';

// WCL 정공 리포트 (사양 7.3) — 공대장·관리자 전용 설정 패널.

const VIS = [
  { id: 'public', label: '전체 공개' },
  { id: 'members', label: '공대원만' },
  { id: 'hidden', label: '비공개' },
];
const inputCls =
  'rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep';

export default function TeamWclPanel({ teamId, team, onSaved }) {
  const { gamedata } = useApp();
  const { servers } = gamedata;
  const [guildName, setGuildName] = useState(team?.wclGuildName || '');
  const [serverSlug, setServerSlug] = useState(
    team?.wclServerSlug || servers.find((s) => s.isDefault)?.slug || servers[0]?.slug || ''
  );
  const [visibility, setVisibility] = useState(team?.wclVisibility || 'members');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const bound = !!team?.wclGuildName;

  const save = async () => {
    if (!guildName.trim()) {
      setMsg('WCL 길드명을 입력해주세요.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await saveTeamWclBinding(teamId, {
        wclGuildName: guildName.trim(),
        wclServerSlug: serverSlug,
        wclRegion: 'KR',
        wclVisibility: visibility,
      });
      setMsg('WCL 연결·공개 설정을 저장했어요.');
      onSaved?.();
    } catch (e) {
      setMsg(e.message || '저장에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setMsg('');
    try {
      const call = httpsCallable(functions, 'refreshTeamWclReport');
      const res = await call({ teamId });
      const r = res.data || {};
      setMsg(r.skipped ? `갱신을 건너뛰었어요 (${r.skipped}).` : `리포트 ${r.count}건을 불러왔어요.`);
      onSaved?.();
    } catch (e) {
      setMsg(e.message || '갱신에 실패했어요.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="mt-4 p-5">
      <MonoLabel violet>WCL REPORT</MonoLabel>
      <p className="text-[12px] text-sub">
        실제 WCL 길드를 연결하면 최근 로그(리포트)를 공대 페이지에 표시합니다. WCL에 로그 업로드 시 이 길드로 올려야 잡혀요.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-line bg-surface2 p-3">
        <input
          className={`${inputCls} w-44`}
          placeholder="WCL 길드명"
          value={guildName}
          onChange={(e) => setGuildName(e.target.value)}
        />
        <select className={inputCls} value={serverSlug} onChange={(e) => setServerSlug(e.target.value)}>
          {servers.map((s) => (
            <option key={s.slug} value={s.slug}>{s.ko}</option>
          ))}
        </select>
        <select className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {VIS.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <button className="btn-ghost" disabled={busy} onClick={save}>
          {busy ? '저장 중…' : '연결 저장'}
        </button>
        <button className="btn-primary" disabled={refreshing || !bound} onClick={refresh}>
          {refreshing ? '갱신 중…' : '지금 갱신'}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-mute">
        공개 범위: 전체=누구나 · 공대원만=소속원 이상 · 비공개=공대장·관리자만
      </p>
      {msg && <p className="mt-2 text-[12px] font-semibold text-violet-hi">{msg}</p>}
    </Card>
  );
}
