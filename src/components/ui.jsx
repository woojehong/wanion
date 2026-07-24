// WANION shared UI atoms — 디자인 시스템의 최소 단위.
// 규칙: 액센트(바이올렛)는 CTA·활성 상태·핵심 수치에만. 이모지 금지. 8px 리듬.

export function MonoLabel({ children, violet = false, className = '' }) {
  return <span className={`${violet ? 'mono-label-violet' : 'mono-label'} ${className}`}>{children}</span>;
}

export function SectionTitle({ ko, en, right }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div className="flex items-stretch gap-2.5">
        <span className="section-bar" />
        <div>
          <h2 className="text-[18px] font-bold leading-tight text-txt">{ko}</h2>
          {en && <MonoLabel violet>{en}</MonoLabel>}
        </div>
      </div>
      {right && <div className="text-[12px] text-sub">{right}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded border border-line bg-surface ${className}`}>{children}</div>;
}

export function Chip({ children, active = false, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag onClick={onClick} className={`chip ${active ? 'chip-active' : ''} ${onClick ? 'cursor-pointer hover:border-violet-deep' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

export function Dot({ color = 'bg-violet', className = '' }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${className}`} />;
}

export function DDay({ n }) {
  if (n == null) return null;
  const label = n === 0 ? 'D-DAY' : `D-${n}`;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${n <= 1 ? 'border-violet-deep text-violet-hi' : 'border-line text-sub'}`}>
      {label}
    </span>
  );
}

/** 탱/힐/딜 정원을 작은 사각형으로 시각화 — WANION 시그니처 컴포넌트 */
export function SlotSquares({ caps, counts, compact = false }) {
  const roles = [
    { key: 'tank', label: '탱', fill: 'bg-tank', line: 'border-tank/50' },
    { key: 'heal', label: '힐', fill: 'bg-heal', line: 'border-heal/50' },
    { key: 'dps', label: '딜', fill: 'bg-dps', line: 'border-dps/50' },
  ];
  const size = compact ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {roles.map((r) => (
        <div key={r.key} className="flex items-center gap-1.5">
          <span className="w-4 text-[11px] font-semibold text-sub">{r.label}</span>
          <span className="num font-mono text-[11px] text-txt">
            {counts[r.key]}/{caps[r.key]}
          </span>
          <span className="flex gap-[3px]">
            {Array.from({ length: caps[r.key] }).map((_, i) => (
              <i key={i} className={`${size} rounded-[2px] border ${i < counts[r.key] ? `${r.fill} border-transparent` : `bg-transparent ${r.line} opacity-60`}`} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 프로그레스 세그먼트 바 (예: 신화 5/8) */
export function Segments({ done, total, className = '' }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {Array.from({ length: total }).map((_, i) => (
        <i key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-violet' : 'bg-line'}`} />
      ))}
    </div>
  );
}

/** AI 생성 이미지가 들어갈 자리 — 초안에서는 규격 라벨로 표시 */
export function ArtSlot({ label, ratio = '16 / 9', className = '' }) {
  return (
    <div
      className={`flex items-center justify-center rounded border border-dashed border-violet-deep/60 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(138,112,255,0.04)_8px,rgba(138,112,255,0.04)_9px)] ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <MonoLabel violet className="px-3 text-center">AI ART · {label}</MonoLabel>
    </div>
  );
}

export function Avatar({ name, color = '#8A70FF', size = 'h-8 w-8', className = '' }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded bg-surface2 text-[12px] font-bold ${className}`}
      style={{ color }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function KV({ k, v }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 text-[13px] last:border-0">
      <span className="text-sub">{k}</span>
      <span className="num font-semibold text-txt">{v}</span>
    </div>
  );
}

export function HostBadge({ raid }) {
  const map = { alliance: '연합', guild: '길드', team: '공대', user: '개인' };
  return (
    <span className="flex items-center gap-1.5">
      <Chip className="!py-0">{map[raid.hostType]}</Chip>
      <span className="text-[13px] font-semibold text-txt">{raid.hostName}</span>
      {raid.leaderNoGuild && (
        <span className="rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-violet-hi">무소속 · 공대장</span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 디자인 v2 신규 원자 (design-system.md 9·6·8·상태화면 항목)
// ─────────────────────────────────────────────────────────────

/**
 * 월상 상태 인덱스 — 모집○ 구성◔ 확정● 출발◕ 기록◑
 * 기호 옆에 상태 텍스트를 반드시 함께 쓴다. 오컬트 장식 금지(design-system 9항).
 * phase: 'recruit' | 'forming' | 'confirmed' | 'departing' | 'recorded'
 * rail=true 이면 5단계 전체를 진행 레일로 표시(현재 단계 강조).
 */
export const PHASES = [
  { key: 'recruit', sym: '○', ko: '모집' },
  { key: 'forming', sym: '◔', ko: '구성' },
  { key: 'confirmed', sym: '●', ko: '확정' },
  { key: 'departing', sym: '◕', ko: '출발' },
  { key: 'recorded', sym: '◑', ko: '기록' },
];

export function PhaseIndex({ phase = 'recruit', rail = false, showText = true, className = '' }) {
  const idx = Math.max(0, PHASES.findIndex((p) => p.key === phase));
  if (!rail) {
    const p = PHASES[idx];
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="text-[13px] leading-none text-violet-hi" aria-hidden>
          {p.sym}
        </span>
        {showText && <span className="text-[12px] font-semibold text-txt">{p.ko}</span>}
      </span>
    );
  }
  return (
    <div className={`flex items-center gap-2 ${className}`} role="list" aria-label="주간 진행 단계">
      {PHASES.map((p, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={p.key} role="listitem" className="flex items-center gap-1.5">
            <span
              className={`text-[13px] leading-none ${active ? 'text-violet-hi' : done ? 'text-sub' : 'text-mute'}`}
              aria-hidden
            >
              {p.sym}
            </span>
            <span
              className={`text-[12px] ${active ? 'font-bold text-txt' : done ? 'font-medium text-sub' : 'text-mute'}`}
            >
              {p.ko}
            </span>
            {i < PHASES.length - 1 && <span className="mx-0.5 h-px w-4 bg-line" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 상태 배지 — 색·배경·텍스트를 함께 바꾼다(design-system 5항).
 * tone: 'default' | 'violet' | 'ok' | 'warn' | 'danger' | 'mute'
 */
export function StatusBadge({ children, tone = 'default', className = '' }) {
  const tones = {
    default: 'border-line bg-surface2 text-sub',
    violet: 'border-violet-deep bg-violet/10 text-violet-hi',
    ok: 'border-heal/40 bg-heal/10 text-heal',
    warn: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    danger: 'border-danger/50 bg-danger/10 text-danger',
    mute: 'border-line bg-transparent text-mute',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.default} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * 로스터 미터 — 탱/힐/딜 현재/정원을 가는 막대로.
 * 역할색은 작은 슬롯에만 쓴다(design-system 2항). 넓은 배경으로 쓰지 않음.
 */
export function RosterMeter({ caps = {}, counts = {}, className = '' }) {
  const roles = [
    { key: 'tank', label: '탱', bar: 'bg-tank' },
    { key: 'heal', label: '힐', bar: 'bg-heal' },
    { key: 'dps', label: '딜', bar: 'bg-dps' },
  ];
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {roles.map((r) => {
        const cap = caps[r.key] || 0;
        const cur = Math.min(counts[r.key] || 0, cap);
        const pct = cap ? (cur / cap) * 100 : 0;
        const full = cap > 0 && cur >= cap;
        return (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-[11px] font-semibold text-sub">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <i className={`block h-full rounded-full ${r.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`num w-10 shrink-0 text-right font-mono text-[11px] ${full ? 'text-mute' : 'text-txt'}`}>
              {cur}/{cap}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 빈 상태 — 설명 + 다음 행동(screen-map 상태화면). 필요할 때만 WANI(art) 사용.
 * art: 선택적 ReactNode(캐릭터 이미지 등). 기본은 월상 표식.
 */
export function EmptyState({ title, desc, action, art = null, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-14 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-[20px] text-mute" aria-hidden>
        {art || '○'}
      </div>
      {title && <p className="text-[15px] font-bold text-txt">{title}</p>}
      {desc && <p className="max-w-xs text-[13px] leading-relaxed text-sub">{desc}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
