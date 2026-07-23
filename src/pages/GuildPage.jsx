import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  fetchGuild,
  fetchAllianceOfGuild,
  fetchScopeMembers,
  fetchRaidsByHost,
  fetchMyScopeRole,
  fetchMyOrgApplication,
  cancelOrgApplication,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, ArtSlot, KV, Avatar, Chip } from '../components/ui';
import PostBoard from '../components/PostBoard';
import { OrgJoinModal, OrgManagePanel, ORG_ROLE_LABELS } from '../components/OrgMembership';

const ADMIN_ROLES = ['master', 'officer'];

function fmtRaidDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
    fetchMyOrgApplication('guild', guildId, uid).then(setMyApp);
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
        cancelOrgApplication('guild', guildId, uid).then(() => setMyApp(null)).catch(() => {});
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
              {(guild.server || '아즈샤라').toUpperCase()}{myRole ? ` · ${ORG_ROLE_LABELS[myRole] || myRole}` : ''}
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
        <OrgManagePanel scopeType="guild" scopeId={guildId} members={members} reloadMembers={reloadMembers} />
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
                    <span className="ml-auto text-[12px] font-semibold text-sub">{ORG_ROLE_LABELS[o.role] || o.role}</span>
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
        <OrgJoinModal
          scopeType="guild"
          scopeId={guildId}
          orgName={guild.name}
          onClose={(applied) => {
            setJoinOpen(false);
            if (applied) fetchMyOrgApplication('guild', guildId, uid).then(setMyApp);
          }}
        />
      )}
    </main>
  );
}
