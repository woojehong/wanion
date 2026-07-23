import { Link, useParams } from 'react-router-dom';
import { raidById, ROSTER_SAMPLE } from '../lib/mock';
import { MonoLabel, SectionTitle, Card, DDay, ArtSlot, Avatar, KV, HostBadge } from '../components/ui';

function RoleGroup({ label, colorDot, cap, filled }) {
  const slots = Array.from({ length: cap });
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${colorDot}`} />
        <span className="text-[13px] font-bold">{label}</span>
        <span className="num font-mono text-[12px] text-sub">
          {filled.length}/{cap}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((_, i) => {
          const m = filled[i];
          return m ? (
            <div key={i} className="flex items-center gap-2.5 rounded border border-line bg-surface2 px-3 py-2.5">
              <Avatar name={m.name} color={m.color} size="h-7 w-7" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold" style={{ color: m.color }}>{m.name}</p>
                <p className="num truncate text-[11px] text-sub">{m.cls} · {m.spec} · {m.ilvl}</p>
              </div>
              <span className="ml-auto font-mono text-[10px] text-heal">OK</span>
            </div>
          ) : (
            <div key={i} className="flex items-center justify-center rounded border border-line/70 px-3 py-2.5 text-[13px] text-mute">
              빈 자리
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RaidDetailPage() {
  const { raidId } = useParams();
  const raid = raidById(raidId);
  if (!raid) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">
        존재하지 않는 공대입니다. <Link className="text-violet-hi" to="/board">보드로 돌아가기</Link>
      </main>
    );
  }
  const dps = ROSTER_SAMPLE;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/board" className="text-[12px] text-sub hover:text-txt">← 파티 찾기로</Link>

      {/* 헤더 */}
      <div className="mt-3 overflow-hidden rounded border border-line bg-surface">
        <ArtSlot label={`레이드 키아트 5:1 — ${raid.title}`} ratio="5 / 1" className="!rounded-none border-x-0 border-t-0" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${raid.difficulty === '신화' ? 'border-violet-deep text-violet-hi' : 'border-line text-sub'}`}>
                {raid.difficulty}
              </span>
              <h1 className="text-[22px] font-extrabold">{raid.title}</h1>
              <DDay n={raid.dday} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub">
              <HostBadge raid={raid} />
              <span className="num">{raid.date.slice(5).replace('-', '/')} ({raid.day}) {raid.time}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">신청하기</button>
            <button className="btn-ghost">공유</button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 로스터 */}
        <div>
          <SectionTitle ko="로스터" en="ROSTER GRID · 20 SLOTS" right="확정 기준" />
          <Card className="p-5">
            <RoleGroup label="탱커" colorDot="bg-tank" cap={raid.caps.tank} filled={[]} />
            <RoleGroup label="힐러" colorDot="bg-heal" cap={raid.caps.heal} filled={[]} />
            <RoleGroup label="딜러" colorDot="bg-dps" cap={raid.caps.dps} filled={dps} />
          </Card>

          <div className="mt-6">
            <SectionTitle ko="공대 소개" en="DESCRIPTION" />
            <Card className="p-5 text-[14px] leading-relaxed text-sub">{raid.desc}</Card>
          </div>
        </div>

        {/* 사이드 */}
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <MonoLabel violet>SCHEDULE</MonoLabel>
            <div className="mt-2">
              <KV k="일시" v={`${raid.date.slice(5).replace('-', '/')} (${raid.day}) ${raid.time.split('–')[0]}`} />
              <KV k="공대장" v={raid.leader} />
              <KV k="최소 템렙" v={raid.minIlvl ? `${raid.minIlvl}+` : '제한없음'} />
              <KV k="총원" v={`${raid.counts.tank + raid.counts.heal + raid.counts.dps} / ${raid.caps.tank + raid.caps.heal + raid.caps.dps}`} />
            </div>
          </Card>
          <Card className="p-5">
            <MonoLabel violet>APPLICATIONS</MonoLabel>
            <div className="mt-2">
              <KV k="확정" v="2" />
              <KV k="대기" v="2" />
              <KV k="벤치" v="1" />
            </div>
          </Card>
          <Card className="p-5">
            <MonoLabel violet>ATTENDANCE POINTS</MonoLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-sub">
              출발 시 공대장이 로스터를 <span className="font-semibold text-txt">픽스</span>하면, 일정 종료 후 픽스
              멤버에게 <span className="num font-semibold text-violet-hi">+100P</span>가 지급됩니다. (주 3회 한도)
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
