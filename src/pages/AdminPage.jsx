import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { bootstrapPlatformOwner, isBootstrapped, seedInitialData } from '../lib/db';
import { MonoLabel, SectionTitle, Card } from '../components/ui';

/**
 * 플랫폼 운영자 콘솔 (P1 골격) — 부트스트랩·초기 시드.
 * kgusystem의 숨은 경로 방식 폐기: 역할 기반 노출 (사양 §1 폐기 39/40).
 */
export default function AdminPage() {
  const { authReady, user, isPlatformAdmin, signInGoogle } = useApp();
  const [bootstrapped, setBootstrapped] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    isBootstrapped().then(setBootstrapped).catch(() => setBootstrapped(false));
  }, [msg]);

  if (!authReady) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sub">로딩 중…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sub">운영자 콘솔은 로그인이 필요합니다.</p>
        <button className="btn-primary mt-4" onClick={signInGoogle}>Google로 로그인</button>
      </main>
    );
  }

  const run = async (fn, okMsg) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okMsg });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
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
            <button
              className="btn-primary mt-3"
              disabled={busy}
              onClick={() => run(async () => {
                await bootstrapPlatformOwner(user.uid);
              }, '플랫폼 소유자로 등록되었습니다.')}
            >
              이 계정을 소유자로 등록
            </button>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card className="p-5">
            <SectionTitle ko="초기 데이터 시드" en="SEED — GAMEDATA · GUILDS · ZONES" />
            <p className="text-[13px] leading-relaxed text-sub">
              클래스·시너지·서버 게임데이터, 창립 길드 6종, 시즌 던전(공허첨탑 8넴)을
              설치합니다. merge 방식이라 여러 번 실행해도 안전합니다.
            </p>
            <button
              className="btn-primary mt-3"
              disabled={busy}
              onClick={() => run(seedInitialData, '시드 완료 — 보드에서 확인하세요.')}
            >
              시드 실행
            </button>
          </Card>
        )}

        {bootstrapped && !isPlatformAdmin && (
          <Card className="p-5 text-[13px] text-sub">
            이 계정에는 운영자 권한이 없습니다.
          </Card>
        )}

        {msg && (
          <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>
        )}
      </div>
    </main>
  );
}
