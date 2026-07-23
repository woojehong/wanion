import { useState } from 'react';
import { saveOrg, deleteOrg } from '../../lib/db';
import { MonoLabel, Card } from '../../components/ui';

// 조직 생성·편집·삭제 (플랫폼 소유자 전용). 길드·공대·연합 문서를 직접 관리.

const SCOPE_KO = { guild: '길드', team: '공대', alliance: '연합' };
const inputCls =
  'rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep';

export default function OrgCrudPanel({ scopeType, orgs, onChanged }) {
  const [editing, setEditing] = useState(null); // {id,name,server,color,isNew}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const startNew = () =>
    setEditing({ id: '', name: '', server: '아즈샤라', color: '#8A70FF', isNew: true });
  const startEdit = (o) =>
    setEditing({ id: o.id, name: o.name || '', server: o.server || '아즈샤라', color: o.color || '#8A70FF', isNew: false });

  const save = async () => {
    const e = editing;
    const id = e.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (e.isNew && !id) return setMsg('영문 소문자 ID를 입력해주세요 (예: dogs).');
    if (!e.name.trim()) return setMsg('이름을 입력해주세요.');
    setBusy(true);
    setMsg('');
    try {
      const data = { name: e.name.trim() };
      if (scopeType !== 'alliance') {
        data.server = e.server;
        data.color = e.color;
        data.isNone = false;
      }
      await saveOrg(scopeType, id, data);
      setEditing(null);
      onChanged?.();
    } catch (err) {
      setMsg(err.message || '저장에 실패했습니다 (소유자 전용).');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`${o.name} — 정말 삭제할까요?\n소속·게시판 등 하위 데이터는 별도로 남을 수 있습니다.`)) return;
    setBusy(true);
    setMsg('');
    try {
      await deleteOrg(scopeType, o.id);
      onChanged?.();
    } catch (err) {
      setMsg(err.message || '삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <MonoLabel violet>{SCOPE_KO[scopeType]} 관리 · 생성/편집/삭제</MonoLabel>
        <button className="btn-ghost !px-3 !py-1 !text-[12px]" onClick={startNew}>+ 새 {SCOPE_KO[scopeType]}</button>
      </div>
      <div className="mt-3 flex flex-col">
        {orgs.map((o, i) => (
          <div key={o.id} className={`flex items-center gap-3 py-2 ${i > 0 ? 'border-t border-line' : ''}`}>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: o.color || undefined }}>
              {o.name}
            </span>
            <span className="num font-mono text-[11px] text-mute">{o.id}</span>
            <button className="text-[12px] text-sub hover:text-txt" onClick={() => startEdit(o)}>편집</button>
            <button className="text-[12px] text-sub hover:text-dps" disabled={busy} onClick={() => remove(o)}>삭제</button>
          </div>
        ))}
        {!orgs.length && <p className="py-4 text-center text-[12px] text-mute">등록된 {SCOPE_KO[scopeType]}이 없습니다.</p>}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-violet-deep/50 bg-surface2 p-3">
          {editing.isNew && (
            <input
              className={`${inputCls} w-32`}
              placeholder="ID (영문소문자)"
              value={editing.id}
              onChange={(e) => setEditing({ ...editing, id: e.target.value })}
            />
          )}
          <input
            className={`${inputCls} w-44`}
            placeholder="이름"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          {scopeType !== 'alliance' && (
            <>
              <input
                className={`${inputCls} w-28`}
                placeholder="서버"
                value={editing.server}
                onChange={(e) => setEditing({ ...editing, server: e.target.value })}
              />
              <input
                type="color"
                className="h-8 w-10 rounded border border-line bg-surface2"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                title="대표 색"
              />
            </>
          )}
          <button className="btn-primary !px-3 !py-1.5 !text-[12px]" disabled={busy} onClick={save}>저장</button>
          <button className="btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={() => setEditing(null)}>취소</button>
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] font-semibold text-dps">{msg}</p>}
    </Card>
  );
}
