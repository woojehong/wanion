import { Link } from 'react-router-dom';
import { GUILDS, TEAMS, ALLIANCE } from '../lib/mock';
import { MonoLabel, Segments, ArtSlot, Dot } from '../components/ui';

export default function LandingPage() {
  const sad = TEAMS[0];
  return (
    <div>
      {/* 공개 랜딩 전용 슬림 네비 */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="text-[17px] font-extrabold tracking-[0.14em]">
            WAN<span className="text-violet">ION</span>
          </span>
          <div className="flex items-center gap-3">
            <Link to="/board" className="text-[13px] font-semibold text-sub hover:text-txt">파티 찾기</Link>
            <Link to="/me" className="btn-primary !px-3 !py-1.5 !text-[13px]">시작하기</Link>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(138,112,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(138,112,255,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr]">
          <div className="relative">
            <MonoLabel violet>RAID OPERATIONS PLATFORM</MonoLabel>
            <h1 className="mt-3 text-[40px] font-extrabold leading-[1.15] md:text-[48px]">
              한국 와우의 레이드는
              <br />
              <span className="text-violet">여기서 굴러갑니다</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-sub">
              길드·공격대·연합 — 한국 와우의 실제 구조 그대로.
              <br />
              소속이 없어도 공대장이 될 수 있습니다.
            </p>
            <div className="mt-7 flex gap-3">
              <Link to="/board" className="btn-primary">파티 찾아보기</Link>
              <span className="btn-ghost cursor-default">길드 등록 안내</span>
            </div>
            <div className="mt-8 flex gap-6">
              {[['등록 길드', GUILDS.length], ['공격대', TEAMS.length + 1], ['이번 주 공대', 12]].map(([k, v]) => (
                <div key={k}>
                  <div className="num text-[22px] font-extrabold text-txt">{v}</div>
                  <div className="text-[12px] text-sub">{k}</div>
                </div>
              ))}
            </div>
          </div>
          <ArtSlot label="히어로 키비주얼 16:9 — 공허 궤도, 다크 바이올렛" className="relative" />
        </div>
      </section>

      {/* 라이브 프로그레스 */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-[22px] font-bold">지금 이 순간의 프로그레스</h2>
            <MonoLabel violet>LIVE PROGRESS · WARCRAFT LOGS 연동</MonoLabel>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <MonoLabel>RAID TEAM</MonoLabel>
                <div className="mt-1 text-[19px] font-bold">{sad.name}</div>
              </div>
              <Link to="/team/teamsad" className="text-[12px] text-violet-hi hover:underline">팀 페이지</Link>
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="num text-[44px] font-extrabold leading-none">
                <span className="text-violet">{sad.progress.killed}</span>
                <span className="text-mute"> / {sad.progress.total}</span>
              </span>
              <span className="text-[14px] font-semibold text-sub">{sad.progress.raid} {sad.progress.difficulty}</span>
            </div>
            <Segments done={sad.progress.killed} total={sad.progress.total} className="mt-4" />
            <p className="mt-3 text-[12px] text-sub">
              최근 킬 {sad.progress.lastKill} · {sad.progress.lastKillDate} · KR {sad.progress.rankKr}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {[{ n: ALLIANCE.name, d: '공허첨탑 영웅', k: 8, t: 8, s: '올킬 · 격주 운영' }, { n: '스타폴', d: '공허첨탑 신화', k: 3, t: 8, s: '진행 중' }].map((x) => (
              <div key={x.n} className="rounded border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold">{x.n}</span>
                  <span className="num text-[15px] font-extrabold">
                    <span className="text-violet">{x.k}</span>
                    <span className="text-mute">/{x.t}</span>
                  </span>
                </div>
                <Segments done={x.k} total={x.t} className="mt-3" />
                <p className="mt-2 text-[12px] text-sub">{x.d} · {x.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 등록 길드 */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-5">
            <h2 className="text-[22px] font-bold">등록 길드</h2>
            <MonoLabel violet>FOUNDING GUILDS · INVITE ONLY</MonoLabel>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {GUILDS.map((g) => (
              <Link key={g.id} to={`/guild/${g.id}`} className="group rounded border border-line bg-surface p-4 transition hover:border-violet-deep">
                <div className="flex items-center gap-2">
                  <Dot />
                  <span className="truncate text-[14px] font-bold group-hover:text-violet-hi">{g.name}</span>
                </div>
                <p className="mt-1.5 truncate text-[12px] text-sub">{g.server} · 길드원 {g.members}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="font-mono text-[10px] tracking-[0.06em] text-heal">VERIFIED</span>
                  {g.alliance && <span className="font-mono text-[10px] tracking-[0.06em] text-violet-hi">KWGU</span>}
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-sub">길드 등록은 현재 초대제로 운영됩니다 — 정식 오픈 시 신청제로 전환됩니다.</p>
        </div>
      </section>
    </div>
  );
}
