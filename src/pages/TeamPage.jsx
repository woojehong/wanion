import { useParams } from 'react-router-dom';
import { teamById, guildById } from '../lib/mock';
import { MonoLabel, SectionTitle, Card, ArtSlot, Segments, KV, Avatar, Dot } from '../components/ui';
import PostBoard from '../components/PostBoard';

const ROSTER = [
  { role: '탱커', color: 'bg-tank', members: [
    { name: '두부킴', cls: '전사 · 방어', color: '#C69B6D', ilvl: 489, parse: 96.2, leader: true },
    { name: '강철이빨', cls: '드루이드 · 수호', color: '#FF7C0A', ilvl: 486, parse: 91.4 },
  ]},
  { role: '힐러', color: 'bg-heal', members: [
    { name: '빛나래', cls: '사제 · 신성', color: '#FFFFFF', ilvl: 484, parse: 88.9 },
    { name: '이슬비', cls: '기원사 · 보존', color: '#33937F', ilvl: 483, parse: 90.3 },
    { name: '달빛수호', cls: '드루이드 · 회복', color: '#FF7C0A', ilvl: 481, parse: 84.1 },
    { name: '성기사롱', cls: '성기사 · 신성', color: '#F48CBA', ilvl: 485, parse: 87.6 },
  ]},
  { role: '딜러', color: 'bg-dps', members: [
    { name: '어둠속삭임', cls: '흑마법사 · 고통', color: '#8788EE', ilvl: 489, parse: 97.8 },
    { name: '화살폭풍', cls: '사냥꾼 · 야수', color: '#AAD372', ilvl: 486, parse: 93.2 },
    { name: '서리칼날', cls: '도적 · 잠행', color: '#FFF468', ilvl: 484, parse: 89.5 },
    { name: '불꽃심장', cls: '마법사 · 화염', color: '#3FC7EB', ilvl: 487, parse: 94.7 },
    { name: '돌주먹', cls: '수도사 · 풍운', color: '#00FF98', ilvl: 483, parse: 86.3 },
  ], extra: 7 },
];

