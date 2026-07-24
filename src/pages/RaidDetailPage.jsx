import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  subscribeRaid,
  subscribeApps,
  subscribeGuests,
  submitApplication,
  cancelApplication,
  approveApplication,
  updateApplication,
  fixRoster,
  updateRaid,
  fetchSimulation,
  duplicateRaid,
  applyRosterToRaid,
  fetchTeam,
} from '../lib/db';
import { buildInviteCode } from '../lib/bridge';
import { getCaps, normalizeRole } from '../lib/utils';
import { MonoLabel, SectionTitle, Card, DDay, Avatar, KV, Chip, HostBadge, PhaseIndex, StatusBadge, RosterMeter } from '../components/ui';
import SynergyBoard from '../components/SynergyBoard';
import GuestPanel from '../components/GuestPanel';
import SimulatorModal from '../components/SimulatorModal';

const ROLE_KO = { tank: '탱', heal: '힐', dps: '딜' };
const pad = (n) => String(n).padStart(2, '0');

// 난이도 정규화 — 저장이 'mythic' 또는 '신화' 어느 쪽이어도 동일 처리
const DIFF_META = {
  normal: { label: '일반', color: '#9ca3af' },
  heroic: { label: '영웅', color: '#3b82f6' },
  mythic: { label: '신화', color: '#fbbf24' },
};
const DIFF_ALIAS = { 일반: 'normal', 영웅: 'heroic', 신화: 'mythic' };
const diffMeta = (raw) => DIFF_META[DIFF_META[raw] ? raw : DIFF_ALIAS[raw] || 'heroic'];

function fmtRange(raid) {
  const s = raid.startAt?.toDate ? raid.startAt.toDate() : null;
  const e = raid.endAt?.toDate ? raid.endAt.toDate() : null;
  if (!s) return '';
  const day = '일월화수목금토'[s.getDay()];
  return `${s.getMonth() + 1}/${s.getDate()} (${day}) ${pad(s.getHours())}:${pad(s.getMinutes())}${
    e ? `–${pad(e.getHours())}:${pad(e.getMinutes())}` : ''
  }`;
}

