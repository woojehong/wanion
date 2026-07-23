import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  upsertGuest,
  removeGuest,
  setGuestFee,
  subscribeGuestFees,
  assertNoGuests,
  updateRaid,
} from '../lib/db';
import { MonoLabel, Card, Chip } from './ui';

const inputCls =
  'w-full rounded border border-line bg-surface2 px-2.5 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep';

/**
 * 손님파티 관리 패널 (사양 7.1) — 생성자·슈퍼관리자 전용.
 * - 손님 등록: 캐릭명+서버+클래스 필수, 유형·업비 선택
 * - 업비: 기본 비공개, [공개] 시 더블 컨펌 → 소속 공대원만 열람 (컬렉션 분리로 강제)
 * - 일반 파티 전환: 손님이 남아 있으면 차단 + 경고
 */
export default function GuestPanel({ raid, guests, canManage }) {
  const { gamedata, user } = useApp();
  const { classes, servers } = gamedata;
  const [fees, setFees] = useState({});
  const [form, setForm] = useState(null); // null=닫힘, {}=신규, {id,...}=수정
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => (user ? subscribeGuestFees(raid.id, setFees) : undefined), [raid.id, user]);

  const openNew = () =>
    setForm({
      charName: '',
      server: servers.find((s) => s.isDefault)?.ko || servers[0]?.ko || '아즈샤라',
      classId: classes[0]?.id || '',
      guestType: '',
      gold: '',
    });

  const save = async () => {
    if (!form.charName.trim()) return setMsg('캐릭터명을 입력해주세요.');
    if (!form.classId) return setMsg('클래스를 선택해주세요. (시너지 힌트에 필요)');
    setBusy(true);
    setMsg('');
    try {
      const cls = classes.find((c) => c.id === form.classId);
      const id = form.id || `g_${Date.now().toString(36)}`;
      await upsertGuest(raid.id, id, {
        charName: form.charName.trim(),
        server: form.server,
        classId: cls.id,
        className: cls.name,
        classColor: cls.color,
        guestType: form.guestType.trim() || null,
        status: 'confirmed',
      });
      if (form.gold !== '' && form.gold != null) await setGuestFee(raid.id, id, form.gold);
      setForm(null);
    } catch (e) {
      setMsg(e.message || '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const toggleFeePublic = async () => {
    if (!raid.feePublic) {
      // 더블 컨펌 (사양: 경고창 2회)
      if (!window.confirm('업비를 공개하시겠습니까?\n공개 범위: 이 공대에 신청한 공대원만 (손님·외부인 제외)')) return;
      if (!window.confirm('정말 공개하시겠습니까? 공대원 전원이 손님별 업비 금액을 보게 됩니다.')) return;
      await updateRaid(raid.id, { feePublic: true });
    } else {
      await updateRaid(raid.id, { feePublic: false });
    }
  };

  const toGuestParty = () => updateRaid(raid.id, { guestParty: true });
  const toNormalParty = async () => {
    try {
      await assertNoGuests(raid.id);
      await updateRaid(raid.id, { guestParty: false, feePublic: false });
    } catch (e) {
      window.alert(e.message); // "손님을 제거하거나 일반 공대원으로 변경해주세요."
    }
  };

  // 일반 파티 + 관리자 → 손님파티 전환 버튼만
  if (!raid.guestParty) {
    if (!canManage) return null;
    return (
      <Card className="p-4">
        <MonoLabel violet>GUEST PARTY</MonoLabel>
        <p className="mt-1.5 text-[12px] leading-relaxed text-sub">
          손님(버스) 운영이 필요하면 손님파티로 전환하세요 — 손님 등록·업비 관리 패널이 열립니다.
        </p>
        <button className="btn-ghost mt-2 w-full !py-1.5 !text-[13px]" onClick={toGuestParty}>
          손님파티로 전환
        </button>
      </Card>
    );
  }

  const totalGold = Object.values(fees).reduce((s, g) => s + (Number(g) || 0), 0);
  const feeVisible = Object.keys(fees).length > 0; // 규칙상 읽히면 = 열람 권한 있음

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <MonoLabel violet>GUESTS · {guests.length}</MonoLabel>
        {canManage && (
          <button className="text-[12px] font-semibold text-violet-hi hover:underline" onClick={openNew}>
            + 손님 등록
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {guests.map((g) => (
          <div key={g.id} className="flex items-center gap-2 rounded border border-line bg-surface2 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: g.classColor || undefined }}>
              {g.charName}
              <span className="font-mono text-[11px] font-normal text-sub">-{g.server}</span>
            </span>
            {g.guestType && <Chip className="!py-0 !text-[11px]">{g.guestType}</Chip>}
            {g.status === 'applied' && <Chip className="!py-0 !text-[11px] chip-active">지원</Chip>}
            {feeVisible && fees[g.id] != null && (
              <span className="num font-mono text-[11px] text-heal">{Number(fees[g.id]).toLocaleString()}만</span>
            )}
            {canManage && (
              <>
                <button
                  className="text-[11px] text-sub hover:text-txt"
                  onClick={() => setForm({ id: g.id, charName: g.charName, server: g.server, classId: g.classId, guestType: g.guestType || '', gold: fees[g.id] ?? '' })}
                >
                  수정
                </button>
                <button className="text-[11px] text-dps hover:underline" onClick={() => removeGuest(raid.id, g.id)}>
                  제거
                </button>
              </>
            )}
          </div>
        ))}
        {!guests.length && <span className="text-[12px] text-mute">등록된 손님 없음</span>}
      </div>

      {canManage && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          {feeVisible && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-sub">총 업비</span>
              <span className="num font-mono font-bold text-heal">{totalGold.toLocaleString()}만골</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-sub">업비 공개 (공대원 한정)</span>
            <Chip active={!!raid.feePublic} onClick={toggleFeePublic}>
              {raid.feePublic ? '공개 중' : '비공개'}
            </Chip>
          </div>
          <button className="btn-ghost mt-1 !py-1.5 !text-[12px]" onClick={toNormalParty}>
            일반 파티로 전환
          </button>
        </div>
      )}

      {/* 등록/수정 폼 */}
      {form && (
        <div className="mt-3 flex flex-col gap-2 rounded border border-violet-deep/50 bg-surface2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="캐릭터명" value={form.charName} maxLength={12}
              onChange={(e) => setForm({ ...form, charName: e.target.value })} />
            <select className={inputCls} value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })}>
              {servers.map((s) => <option key={s.ko} value={s.ko}>{s.ko}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className={inputCls} placeholder="유형 (깡/업적/탈것… 선택)" value={form.guestType} maxLength={10}
              onChange={(e) => setForm({ ...form, guestType: e.target.value })} />
          </div>
          <input className={inputCls} placeholder="업비 (만골 단위 · 선택 · 생성자만 열람)" value={form.gold}
            onChange={(e) => setForm({ ...form, gold: e.target.value.replace(/\D/g, '') })} />
          {msg && <p className="text-[12px] font-semibold text-dps">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost !py-1 !text-[12px]" onClick={() => setForm(null)}>취소</button>
            <button className="btn-primary !py-1 !text-[12px]" disabled={busy} onClick={save}>
              {form.id ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
