import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { ME } from '../lib/mock';
import { useApp } from '../context/AppContext';
import { functions } from '../lib/firebase';
import {
  requestDailyCheckin,
  hasCheckedInToday,
  subscribeWallet,
  subscribeMyCharacters,
  setMainCharacter,
} from '../lib/db';

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

// ── Battle.net 연동 + 대표 캐릭터 (P2-2 · 사양 §4 하드 게이트의 열쇠) ─
function BnetLinkCard() {
  const { uid, user, profile, signInGoogle } = useApp();
  const location = useLocation();
  const [chars, setChars] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => (uid ? subscribeMyCharacters(uid, setChars) : undefined), [uid]);

  // 콜백 리다이렉트 결과 배너 (?bnet=linked | error)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const bnet = q.get('bnet');
    if (bnet === 'linked') {
      setNotice({ ok: true, text: `Battle.net 연동 완료 — 만렙 캐릭터 ${q.get('chars') || 0}개가 등록되었습니다. 대표 캐릭터를 선택해주세요.` });
    } else if (bnet === 'error') {
      const reasons = {
        'already-linked': '이 Battle.net 계정은 이미 다른 와니온 계정에 연동되어 있습니다.',
        expired: '연동 시간이 초과되었습니다 — 다시 시도해주세요.',
      };
      setNotice({ ok: false, text: reasons[q.get('reason')] || '연동에 실패했습니다 — 다시 시도해주세요.' });
    }
  }, [location.search]);

  const startLink = async () => {
    if (!user) return signInGoogle();
    setBusy(true);
    try {
      const call = httpsCallable(functions, 'bnetStartLink');
      const res = await call();
      window.location.href = res.data.url;
    } catch (e) {
      setNotice({ ok: false, text: e.message || '연동 시작에 실패했습니다.' });
      setBusy(false);
    }
  };

  const linked = !!profile?.bnetLinked;
  const needMain = linked && !profile?.mainCharId;

  return (
    <Card className={`mb-6 p-4 ${needMain ? 'border-violet-deep/60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MonoLabel violet>BATTLE.NET {linked ? `· ${profile.battletag || '연동됨'}` : '· 필수 연동'}</MonoLabel>
          <p className="mt-0.5 text-[13px] text-sub">
            {linked
              ? needMain
                ? '대표 캐릭터를 선택해야 레이드 신청·글 작성이 가능합니다 — 아래에서 선택하세요.'
                : `만렙 캐릭터 ${chars.length}개 등록 · 대표 캐릭터로 활동 중입니다.`
              : 'Battle.net을 연동하면 만렙 캐릭터가 전원 자동 등록됩니다 — 연동 없이는 레이드 신청이 불가합니다.'}
          </p>
        </div>
        <button className={linked ? 'btn-ghost' : 'btn-primary'} disabled={busy} onClick={startLink}>
          {busy ? '이동 중…' : linked ? '다시 동기화' : 'Battle.net 연동'}
        </button>
      </div>

      {notice && (
        <p className={`mt-2 text-[13px] font-semibold ${notice.ok ? 'text-heal' : 'text-dps'}`}>{notice.text}</p>
      )}

      {linked && chars.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <MonoLabel>{needMain ? 'SELECT MAIN CHARACTER' : 'MAIN CHARACTER'}</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chars.map((c) => (
              <Chip
                key={c.id}
                active={profile?.mainCharId === c.id}
                onClick={() => setMainCharacter(uid, c).catch(() => {})}
                className="!py-1"
              >
                <span style={{ color: c.classColor || undefined }} className="font-bold">{c.name}</span>
                <span className="ml-1 text-mute">{c.className}{c.realm ? ` · ${c.realm}` : ''}</span>
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-mute">
            대표 캐릭터명이 게시글·공략·댓글의 작성자로 표기됩니다 (작성 시점 스냅샷 — 이후 변경해도 과거 글은 유지).
          </p>
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
      <BnetLinkCard />
      <DailyCheckinCard />
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
