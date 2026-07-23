import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  fetchTeam,
  fetchGuild,
  fetchScopeMembers,
  fetchRaidsByHost,
  fetchMyScopeRole,
  fetchMyOrgApplication,
  cancelOrgApplication,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, ArtSlot, Segments, KV, Avatar, Chip } from '../components/ui';
import PostBoard from '../components/PostBoard';
import { OrgJoinModal, OrgManagePanel } from '../components/OrgMembership';

const ROLE_LABELS = { leader: '공대장', officer: '관리자', member: '공대원' };
const ADMIN_ROLES = ['leader', 'officer'];
const ROLE_GROUPS = [
  { key: 'tank', label: '탱커', color: 'bg-tank' },
  { key: 'heal', label: '힐러', color: 'bg-heal' },
  { key: 'dps', label: '딜러', color: 'bg-dps' },
];

function fmtRaidDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { uid, user, profile, isPlatformAdmin, signInGoogle } = useApp();
  const [team, setTeam] = useState(undefined); // undefined=로딩, null=없음
  const [baseGuild, setBaseGuild] = useState(null);
  const [members, setMembers] = useState([]);
  const [raids, setRaids] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [myApp, setMyApp] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [tab, setTab] = useState(null);

  const reloadMembers = useCallback(() => {
    fetchScopeMembers('team', teamId).then(setMembers).catch(() => {});
  }, [teamId]);

  useEffect(() => {
    setTeam(undefined);
    setBaseGuild(null);
    setMembers([]);
    setRaids([]);
    setMyApp(null);
    fetchTeam(teamId)
      .then((t) => {
        setTeam(t);
        if (t?.baseGuildId) fetchGuild(t.baseGuildId).then(setBaseGuild).catch(() => {});
      })
      .catch(() => setTeam(null));
    fetchRaidsByHost('team', teamId).then(setRaids).catch(() => {});
    reloadMembers();
  }, [teamId, reloadMembers]);

  // 접근 모델 (사양 8.4): 소속원=게시판 디폴트, 외부인=소개 뷰만
  useEffect(() => {
    fetchMyScopeRole(uid, 'team', teamId).then((role) => {
      setMyRole(role);
      setTab((prev) => prev ?? (role || isPlatformAdmin ? 'board' : 'intro'));
    });
    fetchMyOrgApplication('team', teamId, uid).then(setMyApp);
  }, [uid, teamId, isPlatformAdmin]);

  const isMember = !!myRole || isPlatformAdmin;
  const isLeader = myRole === 'leader' || isPlatformAdmin;
  const pendingApp = myApp?.status === 'pending';

  const onJoinClick = () => {
    if (!user) return signInGoogle();
    if (pendingApp) {
      if (window.confirm('공대 지원을 취소할까요?')) {
        cancelOrgApplication('team', teamId, uid).then(() => setMyApp(null)).catch(() => {});
      }
      return;
    }
    // BNet 하드 게이트 (사양 §4) — 서버 규칙도 동일 조건을 강제한다
    if (!profile?.bnetLinked) {
      if (window.confirm('공대 지원에는 Battle.net 연동이 필요합니다.\n마이페이지로 이동할까요?')) {
        navigate('/me');
      }
      return;
    }
    setJoinOpen(true);
  };

  // 정규 로스터 (teams.roster — 공격대 관리 페이지에서 편집, 사양 7.5)
  const rosterGroups = useMemo(() => {
    const roster = Array.isArray(team?.roster) ? team.roster : [];
    return ROLE_GROUPS.map((g) => ({
      ...g,
      list: roster.filter((m) => m.role === g.key),
    }));
  }, [team]);
  const rosterCount = rosterGroups.reduce((n, g) => n + g.list.length, 0);

  if (team === undefined) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-[13px] text-mute">불러오는 중…</main>;
  }
  if (!team) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">등록되지 않은 공격대입니다.</main>;
  }

  const activeTab = tab || 'intro';
  const p = team.progress || null; // WCL 리포트(P3) 연동 전까지는 수동 입력값

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* 히어로: 팀 정체성 + 프로그레스 */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-start gap-4">
            {team.logoPath ? (
              <img src={team.logoPath} alt={`${team.name} 로고`} className="h-20 w-20 shrink-0 rounded bg-ink object-contain" />
            ) : (
              <ArtSlot label="공대 로고 1:1" ratio="1 / 1" className="h-20 w-20 shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-[26px] font-extrabold">{team.name}</h1>
              <MonoLabel className="mt-0.5 block">
                RAID TEAM · {(team.server || '아즈샤라').toUpperCase()}{myRole ? ` · ${ROLE_LABELS[myRole] || myRole}` : ''}
              </MonoLabel>
              {team.desc && <p className="mt-2 text-[13px] text-sub">{team.desc}</p>}
              {team.schedule && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="chip">{team.schedule}</span>
                </div>
              )}
            </div>
          </div>
          {!isMember && (
            <div className="mt-6 flex flex-col items-start gap-1">
              <button className={pendingApp ? 'btn-ghost' : 'btn-primary'} onClick={onJoinClick}>
                {pendingApp ? '승인 대기 중 · 취소' : '공대 지원하기'}
              </button>
              {myApp?.status === 'rejected' && (
                <span className="text-[11px] text-mute">이전 지원이 거절되었습니다 — 재지원 가능</span>
              )}
            </div>
          )}
        </Card>
        <Card className="bg-surface2 p-6">
          <MonoLabel violet>CURRENT PROGRESS</MonoLabel>
          {p ? (
            <>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="num text-[48px] font-extrabold leading-none">
                  <span className="text-violet">{p.killed}</span>
                  <span className="text-mute"> / {p.total}</span>
                </span>
                <span className="text-[15px] font-bold text-txt">
                  {p.raid} <span className="text-violet-hi">{p.difficulty}</span>
                </span>
              </div>
              <Segments done={p.killed} total={p.total} className="mt-4" />
              {p.lastKill && (
                <p className="mt-3 text-[12px] text-sub">최근 킬 {p.lastKill}{p.lastKillDate ? ` · ${p.lastKillDate}` : ''}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-sub">
              프로그레스 리포트는 Warcraft Logs 연동(P3) 후 자동 산출됩니다 — 공격대 관리 페이지에서 WCL 길드를 등록하면 활성화됩니다.
            </p>
          )}
        </Card>
      </div>

      {/* 탭 — 게시판=소속원, 관리=공대장 전용 노출 */}
      <div className="mt-6 flex gap-1.5">
        <Chip active={activeTab === 'intro'} onClick={() => setTab('intro')}>소개</Chip>
        {isMember && <Chip active={activeTab === 'board'} onClick={() => setTab('board')}>게시판</Chip>}
        {isLeader && <Chip active={activeTab === 'manage'} onClick={() => setTab('manage')}>관리</Chip>}
      </div>

      {activeTab === 'manage' && isLeader && (
        <OrgManagePanel scopeType="team" scopeId={teamId} members={members} reloadMembers={reloadMembers} />
      )}

      {activeTab === 'board' && isMember && (
        <div className="mt-5">
          <SectionTitle ko="공대 게시판" en="TEAM BOARD · 소속원 전용" />
          <PostBoard scopeType="team" scopeId={teamId} />
        </div>
      )}

      {activeTab === 'intro' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <SectionTitle ko="정규 로스터" en={`ROSTER · ${rosterCount}명`} />
            <Card>
              {rosterCount > 0 ? (
                rosterGroups.map((grp) => (
                  <div key={grp.key} className="border-b border-line p-4 last:border-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${grp.color}`} />
                      <span className="text-[13px] font-bold">{grp.label}</span>
                      <span className="num font-mono text-[12px] text-sub">{grp.list.length}</span>
                    </div>
                    {grp.list.map((m) => (
                      <div key={m.charName} className="flex items-center gap-3 border-t border-line/50 py-2 first:border-0">
                        <Avatar name={m.charName} color={m.classColor || '#8A70FF'} size="h-7 w-7" />
                        <span className="w-32 truncate text-[13px] font-bold" style={{ color: m.classColor || undefined }}>
                          {m.charName}
                        </span>
                        {m.leader && (
                          <span className="rounded border border-violet-deep px-1 font-mono text-[9px] tracking-[0.06em] text-violet-hi">LEADER</span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[12px] text-sub">
                          {[m.className, m.specName].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    ))}
                    {!grp.list.length && <p className="text-[12px] text-mute">—</p>}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[13px] text-sub">
                  정규 로스터가 아직 등록되지 않았습니다 — 공격대 관리 페이지에서 편집합니다.
                </div>
              )}
            </Card>

            <div className="mt-6">
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
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <Card className="p-5">
              <MonoLabel violet>TEAM INFO</MonoLabel>
              <div className="mt-2">
                <KV k="서버" v={team.server || '아즈샤라'} />
                <KV k="공대원" v={`${members.length}명`} />
                {team.schedule && <KV k="일정" v={team.schedule} />}
              </div>
            </Card>
            <Card className="p-5">
              <MonoLabel violet>MEMBERS</MonoLabel>
              <div className="mt-2 flex flex-col gap-2">
                {members
                  .slice()
                  .sort((a, b) => Number(ADMIN_ROLES.includes(b.role)) - Number(ADMIN_ROLES.includes(a.role)))
                  .slice(0, 8)
                  .map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Avatar name={m.displayName} size="h-6 w-6" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-txt">{m.displayName}</span>
                      <span className="text-[11px] text-sub">{ROLE_LABELS[m.role] || m.role}</span>
                    </div>
                  ))}
                {!members.length && (
                  <p className="text-[12px] text-sub">공대원이 아직 등록되지 않았습니다 — 입주(마이그레이션) 후 표시됩니다.</p>
                )}
                {members.length > 8 && <p className="text-[11px] text-mute">외 {members.length - 8}명</p>}
              </div>
            </Card>
            {baseGuild && (
              <Card className="p-5">
                <MonoLabel violet>AFFILIATION</MonoLabel>
                <Link to={`/guild/${baseGuild.id}`} className="mt-2 block text-[14px] font-bold text-txt hover:text-violet-hi">
                  {baseGuild.name} 기반
                </Link>
                <p className="mt-1 text-[12px] leading-relaxed text-sub">
                  공대는 길드와 독립적으로 운영됩니다 — 무소속·타길드 멤버도 함께할 수 있습니다.
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {joinOpen && (
        <OrgJoinModal
          scopeType="team"
          scopeId={teamId}
          orgName={team.name}
          onClose={(applied) => {
            setJoinOpen(false);
            if (applied) fetchMyOrgApplication('team', teamId, uid).then(setMyApp);
          }}
        />
      )}
    </main>
  );
}