export default function TeamPage() {
  const { teamId } = useParams();
  const t = teamById(teamId);
  if (!t) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">등록되지 않은 공격대입니다.</main>;
  }
  const base = guildById(t.baseGuild);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* 히어로: 팀 정체성 + 프로그레스 */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-start gap-4">
            <ArtSlot label="공대 엠블럼 1:1" ratio="1 / 1" className="h-20 w-20 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[26px] font-extrabold">{t.name}</h1>
              <MonoLabel className="mt-0.5 block">RAID TEAM · EST. 2024 · {t.server.toUpperCase()}</MonoLabel>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-[12px] font-semibold text-txt">
                  <Dot color="bg-dps" /> 모집 중 · 딜러 {t.recruiting.dps}
                </span>
                <span className="chip">{t.schedule}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button className="btn-primary">공대 지원하기</button>
            <button className="btn-ghost">문의</button>
          </div>
        </Card>
        <Card className="bg-surface2 p-6">
          <MonoLabel violet>CURRENT PROGRESS</MonoLabel>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="num text-[48px] font-extrabold leading-none">
              <span className="text-violet">{t.progress.killed}</span>
              <span className="text-mute"> / {t.progress.total}</span>
            </span>
            <span className="text-[15px] font-bold text-txt">
              {t.progress.raid} <span className="text-violet-hi">{t.progress.difficulty}</span>
            </span>
          </div>
          <Segments done={t.progress.killed} total={t.progress.total} className="mt-4" />
          <p className="mt-3 text-[12px] text-sub">
            최근 킬 {t.progress.lastKill} · {t.progress.lastKillDate} · 시도 {t.stats.tries}회
          </p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-violet-hi">KR {t.progress.rankKr} · WARCRAFT LOGS 연동</p>
        </Card>
      </div>

      {/* 킬 타임라인 */}
      <div className="mt-8">
        <SectionTitle ko="킬 로그" en="KILL LOG" />
        <Card className="overflow-x-auto p-5">
          <div className="flex min-w-[720px] items-start">
            {t.bosses.map((b, i) => {
              const done = !!b.date;
              const next = !done && t.bosses.findIndex((x) => !x.date) === i;
              return (
                <div key={b.name} className="relative flex-1">
                  {i < t.bosses.length - 1 && <span className={`absolute left-1/2 top-[7px] h-px w-full ${done ? 'bg-violet-deep' : 'bg-line'}`} />}
                  <div className="relative flex flex-col items-center gap-1.5 px-1">
                    <span className={`h-3.5 w-3.5 rounded-full border-2 ${done ? 'border-violet bg-violet' : next ? 'border-violet bg-ink' : 'border-line bg-ink'}`} />
                    <span className={`max-w-full truncate text-center text-[11px] font-semibold leading-tight ${done ? 'text-txt' : next ? 'text-violet-hi' : 'text-mute'}`}>
                      {b.name}
                    </span>
                    <span className="num font-mono text-[10px] text-sub">{b.date || (next ? 'NEXT' : '—')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 로스터 */}
        <div>
          <div className="mb-8">
            <SectionTitle ko="공대 게시판" en="TEAM BOARD · 소속원 전용" />
            <PostBoard scopeType="team" scopeId={teamId} />
          </div>

          <SectionTitle ko="로스터" en={`ROSTER · ${t.members}명`} right="파스는 시즌 중앙값" />
          <Card>
            {ROSTER.map((grp) => (
              <div key={grp.role} className="border-b border-line p-4 last:border-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${grp.color}`} />
                  <span className="text-[13px] font-bold">{grp.role}</span>
                  <span className="num font-mono text-[12px] text-sub">{grp.members.length + (grp.extra || 0)}</span>
                </div>
                {grp.members.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 border-t border-line/50 py-2 first:border-0">
                    <Avatar name={m.name} color={m.color} size="h-7 w-7" />
                    <span className="w-32 truncate text-[13px] font-bold" style={{ color: m.color }}>{m.name}</span>
                    {m.leader && <span className="rounded border border-violet-deep px-1 font-mono text-[9px] tracking-[0.06em] text-violet-hi">LEADER</span>}
                    <span className="min-w-0 flex-1 truncate text-[12px] text-sub">{m.cls}</span>
                    <span className="num font-mono text-[12px] text-sub">{m.ilvl}</span>
                    <span className={`num w-10 text-right font-mono text-[12px] ${m.parse >= 95 ? 'text-violet-hi' : 'text-sub'}`}>{m.parse}</span>
                  </div>
                ))}
                {grp.extra && <p className="pt-2 text-[12px] text-mute">외 {grp.extra}명</p>}
              </div>
            ))}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <MonoLabel violet>APPLY</MonoLabel>
            <div className="mt-2">
              <KV k="모집" v={`딜러 ${t.recruiting.dps} (원딜 우대)`} />
              <KV k="요구 템렙" v="285+" />
              <KV k="소통" v="음성 필수" />
            </div>
            <button className="btn-primary mt-3 w-full">공대 지원하기</button>
          </Card>
          <Card className="p-5">
            <MonoLabel violet>SEASON STATS</MonoLabel>
            <div className="mt-2">
              <KV k="진행" v={`${t.progress.killed}/${t.progress.total}`} />
              <KV k="시도" v={`${t.stats.tries}회`} />
              <KV k="출석률" v={`${t.stats.attendance}%`} />
              <KV k="평균 파스" v={t.stats.avgParse} />
            </div>
          </Card>
          <Card className="p-5">
            <MonoLabel violet>AFFILIATION</MonoLabel>
            <p className="mt-2 text-[14px] font-bold">{base?.name} 기반</p>
            <p className="mt-1 text-[12px] leading-relaxed text-sub">
              무길드 멤버 4명 — 공대는 길드와 독립적으로 운영됩니다.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
