import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  fetchGuild,
  fetchAllianceOfGuild,
  fetchScopeMembers,
  fetchRaidsByHost,
  fetchMyScopeRole,
  subscribeMyCharacters,
  applyToGuild,
  fetchMyGuildApplication,
  cancelGuildApplication,
  fetchPendingGuildApplications,
  decideGuildApplication,
  setGuildMemberRole,
  removeMembership,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, ArtSlot, KV, Avatar, Chip } from '../components/ui';
import PostBoard from '../components/PostBoard';

const ROLE_LABELS = { master: '길드 마스터', officer: '관리자', member: '길드원' };
const ADMIN_ROLES = ['master', 'officer'];

function fmtRaidDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const inputCls =
  'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

// ── 가입 신청 모달 — 소속 예정 캐릭터 선택 (사양: 소속 캐릭 1개 필수) ─
function JoinModal({ guild, onClose }) {
  const { uid, profile } = useApp();
  const [chars, setChars] = useState([]);
  const [charId, setCharId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => (uid ? subscribeMyCharacters(uid, setChars) : undefined), [uid]);

  const submit = async () => {
    setError('');
    const character = chars.find((c) => c.id === charId);
    if (!character) return setError(`${guild.name} 소속(예정) 캐릭터를 선택해주세요.`);
    setBusy(true);
    try {
      await applyToGuild(guild.id, {
        uid,
        displayName: profile?.displayName,
        battletag: profile?.battletag,
        character,
        message,
      });
      onClose(true);
    } catch (e) {
      setError(e.message || '신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-10 w-full max-w-md rounded border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <MonoLabel violet>JOIN REQUEST</MonoLabel>
        <h2 className="text-[17px] font-extrabold">{guild.name} 가입 신청</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-sub">
              이 길드 소속(예정)인 내 캐릭터
            </span>
            <div className="flex flex-wrap gap-1.5">
              {chars.map((c) => (
                <Chip key={c.id} active={charId === c.id} onClick={() => setCharId(c.id)}>
                  <span style={{ color: c.classColor || undefined }} className="font-bold">{c.name}</span>
                  <span className="ml-1 text-mute">{c.className}</span>
                </Chip>
              ))}
              {!chars.length && (
                <span className="text-[12px] text-mute">등록된 캐릭터가 없습니다 — 마이페이지에서 BNet을 연동해주세요.</span>
              )}
            </div>
          </div>
          <textarea
            className={`${inputCls} h-24 resize-none`}
            placeholder="한마디 (선택) — 예: 옛 한길련 ○○입니다"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-[11px] leading-relaxed text-mute">
            길드 마스터가 확인 후 승인합니다. 캐릭터의 실제 길드 소속은 P3에서 전투정보실 로스터로 자동 검증됩니다.
          </p>
          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? '신청 중…' : '가입 신청'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 관리 탭 (마스터 전용) — 가입 승인 + 길드원 관리 (kgu 계승) ───────
function ManageTab({ guild, members, reloadMembers }) {
  const { uid } = useApp();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reloadPending = useCallback(() => {
    fetchPendingGuildApplications(guild.id).then(setPending).catch(() => setPending([]));
  }, [guild.id]);
  useEffect(() => { reloadPending(); }, [reloadPending]);

  const run = async (fn, okText) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      reloadPending();
      reloadMembers();
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const decide = (app, accept) => {
    if (!accept && !window.confirm(`${app.displayName}님의 가입 신청을 거절할까요?`)) return;
    run(
      () => decideGuildApplication(app, accept, uid),
      accept ? `${app.displayName}님이 길드원이 되었습니다.` : '거절했습니다.'
    );
  };

  const changeRole = (m, role) => {
    if (m.role === role) return;
    run(() => setGuildMemberRole(m.uid, guild.id, role), `${m.displayName} — ${ROLE_LABELS[role]}(으)로 변경.`);
  };

  const kick = (m) => {
    if (!window.confirm(`${m.displayName}님을 길드에서 제명할까요?`)) return;
    run(() => removeMembership(m.uid, 'guild', guild.id), '제명했습니다.');
  };

  return (
    <div className="mt-5 flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle ko="가입 신청" en={`PENDING · ${pending?.length ?? '—'}`} />
        <div className="flex flex-col">
          {(pending || []).map((a, i) => (
            <div key={a.id} className={`flex flex-wrap items-center gap-3 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Avatar name={a.charName || a.displayName} color={a.charClassColor || '#8A70FF'} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold" style={{ color: a.charClassColor || undefined }}>
                  {a.charName || a.displayName}
                  <span className="ml-1.5 text-[12px] font-normal text-sub">
                    {a.charClassName}{a.battletag ? ` · ${a.battletag}` : ''}
                  </span>
                </p>
                {a.message && <p className="mt-0.5 truncate text-[12px] text-sub">"{a.message}"</p>}
              </div>
              <button className="btn-primary !px-3 !py-1 !text-[12px]" disabled={busy} onClick={() => decide(a, true)}>승인</button>
              <button className="btn-ghost !px-3 !py-1 !text-[12px]" disabled={busy} onClick={() => decide(a, false)}>거절</button>
            </div>
          ))}
          {pending && !pending.length && (
            <p className="py-6 text-center text-[13px] text-sub">대기 중인 가입 신청이 없습니다.</p>
          )}
          {!pending && <p className="py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle ko="길드원 관리" en={`MEMBERS · ${members.length}`} right="마스터 전용" />
        <div className="flex flex-col">
          {members.map((m, i) => (
            <div key={m.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Avatar name={m.displayName} size="h-7 w-7" />
              <span className="min-w-0 max-w-[180px] truncate text-[13px] font-bold text-txt">{m.displayName}</span>
              <span className="text-[12px] text-sub">{ROLE_LABELS[m.role] || m.role}</span>
              {m.role !== 'master' && (
                <span className="ml-auto flex items-center gap-2">
                  <Chip
                    active={m.role === 'officer'}
                    onClick={() => changeRole(m, m.role === 'officer' ? 'member' : 'officer')}
                  >
                    {m.role === 'officer' ? '관리자 해제' : '관리자 임명'}
                  </Chip>
                  <button className="text-[12px] text-sub hover:text-dps" disabled={busy} onClick={() => kick(m)}>
                    제명
                  </button>
                </span>
              )}
            </div>
          ))}
          {!members.length && (
            <p className="py-6 text-center text-[13px] text-sub">등록된 길드원이 없습니다.</p>
          )}
        </div>
      </Card>

      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────
export default function GuildPage() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const { uid, user, profile, isPlatformAdmin, signInGoogle } = useApp();
  const [guild, setGuild] = useState(undefined); // undefined=로딩, null=없음
  const [alliance, setAlliance] = useState(null);
  const [members, setMembers] = useState([]);
  const [raids, setRaids] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [myApp, setMyApp] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [tab, setTab] = useState(null); // null=역할 판정 전 → intro|board|manage

  const reloadMembers = useCallback(() => {
    fetchScopeMembers('guild', guildId).then(setMembers).catch(() => {});
  }, [guildId]);

  useEffect(() => {
    setGuild(undefined);
    setAlliance(null);
    setMembers([]);
    setRaids([]);
    setMyApp(null);
    fetchGuild(guildId).then(setGuild).catch(() => setGuild(null));
    fetchAllianceOfGuild(guildId).then(setAlliance).catch(() => {});
    fetchRaidsByHost('guild', guildId).then(setRaids).catch(() => {});
    reloadMembers();
  }, [guildId, reloadMembers]);

  // 접근 모델 (사양 8.4): 소속원=게시판 디폴트, 외부인=소개 뷰만
  useEffect(() => {
    fetchMyScopeRole(uid, 'guild', guildId).then((role) => {
      setMyRole(role);
      setTab((prev) => prev ?? (role || isPlatformAdmin ? 'board' : 'intro'));
    });
    fetchMyGuildApplication(guildId, uid).then(setMyApp);
  }, [uid, guildId, isPlatformAdmin]);

  const isMember = !!myRole || isPlatformAdmin;
  const isMaster = myRole === 'master' || isPlatformAdmin;
  const officers = useMemo(
    () => members.filter((m) => ADMIN_ROLES.includes(m.role)),
    [members]
  );

  if (guild === undefined) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-[13px] text-mute">불러오는 중…</main>;
  }
  if (!guild || guild.isNone || guild.isUnion) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">
        등록되지 않은 길드입니다 — 와니온에 등록된 길드만 프로필이 제공됩니다.
      </main>
    );
  }

  const activeTab = tab || 'intro';
  const pendingApp = myApp?.status === 'pending';

  const onJoinClick = () => {
    if (!user) return signInGoogle();
    if (pendingApp) {
      if (window.confirm('가입 신청을 취소할까요?')) {
        cancelGuildApplication(guildId, uid).then(() => setMyApp(null)).catch(() => {});
      }
      return;
    }
    // BNet 하드 게이트 (사양 §4) — 서버 규칙도 동일 조건을 강제한다
    if (!profile?.bnetLinked) {
      if (window.confirm('길드 가입 신청에는 Battle.net 연동이 필요합니다.\n마이페이지로 이동할까요?')) {
        navigate('/me');
      }
      return;
    }
    setJoinOpen(true);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* 프로필 헤더 — 로고 단일 체계 (배너 폐지, 사양 7.7) */}
      <div className="overflow-hidden rounded border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div className="shrink-0">
            {guild.logoPath ? (
              <img src={guild.logoPath} alt={`${guild.name} 로고`} className="h-24 w-24 rounded bg-ink object-contain" />
            ) : (
              <ArtSlot label="로고 1:1" ratio="1 / 1" className="h-24 w-24 bg-ink" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-extrabold" style={{ color: guild.color || undefined }}>{guild.name}</h1>
              <span className="font-mono text-[11px] tracking-[0.06em] text-heal">FOUNDING GUILD</span>
              {alliance && (
                <span className="rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-violet-hi">
                  {alliance.name} 소속
                </span>
              )}
            </div>
            <MonoLabel className="mt-1 block">
              {(guild.server || '아즈샤라').toUpperCase()}{myRole ? ` · ${ROLE_LABELS[myRole] || myRole}` : ''}
            </MonoLabel>
            {guild.desc && <p className="mt-2 text-[13px] text-sub">{guild.desc}</p>}
          </div>
          {!isMember && (
            <div className="flex flex-col items-end gap-1">
              <button className={pendingApp ? 'btn-ghost' : 'btn-primary'} onClick={onJoinClick}>
                {pendingApp ? '승인 대기 중 · 취소' : '가입 신청'}
              </button>
              {myApp?.status === 'rejected' && (
                <span className="text-[11px] text-mute">이전 신청이 거절되었습니다 — 재신청 가능</span>
              )}
            </div>
          )}
        </div>
        {/* 스탯 스트립 — 실데이터만 */}
        <div className="grid grid-cols-3 border-t border-line">
          {[['길드원', members.length], ['운영진', officers.length], ['최근 공대', raids.length]].map(([k, v], i) => (
            <div key={k} className={`p-4 ${i > 0 ? 'border-l border-line' : ''}`}>
              <div className="num text-[18px] font-extrabold">{v}</div>
              <div className="text-[12px] text-sub">{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 — 게시판=소속원, 관리=마스터 전용 노출 (사양 8.4) */}
      <div className="mt-5 flex gap-1.5">
        <Chip active={activeTab === 'intro'} onClick={() => setTab('intro')}>소개</Chip>
        {isMember && <Chip active={activeTab === 'board'} onClick={() => setTab('board')}>게시판</Chip>}
        {isMaster && <Chip active={activeTab === 'manage'} onClick={() => setTab('manage')}>관리</Chip>}
      </div>

      {activeTab === 'manage' && isMaster && (
        <ManageTab guild={guild} members={members} reloadMembers={reloadMembers} />
      )}

      {activeTab === 'board' && isMember && (
        <div className="mt-5">
          <SectionTitle ko="길드 게시판" en="GUILD BOARD · 소속원 전용" />
          <PostBoard scopeType="guild" scopeId={guildId} />
        </div>
      )}

      {activeTab === 'intro' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <SectionTitle ko="최근 공대" en="RECENT RAIDS" />
            <Card>
              {raids.map((r, i) => (
                <Link key={r.id} to={`/raid/${r.id}`} className={`flex items-center gap-4 p-4 transition hover:bg-surface2 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <span className="num w-12 shrink-0 font-mono text-[12px] text-sub">{fmtRaidDate(r.startAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.title}</span>
                  <span className="shrink-0 text-[12px] text-sub">{r.difficulty}</span>
                </Link>
              ))}
              {!raids.length && (
                <div className="p-8 text-center text-[13px] text-sub">아직 등록된 공대가 없습니다.</div>
              )}
            </Card>

            <div className="mt-6">
              <SectionTitle ko="길드 운영진" en="OFFICERS" />
              <Card>
                {officers.map((o, i) => (
                  <div key={o.id} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <Avatar name={o.displayName} color={guild.color || '#8A70FF'} />
                    <p className="text-[14px] font-bold text-txt">{o.displayName}</p>
                    <span className="ml-auto text-[12px] font-semibold text-sub">{ROLE_LABELS[o.role] || o.role}</span>
                  </div>
                ))}
                {!officers.length && (
                  <div className="p-8 text-center text-[13px] text-sub">
                    운영진이 아직 등록되지 않았습니다.
                  </div>
                )}
              </Card>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <Card className="p-5">
              <MonoLabel violet>GUILD INFO</MonoLabel>
              <div className="mt-2">
                <KV k="서버" v={guild.server || '아즈샤라'} />
                <KV k="길드원" v={`${members.length}명`} />
                {alliance && <KV k="연합" v={alliance.name} />}
              </div>
            </Card>
            {!isMember && (
              <Card className="p-5">
                <MonoLabel violet>JOIN</MonoLabel>
                <p className="mt-2 text-[13px] leading-relaxed text-sub">
                  가입 신청에는 Battle.net 연동과 {guild.name} 소속(예정) 캐릭터 선택이 필요합니다.
                  마스터 승인 즉시 게시판·길드 공대가 열립니다.
                </p>
                <button className="btn-primary mt-3 w-full" onClick={onJoinClick}>
                  {pendingApp ? '승인 대기 중 · 취소' : '가입 신청'}
                </button>
              </Card>
            )}
            {alliance && (
              <Card className="p-5">
                <MonoLabel violet>ALLIANCE</MonoLabel>
                <p className="mt-2 text-[15px] font-bold">{alliance.name}</p>
                {alliance.desc && <p className="mt-1 text-[12px] text-sub">{alliance.desc}</p>}
              </Card>
            )}
          </aside>
        </div>
      )}

      {joinOpen && (
        <JoinModal
          guild={guild}
          onClose={(applied) => {
            setJoinOpen(false);
            if (applied) fetchMyGuildApplication(guildId, uid).then(setMyApp);
          }}
        />
      )}
    </main>
  );
}
