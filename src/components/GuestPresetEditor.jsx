import { useState } from 'react';
import { saveGuestTypePresets } from '../lib/db';
import { MonoLabel, Card, Chip } from './ui';

// 손님 유형 프리셋 편집 (사양 7.8) — 길드·공대 관리자 전용.
// 저장값(org.guestTypePresets)은 그 조직이 주최한 레이드의 손님 등록 폼에서 빠른 선택으로 노출된다.

export default function GuestPresetEditor({ scopeType, scopeId, current, onSaved }) {
  const [text, setText] = useState((current || []).join(', '));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const list = text.split(',').map((s) => s.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      await saveGuestTypePresets(scopeType, scopeId, list.slice(0, 20));
      setMsg('프리셋을 저장했어요.');
      onSaved?.();
    } catch (e) {
      setMsg(e.message || '저장에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 p-5">
      <MonoLabel violet>GUEST TYPE PRESETS</MonoLabel>
      <p className="text-[12px] text-sub">손님 유형 프리셋 — 손님 등록 시 빠른 선택으로 뜹니다. 쉼표로 구분해서 입력하세요.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="min-w-[200px] flex-1 rounded border border-line bg-surface2 px-2.5 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep"
          placeholder="깡, 업적, 탈것, 주사위"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
      {list.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {list.map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] font-semibold text-violet-hi">{msg}</p>}
    </Card>
  );
}
