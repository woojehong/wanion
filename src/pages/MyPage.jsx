import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ME } from '../lib/mock';
import { useApp } from '../context/AppContext';
import { functions } from '../lib/firebase';
import { requestDailyCheckin, hasCheckedInToday, subscribeWallet } from '../lib/db';

const SCOPE_KO = { guild: '길드', team: '공대', alliance: '연합' };
const ROLE_LABEL_KO = {
  master: '길드 마스터', officer: '관리자', leader: '공대장', member: '멤버',
};

// KST 새벽 2시 리셋 기준의 '오늘' 키 (사양 3.1 — 게이머의 하루)
function checkinDateKey() {
  const now = new Date(Date.now() - 2 * 3600 * 1000);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function DailyCheckinCard() {
  const { uid, user, signInGoogle } = useApp();
  const [state, setState] = useState('idle'); // idle | done | busy
  const [wallet, setWallet] = useState(null);

  useEffect(() => (uid ? subscribeWallet(uid, setWallet) : undefined), [uid]);

  // 오늘 이미 출석했으면 버튼을 완료 상태로
  useEffect(() => {
    if (!uid) return;
    hasCheckedInToday(uid, checkinDateKey()).then((done) => done && setState('done'));
  }, [uid]);

  const check = async () => {
    if (!user) return signInGoogle();
    setState('busy');
    try {
      await requestDailyCheckin(uid, checkinDateKey());
      setState('done');
    } catch {
      setState('done'); // 이미 출석(중복 키) — 규칙이 거부해도 UX상 완료 처리
    }
  };

  return (
    <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <MonoLabel violet>DAILY CHECK-IN · KST 02:00 리셋</MonoLabel>
        <p className="mt-0.5 text-[13px] text-sub">
          매일 출석하면 +10P{wallet ? ` — 현재 잔액 ${Number(wallet.balance || 0).toLocaleString()}P` : ''}
          <span className="ml-1 text-mute">(지급은 몇 초 내 자동 반영)</span>
        </p>
      </div>
      <button className="btn-primary" disabled={state !== 'idle'} onClick={check}>
        {state === 'done' ? '오늘 출석 완료' : state === 'busy' ? '처리 중…' : '출석 체크'}
      </button>
    </Card>
  );
}
import { MonoLabel, SectionTitle, Card, ArtSlot, Avatar, KV, Chip } from '../components/ui';

// ── 병합 브릿지 (P2-1) — 한길련 옛 계정을 새 계정에 연결 ─────────────
function LegacyClaimCard() {
  const { user, profile, signInGoogle } = useApp();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // 이미 병합된 계정이면 노출하지 않음
  if (profile?.legacyId && !result) return null;

  const inputCls =
    'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

  const submit = async () => {
    if (!user) return signInGoogle();
    setError('');
    if (!nickname.trim()) return setError('한길련에서 쓰던 닉네임을 입력해주세요.');
    if (!/^\d{4}$/.test(pin)) return setError('PIN은 숫자 4자리입니다.');
    setBusy(true);
    try {
      const call = httpsCallable(functions, 'claimLegacy');
      const res = await call({ nickname: nickname.trim(), pin });
      setResult(res.data);
    } catch (e) {
      setError(e.message || '병합에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Card className="mb-6 border-violet-deep/60 p-4">
        <MonoLabel violet>LEGACY MERGED</MonoLabel>
        <p className="mt-1 text-[14px] font-bold text-txt">
          「{result.nickname}」 계정 병합 완료 — 어서 오세요, 다시 만나서 반갑습니다!
        </p>
        {result.memberships?.length > 0 && (
          <p className="mt-1 text-[13px] text-sub">
            복귀 소속:{' '}
            {result.memberships
              .map((m) => `${SCOPE_KO[m.scopeType] || m.scopeType} ${m.scopeId} · ${ROLE_LABEL_KO[m.role] || m.role}`)
              .join(' / ')}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MonoLabel violet>LEGACY BRIDGE · 한길련</MonoLabel>
          <p className="mt-0.5 text-[13px] text-sub">
            옛 한길련 계정이 있다면 닉네임+PIN으로 병합하세요 — 길드 소속과 직책이 그대로 복원됩니다.
          </p>
        </div>
        {!open && (
          <button className="btn-ghost" onClick={() => (user ? setOpen(true) : signInGoogle())}>
            옛 계정 가져오기
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input className={`${inputCls} !w-44`} placeholder="옛 닉네임" value={nickname} maxLength={12}
            onChange={(e) => setNickname(e.target.value)} />
          <input className={`${inputCls} !w-28`} placeholder="PIN 4자리" value={pin} maxLength={4}
            type="password" inputMode="numeric"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-primary !px-3 !py-2 !text-[13px]" disabled={busy} onClick={submit}>
            {busy ? '확인 중…' : '병합'}
          </button>
          <button className="btn-ghost !px-3 !py-2 !text-[13px]" onClick={() => setOpen(false)}>닫기</button>
          {error && <p className="w-full text-[13px] font-semibold text-dps">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function ConnCard({ label, status, sub, linked }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <MonoLabel>{label}</MonoLabel>
        <span className={`h-1.5 w-1.5 rounded-full ${linked ? 'bg-heal' : 'bg-mute'}`} />
      </div>
      <p className={`mt-2 text-[13px] font-semibold ${linked ? 'text-txt' : 'text-mute'}`}>{status}</p>
      <p className="mt-0.5 truncate text-[11px] text-sub">{sub}</p>
    </Card>
  );
}

export default function MyPage() {
  const m = ME;
  const p = m.points;
  const tierPct = Math.round((p.tier.progress / p.tier.nextAt) * 100);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <DailyCheckinCard />
      <LegacyClaimCard />
      {/* 프로필 헤더 */}
      <div className="flex flex-wrap items-center gap-5 rounded border border-line bg-surface p-5">
        <ArtSlot label="아바타 1:1" ratio="1 / 1" className="h-[72px] w-[72px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-extrabold">{m.name}</h1>
            <span className="font-mono text-[11px] tracking-[0.06em] text-heal">BNET VERIFIED</span>
          </div>
          <MonoLabel className="mt-0.5 block">HOOJE · JOINED {m.joined}</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.roles.map((r) => (
              <Chip key={r} className={r === '플랫폼 운영자' ? 'chip-active' : ''}>{r}</Chip>
            ))}
          </div>
        </div>
        <button className="btn-ghost">프로필 편집</button>
      </div>

      {/* 계정 연동 */}
      <div className="mt-6">
        <SectionTitle ko="계정 연동" en="CONNECTED ACCOUNTS" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ConnCard label="GOOGLE" status="연동됨" sub={m.connections.google} linked />
          <ConnCard label="DISCORD · 필수" status="연동됨" sub={m.connections.discord} linked />
          <ConnCard label="BATTLE.NET" status="연동됨" sub={`캐릭터 ${m.connections.bnet.chars}개 · 최근 동기화 ${m.connections.bnet.syncedAt}`} linked />
          <ConnCard label="WARCRAFT LOGS" status="미연동" sub="연동하면 파스·출석이 자동 집계됩니다" linked={false} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {/* 캐릭터 */}
          <SectionTitle ko="내 캐릭터" en="CHARACTERS · BNET SYNCED" right="만렙(90)만 등록 가능" />
          <Card>
            {m.characters.map((c, i) => (
              <div key={c.name} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                <Avatar name={c.name} color={c.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold" style={{ color: c.color }}>{c.name}</span>
                    {c.main && <span className="rounded border border-violet-deep px-1 font-mono text-[9px] tracking-[0.06em] text-violet-hi">MAIN</span>}
                  </div>
                  <p className="truncate text-[12px] text-sub">{c.cls} · {c.spec} · <span className="num">{c.ilvl}</span></p>
                </div>
                <div className="text-right">
                  <p className={`text-[12px] font-semibold ${c.verified ? 'text-txt' : 'text-mute'}`}>{c.guildName}</p>
                  <p className={`font-mono text-[10px] tracking-[0.06em] ${c.verified ? 'text-heal' : 'text-mute'}`}>
                    {c.verified ? 'VERIFIED' : 'UNREGISTERED'}
                  </p>
                </div>
              </div>
            ))}
          </Card>

          {/* 소속 */}
          <div className="mt-6">
            <SectionTitle ko="내 소속" en="MEMBERSHIPS" />
            <Card>
              {m.memberships.map((ms, i) => (
                <div key={ms.name} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <MonoLabel className="w-20 shrink-0">{ms.scope}</MonoLabel>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{ms.name}</span>
                  <Chip className="chip-active">{ms.role}</Chip>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* 포인트 지갑 */}
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <MonoLabel violet>POINTS</MonoLabel>
              <span className="font-mono text-[11px] text-sub">시즌 1</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-[34px] font-extrabold leading-none">{p.balance.toLocaleString()}</span>
              <span className="text-[18px] font-extrabold text-violet">P</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-sub">이번 주 출석 적립</span>
              <span className="flex items-center gap-1">
                {Array.from({ length: p.weeklyCap }).map((_, i) => (
                  <i key={i} className={`h-1.5 w-4 rounded-full ${i < p.weeklyEarned ? 'bg-violet' : 'bg-line'}`} />
                ))}
                <span className="num ml-1 font-mono text-sub">{p.weeklyEarned}/{p.weeklyCap}</span>
              </span>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-sub">누적 획득 <span className="text-mute">(공개)</span></span>
                <span className="num font-bold text-violet-hi">{p.lifetime.toLocaleString()} P</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px]">
                <span className="text-sub">연속 출석</span>
                <span className="num font-bold">{p.streakWeeks}주</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px]">
                <span className="text-sub">계급</span>
                <span className="font-bold text-violet-hi">{p.tier.name}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <i className="block h-full bg-violet" style={{ width: `${tierPct}%` }} />
              </div>
              <p className="num mt-1 text-right font-mono text-[10px] text-sub">
                {p.tier.next}까지 {(p.tier.nextAt - p.tier.progress).toLocaleString()}P
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <MonoLabel violet>LEDGER</MonoLabel>
            <div className="mt-1">
              {p.ledger.map((l, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] last:border-0">
                  <span className="num w-9 shrink-0 font-mono text-sub">{l.date}</span>
                  <span className="min-w-0 flex-1 truncate text-txt">{l.label}</span>
                  <span className={`num shrink-0 font-mono font-bold ${l.amount > 0 ? 'text-heal' : 'text-dps'}`}>
                    {l.amount > 0 ? '+' : ''}{l.amount}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <MonoLabel violet>SHOP</MonoLabel>
            <div className="mt-1">
              <KV k="칭호 「공허를 걷는 자」" v="보유중" />
              <KV k="프로필 테두리 · 바이올렛 오라" v="600P" />
              <KV k="프로필 배너 슬롯 확장" v="800P" />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">포인트는 출석으로만 적립됩니다 — 현금 구매 불가.</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
