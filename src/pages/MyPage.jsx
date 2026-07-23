import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { useApp } from '../context/AppContext';
import { functions } from '../lib/firebase';
import {
  requestDailyCheckin,
  hasCheckedInToday,
  subscribeWallet,
  subscribeMyCharacters,
  setMainCharacter,
  fetchMyMemberships,
  fetchLedger,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, Avatar, Chip } from '../components/ui';

const SCOPE_KO = { platform: '플랫폼', guild: '길드', team: '공대', alliance: '연합' };
const ROLE_KO = {
  owner: '소유자',
  staff: '운영진',
  master: '길드 마스터',
  officer: '관리자',
  leader: '공대장',
  member: '멤버',
};
const LEDGER_KO = {
  daily: '일일 출석',
  attend: '레이드 출석',
  leader: '공대장 완주 보너스',
  guide: '공략 추천 보상',
  penalty: '벌점',
  shop: '상점',
};

// KST 새벽 2시 리셋 기준의 '오늘' 키 (사양 3.1 — 게이머의 하루)
function checkinDateKey() {
  const now = new Date(Date.now() - 2 * 3600 * 1000);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}` : '';
}

function fmtShort(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
}

function fmtTime(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── 일일 출석 ────────────────────────────────────────────────────────
function DailyCheckinCard({ wallet }) {
  const { uid, user, signInGoogle } = useApp();
  const [state, setState] = useState('idle'); // idle | done | busy

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

// ── Battle.net 연동 + 대표 캐릭터 (사양 §4 하드 게이트의 열쇠) ───────
function BnetLinkCard({ chars }) {
  const { uid, user, profile, signInGoogle } = useApp();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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

// ── Discord 연동 (와니온봇 — 코드 발급 후 디코에서 /연동 <코드>) ──────
function DiscordLinkCard() {
  const { user, profile, signInGoogle } = useApp();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);
  const [err, setErr] = useState('');
  const linked = !!profile?.discordId;

  const genCode = async () => {
    if (!user) return signInGoogle();
    setBusy(true);
    setErr('');
    try {
      const call = httpsCallable(functions, 'discordCreateLinkCode');
      const res = await call();
      setCode(res.data.code);
    } catch (e) {
      setErr(e.message || '코드 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MonoLabel violet>DISCORD {linked ? `· ${profile.discordUsername || '연동됨'}` : '· 와니온봇 연동'}</MonoLabel>
          <p className="mt-0.5 text-[13px] text-sub">
            {linked
              ? '디스코드 계정이 연동됐어요 — 디코에서 /일정 · /신청 · /프로필 을 쓸 수 있고 픽스·출발 알림을 받습니다.'
              : '와니온봇과 계정을 연결하면 디스코드에서 일정 확인·신청·픽스 알림을 받을 수 있어요. 아래 코드를 디코에 입력하세요.'}
          </p>
        </div>
        {!linked && (
          <button className="btn-primary" disabled={busy} onClick={genCode}>
            {busy ? '발급 중…' : '연동 코드 발급'}
          </button>
        )}
      </div>

      {code && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[13px] text-sub">
            디스코드에서 아래 명령을 입력하세요 <span className="text-mute">(15분간 유효)</span>
          </p>
          <p className="mt-1.5 font-mono text-[18px] font-extrabold tracking-[0.12em] text-violet-hi">
            /연동 {code}
          </p>
        </div>
      )}
      {err && <p className="mt-2 text-[13px] font-semibold text-dps">{err}</p>}
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

// ── 페이지 ───────────────────────────────────────────────────────────
export default function MyPage() {
  const { uid, user, profile, authReady, isPlatformAdmin, signInGoogle } = useApp();
  const [chars, setChars] = useState([]);
  const [memberships, setMemberships] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState(null);

  useEffect(() => (uid ? subscribeMyCharacters(uid, setChars) : setChars([])), [uid]);
  useEffect(() => (uid ? subscribeWallet(uid, setWallet) : setWallet(null)), [uid]);
  useEffect(() => {
    if (!uid) {
      setMemberships(null);
      setLedger(null);
      return;
    }
    fetchMyMemberships(uid).then(setMemberships).catch(() => setMemberships([]));
    fetchLedger(uid).then(setLedger).catch(() => setLedger([]));
  }, [uid]);

  if (!authReady) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-[13px] text-mute">불러오는 중…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-sub">마이페이지는 로그인이 필요합니다.</p>
        <button className="btn-primary mt-4" onClick={signInGoogle}>Google로 로그인</button>
      </main>
    );
  }

  const displayName = profile?.displayName || user.displayName || '모험가';
  const mainColor = profile?.mainChar?.classColor || '#8A70FF';

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <BnetLinkCard chars={chars} />
      <DiscordLinkCard />
      <DailyCheckinCard wallet={wallet} />

      {/* 프로필 헤더 */}
      <div className="flex flex-wrap items-center gap-5 rounded border border-line bg-surface p-5">
        <Avatar name={displayName} color={mainColor} size="h-[72px] w-[72px] !text-[26px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-extrabold">{displayName}</h1>
            {profile?.bnetLinked ? (
              <span className="font-mono text-[11px] tracking-[0.06em] text-heal">BNET VERIFIED</span>
            ) : (
              <span className="font-mono text-[11px] tracking-[0.06em] text-mute">BNET 미연동</span>
            )}
          </div>
          <MonoLabel className="mt-0.5 block">
            {profile?.battletag ? `${profile.battletag} · ` : ''}JOINED {fmtDate(profile?.createdAt) || '—'}
          </MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isPlatformAdmin && <Chip className="chip-active">플랫폼 운영자</Chip>}
            {profile?.mainChar && (
              <Chip>
                대표{' '}
                <span className="font-bold" style={{ color: profile.mainChar.classColor || undefined }}>
                  {profile.mainChar.name}
                </span>
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* 계정 연동 */}
      <div className="mt-6">
        <SectionTitle ko="계정 연동" en="CONNECTED ACCOUNTS" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ConnCard label="GOOGLE" status="연동됨" sub={user.email || ''} linked />
          <ConnCard
            label="BATTLE.NET"
            status={profile?.bnetLinked ? '연동됨' : '미연동'}
            sub={
              profile?.bnetLinked
                ? `캐릭터 ${chars.length}개 · 동기화 ${fmtTime(profile?.bnetSyncedAt) || '—'}`
                : '위 카드에서 연동하세요 — 레이드 신청 필수'
            }
            linked={!!profile?.bnetLinked}
          />
          <ConnCard
            label="DISCORD"
            status={profile?.discordId ? '연동됨' : '미연동'}
            sub={profile?.discordId ? (profile.discordUsername || '와니온봇 연동') : '위 카드에서 코드 발급 후 /연동'}
            linked={!!profile?.discordId}
          />
          <ConnCard label="WARCRAFT LOGS" status="미연동" sub="연동하면 파스·진도가 자동 집계됩니다 (P3)" linked={false} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {/* 캐릭터 */}
          <SectionTitle ko="내 캐릭터" en="CHARACTERS · BNET SYNCED" right="만렙만 자동 등록" />
          <Card>
            {chars.map((c, i) => (
              <div key={c.id} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                <Avatar name={c.name} color={c.classColor || '#8A70FF'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold" style={{ color: c.classColor || undefined }}>
                      {c.name}
                    </span>
                    {profile?.mainCharId === c.id && (
                      <span className="rounded border border-violet-deep px-1 font-mono text-[9px] tracking-[0.06em] text-violet-hi">MAIN</span>
                    )}
                  </div>
                  <p className="truncate text-[12px] text-sub">
                    {c.className}{c.realm ? ` · ${c.realm}` : ''} · <span className="num">Lv.{c.level}</span>
                  </p>
                </div>
                <p className="font-mono text-[10px] tracking-[0.06em] text-heal">VERIFIED</p>
              </div>
            ))}
            {!chars.length && (
              <div className="p-8 text-center text-[13px] text-sub">
                등록된 캐릭터가 없습니다 — Battle.net을 연동하면 만렙 캐릭터가 자동 등록됩니다.
              </div>
            )}
          </Card>

          {/* 소속 */}
          <div className="mt-6">
            <SectionTitle ko="내 소속" en="MEMBERSHIPS" />
            <Card>
              {(memberships || []).map((ms, i) => (
                <div key={ms.id} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <MonoLabel className="w-16 shrink-0">{SCOPE_KO[ms.scopeType] || ms.scopeType}</MonoLabel>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{ms.orgName}</span>
                  <Chip className="chip-active">{ROLE_KO[ms.role] || ms.role}</Chip>
                </div>
              ))}
              {memberships && !memberships.length && (
                <div className="p-8 text-center text-[13px] text-sub">
                  아직 소속이 없습니다 — 길드 페이지에서 가입 신청을 해보세요.
                </div>
              )}
              {!memberships && <p className="p-8 text-center text-[13px] text-mute">불러오는 중…</p>}
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
              <span className="num text-[34px] font-extrabold leading-none">
                {Number(wallet?.balance || 0).toLocaleString()}
              </span>
              <span className="text-[18px] font-extrabold text-violet">P</span>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-sub">누적 획득 <span className="text-mute">(공개)</span></span>
                <span className="num font-bold text-violet-hi">{Number(wallet?.lifetime || 0).toLocaleString()} P</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px]">
                <span className="text-sub">연속 출석</span>
                <span className="num font-bold">{Number(wallet?.streakWeeks || 0)}주</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mute">
              레이드 출석 적립·계급 티어는 시즌 오픈과 함께 활성화됩니다.
            </p>
          </Card>

          <Card className="p-5">
            <MonoLabel violet>LEDGER</MonoLabel>
            <div className="mt-1">
              {(ledger || []).map((l) => (
                <div key={l.id} className="flex items-center gap-3 border-b border-line py-2.5 text-[12px] last:border-0">
                  <span className="num w-9 shrink-0 font-mono text-sub">{fmtShort(l.at)}</span>
                  <span className="min-w-0 flex-1 truncate text-txt">{LEDGER_KO[l.type] || l.type}</span>
                  <span className={`num shrink-0 font-mono font-bold ${l.amount > 0 ? 'text-heal' : 'text-dps'}`}>
                    {l.amount > 0 ? '+' : ''}{l.amount}
                  </span>
                </div>
              ))}
              {ledger && !ledger.length && (
                <p className="py-4 text-center text-[12px] text-sub">아직 적립 내역이 없습니다 — 오늘 첫 출석을 해보세요.</p>
              )}
              {!ledger && <p className="py-4 text-center text-[12px] text-mute">불러오는 중…</p>}
            </div>
          </Card>

          <Card className="p-5">
            <MonoLabel violet>SHOP · 준비 중</MonoLabel>
            <p className="mt-2 text-[12px] leading-relaxed text-sub">
              포인트 전용 치장(칭호·테두리·배너)이 입점 예정입니다.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-mute">포인트는 활동으로만 적립됩니다 — 현금 구매 불가.</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
