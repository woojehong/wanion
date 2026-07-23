import { Link, useParams } from 'react-router-dom';
import { guildById, ALLIANCE, RAIDS } from '../lib/mock';
import { MonoLabel, SectionTitle, Card, ArtSlot, Segments, KV, Avatar, Dot } from '../components/ui';
import PostBoard from '../components/PostBoard';

const OFFICERS = [
  { name: '새벽별', role: '길드 마스터', cls: '전사', color: '#C69B6D' },
  { name: '달그림자', role: '관리자', cls: '흑마법사', color: '#8788EE' },
  { name: '서리엄니', role: '관리자', cls: '기원사', color: '#33937F' },
];

export default function GuildPage() {
  const { guildId } = useParams();
  const g = guildById(guildId);
  if (!g) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">
        등록되지 않은 길드입니다 — 와니온에 등록된 길드만 프로필이 제공됩니다.
      </main>
    );
  }
  const recent = RAIDS.filter((r) => r.hostType !== 'user').slice(0, 3);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* 프로필 헤더 */}
      <div className="overflow-hidden rounded border border-line bg-surface">
        <ArtSlot label={`길드 배너 4:1 — ${g.name}`} ratio="6 / 1" className="!rounded-none border-x-0 border-t-0" />
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div className="-mt-14 shrink-0">
            <ArtSlot label="엠블럼 1:1" ratio="1 / 1" className="h-24 w-24 bg-ink" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-extrabold">{g.name}</h1>
              <span className="font-mono text-[11px] tracking-[0.06em] text-heal">VERIFIED</span>
              {g.alliance && (
                <span className="rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-violet-hi">
                  {ALLIANCE.name} 소속
                </span>
              )}
              {g.recruiting && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-heal">
                  <Dot color="bg-heal" /> 모집 중
                </span>
              )}
            </div>
            <MonoLabel className="mt-1 block">{g.server.toUpperCase()} · EST. {g.founded}</MonoLabel>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">가입 신청</button>
            <button className="btn-ghost">공유</button>
          </div>
        </div>
        {/* 스탯 스트립 */}
        <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
          {[['길드원', g.members], ['평균 템렙', g.avgIlvl], ['창단', g.founded], ['이번 시즌 공대', 31]].map(([k, v], i) => (
            <div key={k} className={`p-4 ${i > 0 ? 'border-l border-line' : ''}`}>
              <div className="num text-[18px] font-extrabold">{v}</div>
              <div className="text-[12px] text-sub">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionTitle ko="프로그레스" en="PROGRESS · WARCRAFT LOGS 연동" />
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">공허첨탑 신화</span>
              <span className="num text-[18px] font-extrabold">
                <span className="text-violet">3</span>
                <span className="text-mute">/8</span>
              </span>
            </div>
            <Segments done={3} total={8} className="mt-3" />
            <p className="mt-2 text-[12px] text-sub">최근 킬: 별삼킨 자 · 7/18</p>
          </Card>

          <div className="mt-6">
            <SectionTitle ko="최근 공대" en="RECENT RAIDS" />
            <Card>
              {recent.map((r, i) => (
                <Link key={r.id} to={`/raid/${r.id}`} className={`flex items-center gap-4 p-4 transition hover:bg-surface2 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <span className="num w-14 shrink-0 font-mono text-[12px] text-sub">{r.date.slice(5).replace('-', '/')}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.title}</span>
                  <span className="text-[12px] text-sub">{r.difficulty}</span>
                  <span className="num text-[12px] text-sub">{r.caps.tank + r.caps.heal + r.caps.dps}명</span>
                </Link>
              ))}
            </Card>
          </div>

          <div className="mt-6">
            <SectionTitle ko="길드 게시판" en="GUILD BOARD · 소속원 전용" />
            <PostBoard scopeType="guild" scopeId={guildId} />
          </div>

          <div className="mt-6">
            <SectionTitle ko="길드 임원" en="OFFICERS" />
            <Card>
              {OFFICERS.map((o, i) => (
                <div key={o.name} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <Avatar name={o.name} color={o.color} />
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: o.color }}>{o.name}</p>
                    <p className="text-[12px] text-sub">{o.cls}</p>
                  </div>
                  <span className="ml-auto text-[12px] font-semibold text-sub">{o.role}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <MonoLabel violet>RECRUITING</MonoLabel>
            <div className="mt-2">
              <KV k="탱커" v="마감" />
              <KV k="힐러" v="1자리" />
              <KV k="딜러" v="2자리" />
            </div>
            <p className="mt-2 text-[11px] text-sub">신화 트라이 기준</p>
            <button className="btn-primary mt-3 w-full">가입 신청</button>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              가입 신청에는 {g.name} 소속 캐릭터 1개 이상이 필요합니다 — Battle.net 연동으로 자동 확인됩니다.
            </p>
          </Card>
          <Card className="p-5">
            <MonoLabel violet>GUILD INFO</MonoLabel>
            <div className="mt-2">
              <KV k="서버" v={g.server} />
              <KV k="성향" v="격주 신화" />
              <KV k="활동" v="평일 21–24시" />
              <KV k="디스코드" v="연동됨" />
            </div>
          </Card>
          {g.alliance && (
            <Card className="p-5">
              <MonoLabel violet>ALLIANCE</MonoLabel>
              <p className="mt-2 text-[15px] font-bold">{ALLIANCE.name}</p>
              <p className="mt-1 text-[12px] text-sub">{ALLIANCE.desc}</p>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
