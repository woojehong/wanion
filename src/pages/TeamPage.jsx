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
  subscribeTeamWclReport,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, Segments, KV, Avatar, Chip } from '../components/ui';
import PostBoard from '../components/PostBoard';
import RosterEditor from '../components/RosterEditor';
import TeamWclPanel from '../components/TeamWclPanel';
import LogoUploader from '../components/LogoUploader';
import GuestPresetEditor from '../components/GuestPresetEditor';
import { OrgJoinModal, OrgManagePanel } from '../components/OrgMembership';
import { TEAM_CONTENT } from '../lib/teamContent';

const BASE = import.meta.env.BASE_URL;

// 공대 편집형 소개 (팀별 정적 콘텐츠) — 대표사진·소개·특징·공대장 한마디·연혁·엠블럼
function TeamEditorial({ content }) {
  const gold = content.accent || '#C9A84C';
  return (
    <div className="mb-8 flex flex-col gap-8">
      {content.groupPhoto && (
        <figure className="overflow-hidden rounded border border-line">
          <img src={`${BASE}${content.groupPhoto}`} alt="공대 단체사진" className="w-full object-cover" />
          {content.tagline && (
            <figcaption className="border-t border-line bg-surface2 px-4 py-2 text-center text-[13px] font-semibold text-sub">“{content.tagline}”</figcaption>
          )}
        </figure>
      )}

      {content.about && (
        <section>
          <SectionTitle ko="소개" en="ABOUT THE TEAM" />
          {content.about.subtitle && <p className="mb-3 text-[15px] font-bold text-txt">{content.about.subtitle}</p>}
          <div className="flex flex-col gap-3">
            {content.about.paragraphs.map((t, i) => (
              <p key={i} className="text-[14px] leading-relaxed text-sub">{t}</p>
            ))}
          </div>
          {content.about.sad && (
            <div className="mt-4 flex flex-wrap gap-2">
              {content.about.sad.map((s) => (
                <span key={s.k} className="inline-flex items-baseline gap-1.5 rounded-btn border border-line bg-surface2 px-3 py-1.5">
                  <b className="text-[15px] font-extrabold" style={{ color: gold }}>{s.k}</b>
                  <span className="text-[13px] text-txt">{s.v}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {content.features?.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {content.features.map((f) => (
            <Card key={f.title} className="p-4">
              <p className="text-[14px] font-bold text-txt">{f.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-sub">{f.desc}</p>
            </Card>
          ))}
        </section>
      )}

      {content.quote && (
        <section>
          <SectionTitle ko="공대장의 한마디" en="A WORD FROM THE LEADER" />
          <blockquote className="rounded border-l-2 bg-surface2 p-5" style={{ borderColor: gold }}>
            <p className="text-[15px] font-semibold leading-relaxed text-txt">“{content.quote.text}”</p>
            <footer className="mt-3 text-[12px] text-sub">— {content.quote.by} · {content.quote.role}</footer>
          </blockquote>
        </section>
      )}

      {content.history?.length > 0 && (
        <section>
          <SectionTitle ko="프로그레스 연혁" en="PROGRESS TIMELINE" />
          <Card className="p-5">
            <ol className="flex flex-col">
              {content.history.map((h, i) => (
                <li key={i} className="border-l border-line pb-5 pl-4 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MonoLabel violet>{h.season}</MonoLabel>
                    {h.date && <span className="num text-[11px] text-mute">{h.date}</span>}
                    {h.badge && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ color: gold, borderColor: `${gold}66` }}>{h.badge}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[14px] font-bold text-txt">{h.title}</p>
                  {[h.leader && `공대장 ${h.leader}`, h.sched, h.note].filter(Boolean).length > 0 && (
                    <p className="text-[12px] text-sub">{[h.leader && `공대장 ${h.leader}`, h.sched, h.note].filter(Boolean).join(' · ')}</p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {content.emblem_note && (
        <section>
          <SectionTitle ko="엠블럼" en="EMBLEM" />
          <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
            {content.emblem && (
              <img src={`${BASE}${content.emblem}`} alt="엠블럼" className="h-40 w-40 rounded border border-line bg-ink object-contain p-2" />
            )}
            <div className="flex flex-col gap-3">
              {content.emblem_note.letters.map((l) => (
                <div key={l.k} className="flex gap-3">
                  <b className="w-5 shrink-0 text-[18px] font-extrabold" style={{ color: gold }}>{l.k}</b>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-txt">{l.part} · {l.label}</p>
                    <p className="text-[12px] leading-relaxed text-sub">{l.desc}</p>
                  </div>
                </div>
              ))}
              <div className="mt-1 flex flex-wrap gap-2">
                {content.emblem_note.colors.map((c) => (
                  <span key={c.hex} className="inline-flex items-center gap-1.5 rounded-btn border border-line px-2 py-1">
                    <i className="h-3 w-3 rounded-full" style={{ background: c.hex }} />
                    <span className="text-[11px] text-sub">{c.name}</span>
                    <span className="num font-mono text-[10px] text-mute">{c.hex}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function fmtWclDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
  const { uid, user, profile, isPlatformAdmin, signInGoogle, gamedata } = useApp();
  const [team, setTeam] = useState(undefined); // undefined=로딩, null=없음
  const [baseGuild, setBaseGuild] = useState(null);
  const [members, setMembers] = useState([]);
  const [raids, setRaids] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [myApp, setMyApp] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [tab, setTab] = useState(null);
  const [wclReport, setWclReport] = useState(null);

  const reloadMembers = useCallback(() => {
    fetchScopeMembers('team', teamId).then(setMembers).catch(() => {});
  }, [teamId]);

  const reloadTeam = useCallback(() => {
    fetchTeam(teamId).then((t) => t && setTeam(t)).catch(() => {});
  }, [teamId]);

  // WCL 리포트 구독 — 공개 범위(rules)상 권한 없으면 null
  useEffect(() => subscribeTeamWclReport(teamId, setWclReport), [teamId]);

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
    return <main className="mx-auto max-w-content px-4 py-16 text-center text-[13px] text-mute">불러오는 중…</main>;
  }
  if (!team) {
    return <main className="mx-auto max-w-content px-4 py-16 text-center text-sub">등록되지 않은 공격대입니다.</main>;
  }

  const activeTab = tab || 'intro';
  const p = team.progress || null; // WCL 리포트(P3) 연동 전까지는 수동 입력값
  const content = TEAM_CONTENT[teamId]; // 팀별 편집형 소개(있으면 렌더)

  return (
    <main className="mx-auto max-w-content px-4 py-8">
      {/* 히어로: 팀 정체성 + 프로그레스 */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-start gap-4">
            {team.logoPath ? (
              <img src={team.logoPath} alt={`${team.name} 로고`} className="h-20 w-20 shrink-0 rounded bg-ink object-contain" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-line bg-surface2 text-[28px] font-extrabold text-violet">{team.name?.slice(0, 1) || 'W'}</div>
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
              <button className={pendingApp ? 'btn-secondary' : 'btn-primary'} onClick={onJoinClick}>
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
        <>
          <OrgManagePanel scopeType="team" scopeId={teamId} members={members} reloadMembers={reloadMembers} />
          <LogoUploader scopeType="team" scopeId={teamId} current={team.logoPath} onSaved={reloadTeam} />
          <RosterEditor teamId={teamId} roster={team.roster} gamedata={gamedata} onSaved={reloadTeam} />
          <GuestPresetEditor scopeType="team" scopeId={teamId} current={team.guestTypePresets} onSaved={reloadTeam} />
          <TeamWclPanel teamId={teamId} team={team} onSaved={reloadTeam} />
        </>
      )}

      {activeTab === 'board' && isMember && (
        <div className="mt-5">
          <SectionTitle ko="공대 게시판" en="TEAM BOARD · 소속원 전용" />
          <PostBoard scopeType="team" scopeId={teamId} />
        </div>
      )}

      {activeTab === 'intro' && (
        <div className="mt-5">
          {content && <TeamEditorial content={content} />}
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {wclReport?.reports?.length > 0 && (
              <div className="mb-6">
                <SectionTitle ko="WCL 리포트" en={`WCL · ${wclReport.guildName || ''}`} right="warcraftlogs.com" />
                <Card>
                  {wclReport.reports.map((r, i) => (
                    <a
                      key={r.code}
                      href={`https://www.warcraftlogs.com/reports/${r.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-4 p-4 transition hover:bg-surface2 ${i > 0 ? 'border-t border-line' : ''}`}
                    >
                      <span className="num w-12 shrink-0 font-mono text-[12px] text-sub">{fmtWclDate(r.startTime)}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.title || r.zone || '로그'}</span>
                      <span className="shrink-0 text-[12px] text-sub">{r.zone || ''}</span>
                    </a>
                  ))}
                </Card>
              </div>
            )}

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
