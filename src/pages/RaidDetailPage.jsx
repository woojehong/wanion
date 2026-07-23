import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
} from '../lib/db';
import { buildInviteCode } from '../lib/bridge';
import { getCaps, normalizeRole } from '../lib/utils';
import { MonoLabel, SectionTitle, Card, DDay, ArtSlot, Avatar, KV, Chip, HostBadge } from '../components/ui';
import SynergyBoard from '../components/SynergyBoard';
import GuestPanel from '../components/GuestPanel';
import SimulatorModal from '../components/SimulatorModal';

const DIFF_LABEL = { normal: '일반', heroic: '영웅', mythic: '신화' };
const pad = (n) => String(n).padStart(2, '0');

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
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [specIds, setSpecIds] = useState([]);
  const [charName, setCharName] = useState('');
  const [server, setServer] = useState(servers.find((s) => s.isDefault)?.ko || servers[0]?.ko || '아즈샤라');
  const [ilvl, setIlvl] = useState('');
  const [bench, setBench] = useState(false); // 벤치 신청 (정원 무관 예비 인원)
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
          guildId: 'none', // P2: BNet 연동 후 실제 길드 검증으로 대체
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
          role: mainRole, // 'heal'로 정규화 — counts·필터·로스터 체계와 일치
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

  const inputCls =
    'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

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
            <input className={inputCls} placeholder="캐릭터명" value={charName} maxLength={12}
              onChange={(e) => setCharName(e.target.value)} />
            <select className={inputCls} value={server} onChange={(e) => setServer(e.target.value)}>
              {servers.map((s) => (
                <option key={s.ko} value={s.ko}>{s.ko}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-sub">클래스</span>
            <div className="flex flex-wrap gap-1">
              {classes.map((c) => (
                <button key={c.id}
                  className={`rounded border px-2 py-1 text-[12px] font-bold transition ${
                    classId === c.id ? '' : 'opacity-50'
                  }`}
                  style={{ color: c.color, borderColor: classId === c.id ? `${c.color}66` : '#1E1E2E' }}
                  onClick={() => { setClassId(c.id); setSpecIds([]); }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-sub">
              특성 (최대 3 · 첫 선택 = 메인, 나머지 = 스왑 가능)
            </span>
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

          <input className={inputCls} placeholder={`아이템레벨${raid.minIlvl ? ` (최소 ${raid.minIlvl})` : ''}`}
            value={ilvl} onChange={(e) => setIlvl(e.target.value.replace(/\D/g, ''))} />

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-sub">
            <input type="checkbox" checked={bench} onChange={(e) => setBench(e.target.checked)} />
            벤치로 신청 (정원과 무관한 예비 인원 — 공대장이 필요 시 호출)
          </label>

          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
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
const ROLE_KO = { tank: '탱', heal: '힐', dps: '딜' };

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
            <div key={m.id} className="group/slot rounded border border-line bg-surface2 px-3 py-2.5">
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
                  <button className="ml-auto text-sub hover:text-dps" onClick={() => onKick(m)}>제외</button>
                </div>
              )}
            </div>
          ) : (
            <div key={`e${i}`} className="flex items-center justify-center rounded border border-line/60 px-3 py-2.5 text-[13px] text-mute">
              빈 자리
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────
export default function RaidDetailPage() {
  const { raidId } = useParams();
  const { uid, user, isPlatformAdmin, signInGoogle } = useApp();
  const [raid, setRaid] = useState(undefined); // undefined=로딩, null=없음
  const [apps, setApps] = useState([]);
  const [guests, setGuests] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeRaid(raidId, setRaid), [raidId]);
  useEffect(() => (user ? subscribeApps(raidId, setApps) : setApps([])), [raidId, user]);
  useEffect(
    () => (user && raid?.guestParty ? subscribeGuests(raidId, setGuests) : setGuests([])),
    [raidId, user, raid?.guestParty]
  );

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

  // 스왑 가능자 (핵심 자산 #2) — 확정 인원 중 역할 전환 가능한 멤버를 역할별로 집계
  const swapCandidates = useMemo(() => {
    const map = { tank: [], heal: [], dps: [] };
    apps
      .filter((a) => a.status === 'active' && a.swap && a.swapRoles?.length)
      .forEach((a) => a.swapRoles.forEach((r) => map[r] && map[r].push(a)));
    return map;
  }, [apps]);
  const swapTotal = swapCandidates.tank.length + swapCandidates.heal.length + swapCandidates.dps.length;

  // 승격·강등·제외 (관리자) — 정원 검사는 updateApplication 트랜잭션이 수행
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

  // 픽스 — 출발 직전 로스터 잠금 (종료 후 포인트 지급 기준점)
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
    return <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">불러오는 중…</main>;
  }
  if (raid === null) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sub">
        존재하지 않거나 종료된 공대입니다. <Link className="text-violet-hi" to="/board">보드로 돌아가기</Link>
      </main>
    );
  }

  const copyInvite = async () => {
    const active = apps.filter((a) => a.status === 'active');
    let parties = {};
    try {
      parties = await fetchSimulation(raid.id); // 시뮬레이터 배치 저장분 → 파티번호 포함
    } catch {
      parties = {};
    }
    const code = buildInviteCode(raid.id, active, { parties, guests }); // 손님 포함 (사양 7.1)
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 코드를 복사하세요', code);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/board" className="text-[12px] text-sub hover:text-txt">← 파티 찾기로</Link>

      <div className="mt-3 overflow-hidden rounded border border-line bg-surface">
        <ArtSlot label={`레이드 키아트 5:1 — ${raid.title}`} ratio="7 / 1" className="!rounded-none border-x-0 border-t-0" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${raid.difficulty === 'mythic' ? 'border-violet-deep text-violet-hi' : 'border-line text-sub'}`}>
                {DIFF_LABEL[raid.difficulty] || raid.difficulty}
              </span>
              <h1 className="text-[22px] font-extrabold">{raid.title}</h1>
              {raid.guestParty && <Chip className="chip-active">손님파티</Chip>}
              {raid.fixed && <Chip>픽스됨</Chip>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub">
              <HostBadge raid={{ hostType: raid.hostType, hostName: raid.hostName, leaderNoGuild: raid.leaderNoGuild }} />
              <span className="num">{fmtRange(raid)}</span>
              {raid.minIlvl && <span className="num">템렙 {raid.minIlvl}+</span>}
              <span className="num">
                {memberCount + guests.length}/{raid.totalCap}
                {raid.guestParty && ` (공대원 ${memberCount} + 손님 ${guests.length})`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!user && <button className="btn-primary" onClick={signInGoogle}>로그인 후 신청</button>}
            {user && !myApp && <button className="btn-primary" onClick={() => setApplyOpen(true)}>신청하기</button>}
            {user && myApp && (
              <button
                className="btn-ghost"
                onClick={() => cancelApplication(raid.id, uid, myApp, '본인 취소').catch(() => {})}
              >
                신청 취소 ({{ active: '확정', wait: '대기', bench: '벤치', pending: '승인 대기' }[myApp.status] || myApp.status})
              </button>
            )}
            {canManage && (
              <>
                <button className="btn-primary" onClick={toggleFix}>
                  {raid.fixed ? '픽스 해제' : '픽스'}
                </button>
                <button className="btn-ghost" onClick={() => setSimOpen(true)}>시뮬레이터</button>
                <button className="btn-ghost" onClick={copyInvite}>
                  {copied ? '복사됨!' : '인게임 초대 코드'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionTitle ko="로스터" en={`ROSTER · ${memberCount}/${raid.totalCap - (raid.guestParty ? guests.length : 0)}`} right={user ? '' : '로그인하면 명단이 보입니다'} />
          <Card className="p-5">
            <RoleGroup label="탱커" dot="bg-tank" cap={caps.tankCap} members={byRole.tank}
              canManage={canManage} onDemote={demote} onKick={kick} />
            <RoleGroup label="힐러" dot="bg-heal" cap={caps.healerCap} members={byRole.heal}
              canManage={canManage} onDemote={demote} onKick={kick} />
            <RoleGroup label="딜러" dot="bg-dps" cap={caps.dpsCap} members={byRole.dps}
              canManage={canManage} onDemote={demote} onKick={kick} />
          </Card>

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

          {(waits.length > 0 || benches.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ['WAITLIST', waits, '정원이 비면 관리자가 확정으로 올립니다'],
                ['BENCH', benches, '정원 무관 예비 인원'],
              ].map(([title, list, hint]) => (
                <Card key={title} className="p-4">
                  <MonoLabel violet>{title} · {list.length}</MonoLabel>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {list.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: a.classColor }}>
                          {a.charName || a.nickname}
                          <span className="ml-1.5 font-normal text-sub">{a.specName} · {ROLE_KO[a.role]}</span>
                        </span>
                        {canManage && (
                          <>
                            <button className="btn-ghost !px-2 !py-0.5 !text-[11px]" onClick={() => promote(a)}>확정</button>
                            <button className="text-[11px] text-sub hover:text-dps" onClick={() => kick(a)}>제외</button>
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
                    <button className="btn-primary !px-3 !py-1 !text-[12px]"
                      onClick={() => approveApplication(raid.id, a.id).catch(() => {})}>수락</button>
                    <button className="btn-ghost !px-3 !py-1 !text-[12px]"
                      onClick={() => cancelApplication(raid.id, a.id, a, '관리자 거절').catch(() => {})}>거절</button>
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
          {user && <GuestPanel raid={raid} guests={guests} canManage={canManage} />}
        </aside>
      </div>

      {applyOpen && <ApplyModalLite raid={raid} onClose={() => setApplyOpen(false)} />}
      {simOpen && <SimulatorModal raid={raid} apps={apps} guests={guests} onClose={() => setSimOpen(false)} />}
    </main>
  );
}