// ── 신청 모달 (P1 간이판 — P2에서 BNet 캐릭터 선택으로 대체) ─────────
function ApplyModalLite({ raid, onClose }) {
  const { uid, profile, gamedata } = useApp();
  const { classes, servers } = gamedata;
  const mainChar = profile?.mainChar || null;
  const [classId, setClassId] = useState(
    mainChar?.classId && classes.some((c) => c.id === mainChar.classId)
      ? mainChar.classId
      : classes[0]?.id || ''
  );
  const [specIds, setSpecIds] = useState([]);
  const [charName, setCharName] = useState(mainChar?.name || '');
  const [server, setServer] = useState(servers.find((s) => s.isDefault)?.ko || servers[0]?.ko || '아즈샤라');
  const [ilvl, setIlvl] = useState('');
  const [bench, setBench] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cls = classes.find((c) => c.id === classId);
  const toggleSpec = (sid) => {
    setSpecIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : prev.length >= 3 ? prev : [...prev, sid]
    );
  };

  const submit = async () => {
    setError('');
    if (!charName.trim()) return setError('캐릭터명을 입력해주세요.');
    if (!specIds.length) return setError('특성을 1개 이상 선택해주세요. (첫 선택이 메인)');
    if (raid.minIlvl != null && (Number(ilvl) || 0) < raid.minIlvl) {
      return setError(`아이템 레벨(${ilvl || '미입력'})이 최소 요구치(${raid.minIlvl})보다 낮습니다.`);
    }
    const mainSpec = cls.specs.find((s) => s.id === specIds[0]);
    const mainRole = normalizeRole(mainSpec.role);
    const swapRoles = [
      ...new Set(
        specIds
          .map((sid) => cls.specs.find((s) => s.id === sid))
          .filter((s) => s && normalizeRole(s.role) !== mainRole)
          .map((s) => normalizeRole(s.role))
      ),
    ];
    setBusy(true);
    try {
      const mode = bench ? 'bench' : raid.acceptMode === 'review' ? 'pending' : 'normal';
      await submitApplication(
        raid.id,
        uid,
        {
          userId: uid,
          nickname: profile?.displayName || '',
          guildId: 'none',
          guildName: '무소속',
          guildColor: '#64748b',
          charName: charName.trim(),
          server,
          classId: cls.id,
          className: cls.name,
          classColor: cls.color,
          specId: mainSpec.id,
          specName: mainSpec.name,
          allSpecNames: specIds.map((sid) => cls.specs.find((s) => s.id === sid)?.name).filter(Boolean),
          role: mainRole,
          range: mainRole === 'dps' ? mainSpec.range || null : null,
          ilvl: Number(ilvl) || 0,
          leaderCapable: false,
          isGuildMaster: false,
          swap: swapRoles.length > 0,
          swapRoles,
          seq: Date.now(),
          isReservation: false,
          via: 'web',
        },
        '',
        mode
      );
      onClose(true);
    } catch (e) {
      setError(e.message || '신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-10 w-full max-w-md rounded border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <MonoLabel violet>APPLY</MonoLabel>
        <h2 className="text-[18px] font-extrabold">
          신청 — {raid.title}
          {raid.acceptMode === 'review' && <span className="ml-2 text-[12px] font-semibold text-sub">검토후수락</span>}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="input-label">캐릭터명</span>
              <input className="input" placeholder="캐릭터명" value={charName} maxLength={12}
                onChange={(e) => setCharName(e.target.value)} />
            </div>
            <div>
              <span className="input-label">서버</span>
              <select className="input" value={server} onChange={(e) => setServer(e.target.value)}>
                {servers.map((s) => (
                  <option key={s.ko} value={s.ko}>{s.ko}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="input-label">클래스</span>
            <div className="flex flex-wrap gap-1">
              {classes.map((c) => (
                <button key={c.id}
                  className={`rounded-btn border px-2 py-1 text-[12px] font-bold transition-colors ${
                    classId === c.id ? '' : 'opacity-50'
                  }`}
                  style={{ color: c.color, borderColor: classId === c.id ? `${c.color}66` : '#292832' }}
                  onClick={() => { setClassId(c.id); setSpecIds([]); }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="input-label">특성 (최대 3 · 첫 선택 = 메인, 나머지 = 스왑 가능)</span>
            <div className="flex flex-wrap gap-1">
              {(cls?.specs || []).map((s) => {
                const idx = specIds.indexOf(s.id);
                return (
                  <Chip key={s.id} active={idx >= 0} onClick={() => toggleSpec(s.id)}>
                    {idx === 0 && '★ '}{s.name}
                    <span className="text-mute"> · {ROLE_KO[normalizeRole(s.role)] || '딜'}</span>
                  </Chip>
                );
              })}
            </div>
          </div>

          <div>
            <span className="input-label">아이템레벨{raid.minIlvl ? ` (최소 ${raid.minIlvl})` : ''}</span>
            <input className="input" placeholder="예: 720" value={ilvl}
              onChange={(e) => setIlvl(e.target.value.replace(/\D/g, ''))} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-sub">
            <input type="checkbox" checked={bench} onChange={(e) => setBench(e.target.checked)} />
            벤치로 신청 (정원과 무관한 예비 인원 — 공대장이 필요 시 호출)
          </label>

          {error && <p className="input-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-tertiary" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? '신청 중…' : bench ? '벤치 신청' : raid.acceptMode === 'review' ? '신청 (승인 대기)' : '신청하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 로스터 그룹 ──────────────────────────────────────────────────────
function RoleGroup({ label, dot, cap, members, canManage, onDemote, onKick }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[13px] font-bold">{label}</span>
        <span className="num font-mono text-[12px] text-sub">{members.length}/{cap}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: Math.max(cap, members.length) }).map((_, i) => {
          const m = members[i];
          return m ? (
            <div key={m.id} className="group/slot rounded-btn border border-line bg-surface2 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={m.charName || m.nickname} color={m.classColor} size="h-7 w-7" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold" style={{ color: m.classColor }}>
                    {m.charName || m.nickname}
                  </p>
                  <p className="num truncate text-[11px] text-sub">
                    {m.className} · {m.specName}{m.ilvl ? ` · ${m.ilvl}` : ''}
                    {m.swap && m.swapRoles?.length
                      ? ` · 스왑(${m.swapRoles.map((r) => ROLE_KO[r]).join('')})`
                      : ''}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="mt-1.5 hidden gap-2 border-t border-line/50 pt-1.5 text-[11px] group-hover/slot:flex">
                  <button className="text-sub hover:text-txt" onClick={() => onDemote(m, 'wait')}>대기로</button>
                  <button className="text-sub hover:text-txt" onClick={() => onDemote(m, 'bench')}>벤치로</button>
                  <button className="ml-auto text-sub hover:text-danger" onClick={() => onKick(m)}>제외</button>
                </div>
              )}
            </div>
          ) : (
            <div key={`e${i}`} className="flex items-center justify-center rounded-btn border border-dashed border-line/60 px-3 py-2.5 text-[13px] text-mute">
              빈 자리
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 복사 모달 (과거 레이드 → 새 날짜, 사양 7.6) ──────────────────────
function CopyRaidModal({ raid, uid, onClose }) {
  const navigate = useNavigate();
  const [dateKey, setDateKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!dateKey) return setError('새 날짜를 선택해주세요.');
    setBusy(true);
    setError('');
    try {
      const newId = await duplicateRaid(raid, dateKey, uid);
      onClose();
      navigate(`/raid/${newId}`);
    } catch (e) {
      setError(e.message || '복사에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-16 w-full max-w-sm rounded border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <MonoLabel violet>COPY RAID</MonoLabel>
        <h2 className="text-[18px] font-extrabold">레이드 복사</h2>
        <p className="mt-1 text-[12px] text-sub">
          "{raid.title}"의 설정(제목·난이도·정원·수락방식 등)을 그대로 새 날짜로 복사합니다. 신청·손님·픽스는 초기화돼요.
        </p>
        <label className="mt-4 block">
          <span className="input-label">새 날짜</span>
          <input type="date" className="input" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
        </label>
        <p className="input-help">시간대는 원본과 동일하게 적용됩니다.</p>
        {error && <p className="input-error">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-tertiary" onClick={onClose}>취소</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? '복사 중…' : '복사하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────
export default function RaidDetailPage() {
  const { raidId } = useParams();
  const navigate = useNavigate();
  const { uid, user, profile, isPlatformAdmin, signInGoogle } = useApp();
  const [raid, setRaid] = useState(undefined);
  const [apps, setApps] = useState([]);
  const [guests, setGuests] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [team, setTeam] = useState(null);

  useEffect(() => subscribeRaid(raidId, setRaid), [raidId]);
  useEffect(() => (user ? subscribeApps(raidId, setApps) : setApps([])), [raidId, user]);
  useEffect(
    () => (user && raid?.guestParty ? subscribeGuests(raidId, setGuests) : setGuests([])),
    [raidId, user, raid?.guestParty]
  );
  useEffect(() => {
    if (raid?.hostType === 'team' && raid.hostId) fetchTeam(raid.hostId).then(setTeam).catch(() => setTeam(null));
    else setTeam(null);
  }, [raid?.hostType, raid?.hostId]);

  const caps = raid ? getCaps(raid) : { tankCap: 2, healerCap: 4, dpsCap: 14 };
  const byRole = useMemo(() => {
    const act = apps.filter((a) => a.status === 'active');
    return {
      tank: act.filter((a) => a.role === 'tank'),
      heal: act.filter((a) => a.role === 'heal'),
      dps: act.filter((a) => a.role === 'dps'),
    };
  }, [apps]);
  const waits = apps.filter((a) => a.status === 'wait');
  const benches = apps.filter((a) => a.status === 'bench');
  const pendings = apps.filter((a) => a.status === 'pending');
  const myApp = apps.find((a) => a.id === uid);
  const canManage = raid && (raid.createdBy === uid || isPlatformAdmin);
  const memberCount = byRole.tank.length + byRole.heal.length + byRole.dps.length;

  const swapCandidates = useMemo(() => {
    const map = { tank: [], heal: [], dps: [] };
    apps
      .filter((a) => a.status === 'active' && a.swap && a.swapRoles?.length)
      .forEach((a) => a.swapRoles.forEach((r) => map[r] && map[r].push(a)));
    return map;
  }, [apps]);
  const swapTotal = swapCandidates.tank.length + swapCandidates.heal.length + swapCandidates.dps.length;

  const promote = (a) =>
    updateApplication(raid.id, a.id, { role: a.role, status: a.status }, { status: 'active' })
      .catch((e) => window.alert(e.message));
  const demote = (a, status) =>
    updateApplication(raid.id, a.id, { role: a.role, status: a.status }, { status })
      .catch((e) => window.alert(e.message));
  const kick = (a) => {
    const reason = window.prompt('제외 사유 (취소 기록에 남습니다)', '관리자 제외');
    if (reason === null) return;
    cancelApplication(raid.id, a.id, a, reason).catch((e) => window.alert(e.message));
  };

  const pasteRoster = async () => {
    const roster = Array.isArray(team?.roster) ? team.roster : [];
    if (!roster.length) return;
    if (!window.confirm(`정규 로스터 ${roster.length}명을 이 레이드에 붙여넣을까요? (역할별 정원 초과분은 대기로)`)) return;
    try {
      const { added } = await applyRosterToRaid(raid, roster);
      window.alert(`정규 로스터 ${added}명을 반영했습니다. 실제 신청자와 겹치는 인원은 자동 제외됩니다.`);
    } catch (e) {
      window.alert(e.message || '붙여넣기에 실패했습니다.');
    }
  };

  const toggleFix = async () => {
    if (raid.fixed) {
      if (!window.confirm('픽스를 해제할까요? 출석 포인트 지급 기준이 초기화됩니다.')) return;
      await updateRaid(raid.id, { fixed: false });
    } else {
      const activeIds = apps.filter((a) => a.status === 'active').map((a) => a.id);
      if (!activeIds.length) return window.alert('확정 인원이 없습니다.');
      if (!window.confirm(`현재 확정 ${activeIds.length}명으로 로스터를 픽스할까요?`)) return;
      await fixRoster(raid.id, activeIds);
    }
  };

  if (raid === undefined) {
    return <main className="mx-auto max-w-content px-4 py-16 text-center text-sub">불러오는 중…</main>;
  }
  if (raid === null) {
    return (
      <main className="mx-auto max-w-content px-4 py-16 text-center text-sub">
        존재하지 않거나 종료된 공대입니다. <Link className="text-violet-hi" to="/board">보드로 돌아가기</Link>
      </main>
    );
  }

  const copyInvite = async () => {
    const active = apps.filter((a) => a.status === 'active');
    let parties = {};
    try {
      parties = await fetchSimulation(raid.id);
    } catch {
      parties = {};
    }
    const code = buildInviteCode(raid.id, active, { parties, guests });
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 코드를 복사하세요', code);
    }
  };

  const dm = diffMeta(raid.difficulty);
  const rosterCap = raid.totalCap - (raid.guestParty ? guests.length : 0);
  const rosterFull = memberCount >= rosterCap;
  const phase = raid.fixed ? 'departing' : memberCount === 0 ? 'recruit' : rosterFull ? 'confirmed' : 'forming';
  const startDate = raid.startAt?.toDate ? raid.startAt.toDate() : null;
  const dday = startDate ? Math.max(0, Math.ceil((startDate.getTime() - Date.now()) / 86400000)) : null;

  return (
    <main className="mx-auto max-w-content px-4 py-8">
      <Link to="/board" className="text-[12px] text-sub hover:text-txt">← 파티 찾기로</Link>

      {/* 헤더 밴드 — 제목·주최·일시·난이도·상태 (정보 위계 1) */}
      <div className="mt-3 flex overflow-hidden rounded border border-line bg-surface">
        <span className="w-1.5 shrink-0" style={{ background: dm.color }} />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseIndex phase={phase} />
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ color: dm.color, borderColor: `${dm.color}66` }}>
                {dm.label}
              </span>
              <h1 className="text-[22px] font-extrabold">{raid.title}</h1>
              {raid.guestParty && <StatusBadge tone="violet">손님파티</StatusBadge>}
              {raid.fixed && <StatusBadge tone="ok">픽스됨</StatusBadge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub">
              <HostBadge raid={{ hostType: raid.hostType, hostName: raid.hostName, leaderNoGuild: raid.leaderNoGuild }} />
              <span className="num">{fmtRange(raid)}</span>
              {raid.minIlvl && <span className="num">템렙 {raid.minIlvl}+</span>}
              <span className="num">
                {memberCount + guests.length}/{raid.totalCap}
                {raid.guestParty && ` (공대원 ${memberCount} + 손님 ${guests.length})`}
              </span>
              {dday != null && <DDay n={dday} />}
            </div>
          </div>
          {/* 내 신청 상태 · 주요 CTA (정보 위계 2) */}
          <div className="flex flex-wrap gap-2">
            {!user && <button className="btn-primary" onClick={signInGoogle}>로그인 후 신청</button>}
            {user && !myApp && (
              <button
                className="btn-primary"
                onClick={() => {
                  if (!profile?.bnetLinked || !profile?.mainCharId) {
                    if (window.confirm('레이드 신청에는 Battle.net 연동과 대표 캐릭터 설정이 필요합니다.\n마이페이지로 이동할까요?')) {
                      navigate('/me');
                    }
                    return;
                  }
                  setApplyOpen(true);
                }}
              >
                신청하기
              </button>
            )}
            {user && myApp && (
              <div className="flex items-center gap-2">
                <StatusBadge tone={myApp.status === 'active' ? 'ok' : myApp.status === 'wait' ? 'warn' : 'default'}>
                  내 신청 · {{ active: '확정', wait: '대기', bench: '벤치', pending: '승인 대기' }[myApp.status] || myApp.status}
                </StatusBadge>
                <button className="btn-secondary" onClick={() => cancelApplication(raid.id, uid, myApp, '본인 취소').catch(() => {})}>
                  신청 취소
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {/* 역할 정원·현재·대기 요약 (정보 위계 3) */}
          <Card className="mb-4 p-4">
            <div className="mb-2 flex items-center justify-between">
              <MonoLabel violet>정원 현황</MonoLabel>
              <span className="num font-mono text-[12px] text-sub">
                확정 {memberCount}/{rosterCap}{waits.length ? ` · 대기 ${waits.length}` : ''}
              </span>
            </div>
            <RosterMeter
              caps={{ tank: caps.tankCap, heal: caps.healerCap, dps: caps.dpsCap }}
              counts={{ tank: byRole.tank.length, heal: byRole.heal.length, dps: byRole.dps.length }}
            />
          </Card>

          {/* 로스터 (정보 위계 4) */}
          <SectionTitle ko="로스터" en={`ROSTER · ${memberCount}/${rosterCap}`} right={user ? '' : '로그인하면 명단이 보입니다'} />
          <Card className="p-5">
            <RoleGroup label="탱커" dot="bg-tank" cap={caps.tankCap} members={byRole.tank} canManage={canManage} onDemote={demote} onKick={kick} />
            <RoleGroup label="힐러" dot="bg-heal" cap={caps.healerCap} members={byRole.heal} canManage={canManage} onDemote={demote} onKick={kick} />
            <RoleGroup label="딜러" dot="bg-dps" cap={caps.dpsCap} members={byRole.dps} canManage={canManage} onDemote={demote} onKick={kick} />
          </Card>

          {/* 스왑 가능자 (정보 위계 6) */}
          {swapTotal > 0 && (
            <Card className="mt-4 p-4">
              <MonoLabel violet>SWAP CANDIDATES · {swapTotal}</MonoLabel>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ['tank', '탱커로 전환 가능'],
                  ['heal', '힐러로 전환 가능'],
                  ['dps', '딜러로 전환 가능'],
                ].map(([r, label]) => (
                  <div key={r}>
                    <span className="text-[11px] font-semibold text-sub">{label}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {swapCandidates[r].map((a) => (
                        <span key={a.id} className="chip" style={{ color: a.classColor }} title={`메인 ${a.className} · ${a.specName}`}>
                          {a.charName || a.nickname}
                        </span>
                      ))}
                      {!swapCandidates[r].length && <span className="text-[12px] text-mute">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 대기·벤치 (정보 위계 6) */}
          {(waits.length > 0 || benches.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ['대기', 'WAITLIST', waits, '정원이 비면 관리자가 확정으로 올립니다'],
                ['벤치', 'BENCH', benches, '정원 무관 예비 인원'],
              ].map(([ko, en, list, hint]) => (
                <Card key={en} className="p-4">
                  <MonoLabel violet>{en} · {list.length}</MonoLabel>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {list.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: a.classColor }}>
                          {a.charName || a.nickname}
                          <span className="ml-1.5 font-normal text-sub">{a.specName} · {ROLE_KO[a.role]}</span>
                        </span>
                        {canManage && (
                          <>
                            <button className="btn-secondary !px-2 !py-0.5 !text-[11px]" onClick={() => promote(a)}>확정</button>
                            <button className="text-[11px] text-sub hover:text-danger" onClick={() => kick(a)}>제외</button>
                          </>
                        )}
                      </div>
                    ))}
                    {!list.length && <span className="text-[12px] text-mute">없음</span>}
                  </div>
                  <p className="mt-2 text-[11px] text-mute">{hint}</p>
                </Card>
              ))}
            </div>
          )}

          {/* 승인 대기 (운영자) */}
          {canManage && pendings.length > 0 && (
            <div className="mt-4">
              <SectionTitle ko="승인 대기" en={`PENDING · ${pendings.length}`} />
              <Card>
                {pendings.map((a, i) => (
                  <div key={a.id} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <Avatar name={a.charName || a.nickname} color={a.classColor} size="h-7 w-7" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: a.classColor }}>
                      {a.charName} <span className="font-normal text-sub">{a.className} · {a.specName} · {a.ilvl}</span>
                    </span>
                    <button className="btn-primary !px-3 !py-1 !text-[12px]" onClick={() => approveApplication(raid.id, a.id).catch(() => {})}>수락</button>
                    <button className="btn-secondary !px-3 !py-1 !text-[12px]" onClick={() => cancelApplication(raid.id, a.id, a, '관리자 거절').catch(() => {})}>거절</button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {raid.description && (
            <div className="mt-6">
              <SectionTitle ko="공대 소개" en="DESCRIPTION" />
              <Card className="p-5 text-[14px] leading-relaxed text-sub">{raid.description}</Card>
            </div>
          )}
        </div>

        {/* 우측 패널 — 시너지(5) · 일정 · 운영 도구(7) · 손님 */}
        <aside className="flex flex-col gap-4">
          <SynergyBoard apps={apps} guests={guests} totalCap={raid.totalCap} />
          <Card className="p-5">
            <MonoLabel violet>SCHEDULE</MonoLabel>
            <div className="mt-2">
              <KV k="일시" v={fmtRange(raid)} />
              <KV k="공대장" v={raid.leader || '-'} />
              <KV k="수락 방식" v={raid.acceptMode === 'review' ? '검토후수락' : '자동수락'} />
              <KV k="최소 템렙" v={raid.minIlvl ? `${raid.minIlvl}+` : '제한없음'} />
            </div>
          </Card>

          {/* 운영 도구 — 공대장/관리자 전용 (일반 화면과 분리, 사양 §7) */}
          {canManage && (
            <Card className="p-4">
              <MonoLabel violet>운영 도구</MonoLabel>
              <div className="mt-2.5 flex flex-col gap-2">
                <button className="btn-primary w-full !py-2 !text-[13px]" onClick={toggleFix}>
                  {raid.fixed ? '픽스 해제' : '로스터 픽스'}
                </button>
                <button className="btn-secondary w-full !py-2 !text-[13px]" onClick={() => setSimOpen(true)}>파티 배치 시뮬레이터</button>
                {raid.hostType === 'team' && Array.isArray(team?.roster) && team.roster.length > 0 && (
                  <button className="btn-secondary w-full !py-2 !text-[13px]" onClick={pasteRoster}>정규 로스터 붙여넣기</button>
                )}
                <button className="btn-secondary w-full !py-2 !text-[13px]" onClick={copyInvite}>
                  {copied ? '복사됨!' : '인게임 초대 코드 복사'}
                </button>
                <button className="btn-tertiary w-full !py-1.5 !text-[13px]" onClick={() => setCopyOpen(true)}>다른 날짜로 복사</button>
              </div>
            </Card>
          )}

          {user && <GuestPanel raid={raid} guests={guests} canManage={canManage} />}
        </aside>
      </div>

      {applyOpen && <ApplyModalLite raid={raid} onClose={() => setApplyOpen(false)} />}
      {simOpen && <SimulatorModal raid={raid} apps={apps} guests={guests} onClose={() => setSimOpen(false)} />}
      {copyOpen && <CopyRaidModal raid={raid} uid={uid} onClose={() => setCopyOpen(false)} />}
    </main>
  );
}
