import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { createRaid, fetchGuilds, fetchTeams, fetchAlliances } from '../lib/db';
import { buildRaidTimes } from '../lib/utils';
import { DIFFICULTIES, DEFAULT_SUBCATEGORIES } from '../lib/constants';
import { MonoLabel, Chip } from './ui';

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

// '2000' '20' '20:0' 같은 축약 입력을 HH:mm으로 정규화 (kgusystem 계승)
function normalizeTimeStr(t) {
  const s = (t || '').trim().replace(/[;.\s]/g, ':');
  if (/^\d{3,4}$/.test(s)) return `${s.slice(0, s.length - 2)}:${s.slice(-2)}`;
  if (/^\d{1,2}$/.test(s)) return `${s}:00`;
  return s;
}

const HOST_OPTIONS = [
  { type: 'user', label: '개인 (글로벌 파티)' },
  { type: 'alliance', label: '연합' },
  { type: 'guild', label: '길드' },
  { type: 'team', label: '공격대' },
];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-sub">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

/**
 * 레이드 생성 모달 — kgusystem RaidFormModal 계승 + WANION 확장:
 * 주최 스코프(개인/연합/길드/공대) · 수락 모드(자동/검토) · 손님파티 플래그.
 */
export default function RaidFormModal({ open, onClose }) {
  const { uid, profile } = useApp();
  const [hostType, setHostType] = useState('user');
  const [hostId, setHostId] = useState('');
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState('');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [difficulty, setDifficulty] = useState('heroic');
  const [totalCap, setTotalCap] = useState(20);
  const [healerCap, setHealerCap] = useState(4);
  const [noIlvlLimit, setNoIlvlLimit] = useState(true);
  const [minIlvl, setMinIlvl] = useState('280');
  const [subCategory, setSubCategory] = useState('none');
  const [allowNoGuild, setAllowNoGuild] = useState(true);
  const [acceptMode, setAcceptMode] = useState('review');
  const [guestParty, setGuestParty] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orgs, setOrgs] = useState({ guild: [], team: [], alliance: [] });

  // 실제 조직을 Firestore에서 로드 (시드 하드코딩 제거)
  useEffect(() => {
    if (!open) return;
    Promise.all([fetchGuilds(), fetchTeams(), fetchAlliances()])
      .then(([g, t, a]) =>
        setOrgs({ guild: g.filter((x) => !x.isNone && !x.isUnion), team: t, alliance: a })
      )
      .catch(() => {});
  }, [open]);

  const hostList = useMemo(() => orgs[hostType] || [], [orgs, hostType]);

  // 주최 유형/목록 변경 시 기본값 정렬 — 글로벌=검토, 조직=자동 (사양 7.4)
  useEffect(() => {
    setAcceptMode(hostType === 'user' ? 'review' : 'auto');
    const list = orgs[hostType] || [];
    setHostId(hostType === 'user' ? '' : list[0]?.id || '');
  }, [hostType, orgs]);

  if (!open) return null;

  const hostName =
    hostType === 'user'
      ? profile?.displayName || '개인'
      : hostList.find((h) => h.id === hostId)?.name || '';

  const dpsCap = totalCap - 2 - healerCap;

  const submit = async () => {
    setError('');
    if (!title.trim()) return setError('제목을 입력해주세요.');
    if (!dateKey) return setError('날짜를 선택해주세요.');
    const ns = normalizeTimeStr(startTime);
    const ne = normalizeTimeStr(endTime);
    if (!TIME_PATTERN.test(ns) || !TIME_PATTERN.test(ne)) {
      return setError('시간을 올바르게 입력해주세요. (예: 20:00)');
    }
    if (totalCap < 10 || totalCap > 40) return setError('총원은 10~40명 사이로 설정해주세요.');
    if (dpsCap < 0) return setError('힐러 수가 총원을 초과합니다.');
    if (!noIlvlLimit && !/^\d+$/.test(minIlvl)) return setError('최소 아이템레벨은 정수로 입력해주세요.');
    if (hostType !== 'user' && !hostId) return setError('주최 조직을 선택해주세요.');

    setBusy(true);
    try {
      const { startAt, endAt } = buildRaidTimes(dateKey, ns, ne);
      await createRaid(
        {
          title: title.trim(),
          dateKey,
          startAt,
          endAt,
          difficulty,
          totalCap,
          healerCap,
          minIlvl: noIlvlLimit ? null : Number(minIlvl),
          description: description.trim(),
          subCategory,
          hostType,
          hostId: hostType === 'user' ? uid : hostId,
          hostName: hostType === 'user' ? `${hostName}` : hostName,
          leader: profile?.displayName || '',
          leaderNoGuild: hostType === 'user',
          allowedGuilds: 'all', // P1: 길드 제한은 상세 편집에서 (P1-후속: 길드 선택 UI)
          waitGuilds: 'all',
          allowNoGuild,
          acceptMode,
          guestParty,
        },
        uid
      );
      onClose(true);
    } catch (e) {
      setError(e.message || '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-8 w-full max-w-lg rounded border border-line bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <MonoLabel violet>NEW RAID</MonoLabel>
            <h2 className="text-[18px] font-extrabold">파티 개설</h2>
          </div>
          <button className="text-sub hover:text-txt" onClick={() => onClose(false)}>닫기</button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <Field label="주최">
            <div className="flex flex-wrap gap-1.5">
              {HOST_OPTIONS.map((o) => (
                <Chip key={o.type} active={hostType === o.type} onClick={() => setHostType(o.type)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Field>

          {hostType !== 'user' && (
            <Field label="주최 조직">
              <select className={inputCls} value={hostId} onChange={(e) => setHostId(e.target.value)}>
                {hostList.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="제목">
            <input className={inputCls} value={title} maxLength={40} placeholder="예: 공허첨탑 정기 공대"
              onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="날짜">
              <input type="date" className={inputCls} value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            </Field>
            <Field label="시작">
              <input className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="20:00" />
            </Field>
            <Field label="종료">
              <input className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="23:00" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="난이도">
              <select className={inputCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {Object.entries(DIFFICULTIES).map(([id, d]) => (
                  <option key={id} value={id}>{d.label || id}</option>
                ))}
              </select>
            </Field>
            <Field label={`총원 (${totalCap})`}>
              <input type="number" min={10} max={40} className={inputCls} value={totalCap}
                onChange={(e) => setTotalCap(Number(e.target.value))} />
            </Field>
            <Field label={`힐러 정원 (딜러 ${Math.max(dpsCap, 0)})`}>
              <input type="number" min={0} max={10} className={inputCls} value={healerCap}
                onChange={(e) => setHealerCap(Number(e.target.value))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="최소 아이템레벨">
              <div className="flex items-center gap-2">
                <Chip active={noIlvlLimit} onClick={() => setNoIlvlLimit(true)}>제한없음</Chip>
                <Chip active={!noIlvlLimit} onClick={() => setNoIlvlLimit(false)}>지정</Chip>
                {!noIlvlLimit && (
                  <input className={`${inputCls} !w-20`} value={minIlvl} onChange={(e) => setMinIlvl(e.target.value)} />
                )}
              </div>
            </Field>
            <Field label="소분류">
              <select className={inputCls} value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {DEFAULT_SUBCATEGORIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded border border-line bg-surface2 p-3">
            <label className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-txt">수락 방식</span>
              <span className="flex gap-1.5">
                <Chip active={acceptMode === 'auto'} onClick={() => setAcceptMode('auto')}>자동수락</Chip>
                <Chip active={acceptMode === 'review'} onClick={() => setAcceptMode('review')}>검토후수락</Chip>
              </span>
            </label>
            <label className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-txt">무길드(무소속) 참가 허용</span>
              <Chip active={allowNoGuild} onClick={() => setAllowNoGuild(!allowNoGuild)}>
                {allowNoGuild ? '허용' : '차단'}
              </Chip>
            </label>
            <label className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-txt">
                손님파티 <span className="text-mute">(버스 — 손님 관리 패널 활성화)</span>
              </span>
              <Chip active={guestParty} onClick={() => setGuestParty(!guestParty)}>
                {guestParty ? '손님파티' : '일반'}
              </Chip>
            </label>
          </div>

          <Field label="소개 (선택)">
            <textarea className={`${inputCls} h-20 resize-none`} value={description} maxLength={300}
              onChange={(e) => setDescription(e.target.value)} placeholder="오리엔테이션, 분배 규칙, 준비물 등" />
          </Field>

          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? '생성 중…' : '파티 개설'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
