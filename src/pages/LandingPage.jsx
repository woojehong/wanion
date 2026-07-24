import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGuilds, fetchTeams, fetchAlliances, subscribeUpcomingRaids } from '../lib/db';
import { sortGuilds } from '../lib/utils';
import { MonoLabel, Segments, Dot, PhaseIndex, PHASES } from '../components/ui';

// 핵심 기능 (screen-map 랜딩 5항: 시너지·벤치·스왑·배치) — AI ART 없이 정보로 설명
const FEATURES = [
  { ko: '시너지', desc: '직업·특성 조합을 자동 점검해 빈 시너지를 표시합니다.' },
  { ko: '벤치·대기', desc: '대기 인원과 벤치를 한 화면에서 즉시 교체합니다.' },
  { ko: '스왑', desc: '역할 스왑과 교체 요청을 기록과 함께 처리합니다.' },
  { ko: '자동 배치', desc: '정원과 역할에 맞춰 로스터를 정렬합니다.' },
];

const PHASE_DESC = {
  recruit: '파티 공개, 신청 시작',
  forming: '신청이 쌓이는 중',
  confirmed: '로스터 픽스',
  departing: '체크인·교체 처리',
  recorded: '종료·회고·다음 주 준비',
};

export default function LandingPage() {
  const [guilds, setGuilds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [alliances, setAlliances] = useState([]);
  const [raidCount, setRaidCount] = useState(0);

  useEffect(() => {
    fetchGuilds()
      .then((g) => setGuilds(sortGuilds(g.filter((x) => !x.isNone && !x.isUnion))))
      .catch(() => {});
    fetchTeams().then(setTeams).catch(() => {});
    fetchAlliances().then(setAlliances).catch(() => {});
    return subscribeUpcomingRaids((rs) => setRaidCount(rs.length));
  }, []);

  const allianceGuildIds = useMemo(() => {
    const s = new Set();
    alliances.forEach((a) => (a.guildIds || []).forEach((id) => s.add(id)));
    return s;
  }, [alliances]);

  const featureTeam = useMemo(() => teams.find((t) => t.progress) || teams[0] || null, [teams]);
  const otherTeams = useMemo(
    () => teams.filter((t) => t.id !== featureTeam?.id).slice(0, 2),
    [teams, featureTeam]
  );

  return (
    <div>
      {/* 공개 랜딩 전용 슬림 네비 */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-4">
          <span className="text-[17px] font-extrabold tracking-[0.14em]">
            WAN<span className="text-violet">ION</span>
          </span>
          <div className="flex items-center gap-3">
            <Link to="/board" className="text-[13px] font-semibold text-sub hover:text-txt">파티 찾기</Link>
            <Link to="/me" className="btn-primary !px-3 !py-1.5 !text-[13px]">시작하기</Link>
          </div>
        </div>
      </header>

      {/* 히어로 — 제품 정보가 주인공. 거대한 판타지 키아트 없음(screen-map 랜딩). */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-content items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <MonoLabel violet>RAID OPERATIONS PLATFORM</MonoLabel>
            <h1 className="mt-3 text-[36px] font-extrabold leading-[1.18] md:text-[46px]">
              길드·공격대·연합의 일정을
              <br />
              <span className="text-violet-hi">한곳에서 운영</span>합니다
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-sub">
              한국 와우의 실제 구조 그대로 — 모집부터 로스터 확정, 출발 체크인,
              기록까지. 소속이 없어도 공대장이 될 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/board" className="btn-primary">파티 찾아보기</Link>
              <Link to="/me" className="btn-secondary">Battle.net 연동으로 시작</Link>
            </div>
            <div className="mt-8 flex gap-7">
              {[
                ['등록 길드', guilds.length],
                ['공격대', teams.length],
                ['모집 중', raidCount],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="num text-[24px] font-extrabold text-txt">{v}</div>
                  <div className="text-[12px] text-sub">{k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 실제 제품 요소 — 이번 주 운영 주기(월상 인덱스) */}
          <div className="rounded border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <MonoLabel>WEEKLY CYCLE</MonoLabel>
                <div className="mt-1 text-[16px] font-bold text-txt">이번 주 운영 주기</div>
              </div>
              <span className="num text-[13px] font-semibold text-violet-hi">모집 {raidCount}</span>
            </div>
            <div className="mt-5 flex flex-col divide-y divide-line">
              {PHASES.map((p) => (
                <div key={p.key} className="flex items-center gap-3 py-3">
                  <PhaseIndex phase={p.key} showText={false} className="w-4 justify-center" />
                  <span className="w-10 shrink-0 text-[13px] font-bold text-txt">{p.ko}</span>
                  <span className="text-[12px] text-sub">{PHASE_DESC[p.key]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-4 py-14">
          <div className="mb-6">
            <h2 className="text-[20px] font-bold">운영에 필요한 도구</h2>
            <MonoLabel violet>ROSTER TOOLS</MonoLabel>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.ko} className="rounded border border-line bg-surface p-5">
                <div className="text-[15px] font-bold text-txt">{f.ko}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-sub">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 라이브 프로그레스 */}
      <section className="mx-auto max-w-content px-4 py-14">
        <div className="mb-5">
          <h2 className="text-[20px] font-bold">지금 이 순간의 프로그레스</h2>
          <MonoLabel violet>LIVE PROGRESS · WARCRAFT LOGS 연동</MonoLabel>
        </div>
        {featureTeam ? (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="rounded border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <div>
                  <MonoLabel>RAID TEAM</MonoLabel>
                  <div className="mt-1 text-[19px] font-bold">{featureTeam.name}</div>
                </div>
                <Link to={`/team/${featureTeam.id}`} className="text-[12px] text-violet-hi hover:underline">팀 페이지</Link>
              </div>
              {featureTeam.progress ? (
                <>
                  <div className="mt-5 flex items-baseline gap-3">
                    <span className="num text-[44px] font-extrabold leading-none">
                      <span className="text-violet">{featureTeam.progress.killed}</span>
                      <span className="text-mute"> / {featureTeam.progress.total}</span>
                    </span>
                    <span className="text-[14px] font-semibold text-sub">
                      {featureTeam.progress.raid} {featureTeam.progress.difficulty}
                    </span>
                  </div>
                  <Segments done={featureTeam.progress.killed} total={featureTeam.progress.total} className="mt-4" />
                  {featureTeam.progress.lastKill && (
                    <p className="mt-3 text-[12px] text-sub">최근 킬 {featureTeam.progress.lastKill}</p>
                  )}
                </>
              ) : (
                <p className="mt-5 text-[13px] leading-relaxed text-sub">
                  진도 리포트는 공대 관리 페이지에서 Warcraft Logs 길드를 연결하면 표시됩니다.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {otherTeams.map((t) => (
                <div key={t.id} className="rounded border border-line bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <Link to={`/team/${t.id}`} className="text-[15px] font-bold hover:text-violet-hi">{t.name}</Link>
                    {t.progress && (
                      <span className="num text-[15px] font-extrabold">
                        <span className="text-violet">{t.progress.killed}</span>
                        <span className="text-mute">/{t.progress.total}</span>
                      </span>
                    )}
                  </div>
                  {t.progress ? (
                    <>
                      <Segments done={t.progress.killed} total={t.progress.total} className="mt-3" />
                      <p className="mt-2 text-[12px] text-sub">{t.progress.raid} {t.progress.difficulty}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[12px] text-mute">{t.server || ''} · 리포트 준비 중</p>
                  )}
                </div>
              ))}
              {!otherTeams.length && (
                <div className="rounded border border-line bg-surface p-5 text-[12px] text-mute">
                  더 많은 공격대가 곧 합류합니다.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-line bg-surface p-10 text-center text-[13px] text-sub">
            아직 등록된 공격대가 없습니다 — 공대를 만들고 Warcraft Logs를 연결하면 여기 실시간 진도가 표시됩니다.
          </div>
        )}
      </section>

      {/* 등록 길드 */}
      <section className="border-t border-line bg-surface2/40">
        <div className="mx-auto max-w-content px-4 py-14">
          <div className="mb-5">
            <h2 className="text-[20px] font-bold">등록 길드</h2>
            <MonoLabel violet>FOUNDING GUILDS</MonoLabel>
          </div>
          {guilds.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {guilds.map((g) => (
                <Link key={g.id} to={`/guild/${g.id}`} className="group rounded border border-line bg-surface p-4 transition-colors hover:border-violet-deep">
                  <div className="flex items-center gap-2">
                    {g.logoPath ? (
                      <img src={g.logoPath} alt="" className="h-5 w-5 shrink-0 rounded bg-ink object-contain" />
                    ) : (
                      <Dot color="bg-violet" />
                    )}
                    <span className="truncate text-[14px] font-bold group-hover:text-violet-hi" style={{ color: g.color || undefined }}>
                      {g.name}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[12px] text-sub">{g.server || '아즈샤라'}</p>
                  {allianceGuildIds.has(g.id) && (
                    <div className="mt-2 font-mono text-[10px] tracking-[0.06em] text-violet-hi">연합 소속</div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded border border-line bg-surface p-10 text-center text-[13px] text-sub">
              등록된 길드가 아직 없습니다.
            </div>
          )}
          <p className="mt-4 text-[12px] text-sub">길드 등록·가입은 각 길드 페이지에서 Battle.net 연동 후 신청할 수 있습니다.</p>
        </div>
      </section>

      {/* 푸터 크레딧 (design-system 11항) */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="text-[15px] font-extrabold tracking-[0.14em]">
            WAN<span className="text-violet">ION</span>
          </span>
          <span className="credit-hooje text-[12px]">RUN BY STUDIO HOOJE</span>
        </div>
      </footer>
    </div>
  );
}
