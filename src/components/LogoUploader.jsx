import { useRef, useState } from 'react';
import { uploadOrgLogo } from '../lib/db';
import { MonoLabel, Card, ArtSlot } from './ui';

// 조직 로고 업로드 (사양 7.7) — 길드 마스터·공대장 전용.
// 1:1 PNG 512×512px, 최대 500KB 권장. logoPath 확정은 Firestore rules가 권한 강제.

export default function LogoUploader({ scopeType, scopeId, current, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(current || null);
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('이미지 파일만 올릴 수 있어요.');
      return;
    }
    if (file.size > 512 * 1024) {
      setMsg('파일이 너무 커요 — 500KB 이하 PNG를 권장해요.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const url = await uploadOrgLogo(scopeType, scopeId, file);
      setPreview(url);
      setMsg('로고를 저장했어요.');
      onSaved?.(url);
    } catch (err) {
      setMsg(err.message || '업로드에 실패했어요.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card className="mt-4 p-5">
      <MonoLabel violet>LOGO</MonoLabel>
      <p className="text-[12px] text-sub">1:1 PNG · 512×512px · 최대 500KB 권장 · 투명 배경 권장</p>
      <div className="mt-3 flex items-center gap-4">
        {preview ? (
          <img src={preview} alt="로고 미리보기" className="h-20 w-20 shrink-0 rounded bg-ink object-contain" />
        ) : (
          <ArtSlot label="로고 1:1" ratio="1 / 1" className="h-20 w-20 shrink-0" />
        )}
        <div>
          <button className="btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? '업로드 중…' : preview ? '로고 변경' : '로고 업로드'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {msg && <p className="mt-2 text-[12px] font-semibold text-violet-hi">{msg}</p>}
        </div>
      </div>
    </Card>
  );
}
