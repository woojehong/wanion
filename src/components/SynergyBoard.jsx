import { useApp } from '../context/AppContext';
import { analyzeCoverage } from '../lib/raidAbilities';
import { MonoLabel } from './ui';

// 시너지 란 전용 클래스 축약명
const ABBR = {
  demonhunter: '악사', druid: '드루', evoker: '기원', hunter: '냥꾼', mage: '법사',
  monk: '수도', paladin: '기사', priest: '사제', rogue: '도적', shaman: '술사',
  warrior: '전사', warlock: '흑마', deathknight: '죽기',
};

/**
 * 공격대 시너지 트래커 (kgusystem 계승 · 핵심 자산 #1).
 * 확정(active) 인원 기준으로 클래스 칩이 점등된다.
 * 손님파티: 손님은 카운팅에서 제외하되, 공대원 미보유 + 손님 보유 클래스는
 * "손님" 힌트 배지로 뉘앙스만 전달한다 (사양 7.1).
 */
export default function SynergyBoard({ apps, guests = [], totalCap = 0 }) {
  const { gamedata } = useApp();
  const { synergies, classes } = gamedata;

  const activeCount = apps.filter((a) => a.status === 'active').length;
  const presentClasses = new Set(
    apps.filter((a) => a.status === 'active' && a.classId).map((a) => a.classId)
  );
  const guestClasses = new Set(guests.filter((g) => g.classId).map((g) => g.classId));

  const chipsFor = (type) => {
    const seen = new Set();
    return synergies
      .filter((s) => s.type === type)
      .filter((s) => (seen.has(s.classId) ? false : seen.add(s.classId)))
      .map((s) => {
        const cls = classes.find((c) => c.id === s.classId);
        const has = presentClasses.has(s.classId);
        const guestHint = !has && guestClasses.has(s.classId);
        const color = cls?.color || '#8B8B9E';
        const tooltip = synergies
          .filter((x) => x.classId === s.classId && x.type === type)
          .map((x) => `${x.name}: ${x.effect}`)
          .join(' / ');
        return (
          <span
            key={s.classId}
            title={guestHint ? `${tooltip} — 손님 중 보유 (카운팅 제외)` : tooltip}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold transition ${
              has ? '' : 'opacity-45 grayscale'
            }`}
            style={{
              color: has ? color : '#8B8B9E',
              borderColor: has ? `${color}55` : '#1E1E2E',
              backgroundColor: has ? `${color}14` : 'transparent',
            }}
          >
            {ABBR[s.classId] || cls?.name || ''}
            {guestHint && (
              <i className="not-italic rounded bg-surface2 px-1 font-mono text-[9px] tracking-[0.04em] text-sub opacity-100" style={{ filter: 'none' }}>
                손님
              </i>
            )}
          </span>
        );
      });
  };

  // ── 커버리지 판정 (raidAbilities 로직 그대로 — 핵심 자산 #1) ──────
  const activeMembers = apps.filter((a) => a.status === 'active');
  const coverage = analyzeCoverage(activeMembers);
  const ownerNames = (owners) =>
    owners.map((o) => (
      <span key={o.id || o.charName} className="font-semibold" style={{ color: o.classColor || undefined }}>
        {o.charName || o.nickname}
      </span>
    ));

  const DebuffRow = ({ label, data }) => (
    <div className="flex items-start justify-between gap-2 py-1 text-[12px]">
      <span className={data.present ? 'text-txt' : 'font-semibold text-dps'}>
        {label}{!data.present && ' — 미보유'}
      </span>
      <span className="flex flex-wrap justify-end gap-x-1.5">{ownerNames(data.owners)}</span>
    </div>
  );

  return (
    <div className="rounded border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <MonoLabel violet>SYNERGY TRACKER</MonoLabel>
        <span className="num font-mono text-[12px] text-sub">
          확정 {activeCount}/{totalCap}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">{chipsFor('buff')}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">{chipsFor('utility')}</div>

      <div className="mt-3 border-t border-line pt-2.5">
        <MonoLabel>DEBUFF COVERAGE</MonoLabel>
        <DebuffRow label="물리뎀증 (신비한 손길)" data={coverage.physical} />
        <DebuffRow label="마법뎀증 (혼돈의 낙인)" data={coverage.magic} />
      </div>

      {coverage.movement.length > 0 && (
        <div className="mt-2 border-t border-line pt-2.5">
          <MonoLabel>MOVEMENT</MonoLabel>
          {coverage.movement.map((m) => (
            <div key={m.name} className="flex items-start justify-between gap-2 py-1 text-[12px]">
              <span className="text-sub">{m.name}</span>
              <span className="flex flex-wrap justify-end gap-x-1.5">{ownerNames(m.owners)}</span>
            </div>
          ))}
        </div>
      )}

      {coverage.raidCds.length > 0 && (
        <div className="mt-2 border-t border-line pt-2.5">
          <MonoLabel>RAID COOLDOWNS · {coverage.raidCds.length}</MonoLabel>
          {coverage.raidCds.map((c, i) => (
            <div key={`${c.name}${i}`} className="flex items-start justify-between gap-2 py-1 text-[12px]">
              <span className="text-sub">{c.name}</span>
              <span className="flex flex-wrap justify-end gap-x-1.5">{ownerNames(c.owners)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
