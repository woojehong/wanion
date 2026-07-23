import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { bootstrapPlatformOwner, isBootstrapped } from '../lib/db';
import { MonoLabel, SectionTitle, Card, Chip } from '../components/ui';
import GamedataTab from './admin/GamedataTab';
import UsersTab from './admin/UsersTab';
import RaidsTab from './admin/RaidsTab';
import OrgsTab from './admin/OrgsTab';

/**
 * 플랫폼 운영자 콘솔 — 탭별 파일 분해 구조 (사양 §1 폐기 45: 거대 단일 파일 금지).
 * kgusystem의 숨은 경로 방식 폐기: 역할 기반 노출 (사양 §1 폐기 39/40).
 */
const TABS = [
  { id: 'gamedata', label: '게임데이터', el: <GamedataTab /> },
  { id: 'users', label: '유저', el: <UsersTab /> },
  { id: 'raids', label: '레이드', el: <RaidsTab /> },
  { id: 'orgs', label: '조직·멤버십', el: <OrgsTab /> },
];

export default function AdminPage() {
  const { authReady, user, isPlatformAdmin, signInGoogle } = useApp();
  const [bootstrapped, setBootstrapped] = useState(null);
  const [tab, setTab] = useState('gamedata');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    isBootstrapped().then(setBootstrapped).catch(() => setBootstrapped(false));
  }, [msg]);

  if (!authReady) return <main className="mx-auto max-w-4xl px-4 py-16 text-center text-sub">로딩 중…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sub">운영자 콘솔은 로그인이 필요합니다.</p>
        <button className="btn-primary mt-4" onClick={signInGoogle}>Google로 로그인</button>
      </main>
    );
  }

  const bootstrap = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await bootstrapPlatformOwner(user.uid);
      setMsg({ ok: true, text: '플랫폼 소유자로 등록되었습니다.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <MonoLabel violet>PLATFORM CONSOLE</MonoLabel>
      <h1 className="mt-1 text-[24px] font-extrabold">운영자 콘솔</h1>

      <div className="mt-6 flex flex-col gap-4">
        {/* 부트스트랩 — meta/super가 없을 때만 규칙이 허용 */}
        {bootstrapped === false && (
          <Card className="p-5">
            <SectionTitle ko="플랫폼 부트스트랩" en="ONE-TIME BOOTSTRAP" />
            <p className="text-[13px] leading-relaxed text-sub">
              최초 1회 — 현재 로그인 계정을 플랫폼 소유자(owner)로 등록합니다. 등록 후에는 이
              버튼이 영구히 사라집니다.
            </p>
            <button className="btn-primary mt-3" disabled={busy} onClick={bootstrap}>
              이 계정을 소유자로 등록
            </button>
            {msg && (
              <p className={`mt-2 text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>
            )}
          </Card>
        )}

        {bootstrapped && !isPlatformAdmin && (
          <Card className="p-5 text-[13px] text-sub">이 계정에는 운영자 권한이 없습니다.</Card>
        )}

        {isPlatformAdmin && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
              ))}
            </div>
            {TABS.find((t) => t.id === tab)?.el}
          </>
        )}
      </div>
    </main>
  );
}
