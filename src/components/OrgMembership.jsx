import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  subscribeMyCharacters,
  applyToOrg,
  fetchPendingOrgApplications,
  decideOrgApplication,
  setOrgMemberRole,
  removeMembership,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, Avatar, Chip } from './ui';

const inputCls =
  'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

const SCOPE_TEXT = {
  guild: {
    joinTitle: '가입 신청',
    charLabel: '이 길드 소속(예정)인 내 캐릭터',
    memberLabel: '길드원',
    manageTitle: '길드원 관리',
    verifyNote: '길드 마스터가 확인 후 승인합니다. 캐릭터의 실제 길드 소속은 P3에서 전투정보실 로스터로 자동 검증됩니다.',
  },
  team: {
    joinTitle: '공대 지원',
    charLabel: '지원할 캐릭터',
    memberLabel: '공대원',
    manageTitle: '공대원 관리',
    verifyNote: '공대장이 확인 후 승인합니다. 승인되면 정규 로스터 편성 대상이 됩니다.',
  },
};

export const ORG_ROLE_LABELS = {
  master: '길드 마스터',
  leader: '공대장',
  officer: '관리자',
  member: '멤버',
};

// ── 가입/지원 모달 — 캐릭터 스냅샷 선택 (사양 §4: BNet 캐릭 필수) ────
export function OrgJoinModal({ scopeType, scopeId, orgName, onClose }) {
  const { uid, profile } = useApp();
  const t = SCOPE_TEXT[scopeType] || SCOPE_TEXT.guild;
  const [chars, setChars] = useState([]);
  const [charId, setCharId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => (uid ? subscribeMyCharacters(uid, setChars) : undefined), [uid]);

  const submit = async () => {
    setError('');
    const character = chars.find((c) => c.id === charId);
    if (!character) return setError('캐릭터를 선택해주세요.');
    setBusy(true);
    try {
      await applyToOrg(scopeType, scopeId, {
        uid,
        displayName: profile?.displayName,
        battletag: profile?.battletag,
        character,
        message,
      });
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
        <MonoLabel violet>JOIN REQUEST</MonoLabel>
        <h2 className="text-[17px] font-extrabold">{orgName} {t.joinTitle}</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-sub">{t.charLabel}</span>
            <div className="flex flex-wrap gap-1.5">
              {chars.map((c) => (
                <Chip key={c.id} active={charId === c.id} onClick={() => setCharId(c.id)}>
                  <span style={{ color: c.classColor || undefined }} className="font-bold">{c.name}</span>
                  <span className="ml-1 text-mute">{c.className}</span>
                </Chip>
              ))}
              {!chars.length && (
                <span className="text-[12px] text-mute">등록된 캐릭터가 없습니다 — 마이페이지에서 BNet을 연동해주세요.</span>
              )}
            </div>
          </div>
          <textarea
            className={`${inputCls} h-24 resize-none`}
            placeholder="한마디 (선택)"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-[11px] leading-relaxed text-mute">{t.verifyNote}</p>
          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? '신청 중…' : t.joinTitle}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 관리 패널 (최고 책임자 전용) — 승인 + 소속원 관리 (kgu 계승) ─────
export function OrgManagePanel({ scopeType, scopeId, members, reloadMembers }) {
  const { uid } = useApp();
  const t = SCOPE_TEXT[scopeType] || SCOPE_TEXT.guild;
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reloadPending = useCallback(() => {
    fetchPendingOrgApplications(scopeType, scopeId).then(setPending).catch(() => setPending([]));
  }, [scopeType, scopeId]);
  useEffect(() => { reloadPending(); }, [reloadPending]);

  const run = async (fn, okText) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      reloadPending();
      reloadMembers();
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const decide = (app, accept) => {
    if (!accept && !window.confirm(`${app.displayName}님의 신청을 거절할까요?`)) return;
    run(
      () => decideOrgApplication(app, accept, uid),
      accept ? `${app.displayName}님이 ${t.memberLabel}이 되었습니다.` : '거절했습니다.'
    );
  };

  const changeRole = (m, role) => {
    if (m.role === role) return;
    run(() => setOrgMemberRole(m.uid, scopeType, scopeId, role), `${m.displayName} — ${ORG_ROLE_LABELS[role]}(으)로 변경.`);
  };

  const kick = (m) => {
    if (!window.confirm(`${m.displayName}님을 제명할까요?`)) return;
    run(() => removeMembership(m.uid, scopeType, scopeId), '제명했습니다.');
  };

  const topRoles = ['master', 'leader'];

  return (
    <div className="mt-5 flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle ko={`${t.joinTitle} 대기`} en={`PENDING · ${pending?.length ?? '—'}`} />
        <div className="flex flex-col">
          {(pending || []).map((a, i) => (
            <div key={a.id} className={`flex flex-wrap items-center gap-3 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Avatar name={a.charName || a.displayName} color={a.charClassColor || '#8A70FF'} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold" style={{ color: a.charClassColor || undefined }}>
                  {a.charName || a.displayName}
                  <span className="ml-1.5 text-[12px] font-normal text-sub">
                    {a.charClassName}{a.battletag ? ` · ${a.battletag}` : ''}
                  </span>
                </p>
                {a.message && <p className="mt-0.5 truncate text-[12px] text-sub">"{a.message}"</p>}
              </div>
              <button className="btn-primary !px-3 !py-1 !text-[12px]" disabled={busy} onClick={() => decide(a, true)}>승인</button>
              <button className="btn-ghost !px-3 !py-1 !text-[12px]" disabled={busy} onClick={() => decide(a, false)}>거절</button>
            </div>
          ))}
          {pending && !pending.length && (
            <p className="py-6 text-center text-[13px] text-sub">대기 중인 신청이 없습니다.</p>
          )}
          {!pending && <p className="py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle ko={t.manageTitle} en={`MEMBERS · ${members.length}`} right="최고 책임자 전용" />
        <div className="flex flex-col">
          {members.map((m, i) => (
            <div key={m.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Avatar name={m.displayName} size="h-7 w-7" />
              <span className="min-w-0 max-w-[180px] truncate text-[13px] font-bold text-txt">{m.displayName}</span>
              <span className="text-[12px] text-sub">{ORG_ROLE_LABELS[m.role] || m.role}</span>
              {!topRoles.includes(m.role) && (
                <span className="ml-auto flex items-center gap-2">
                  <Chip
                    active={m.role === 'officer'}
                    onClick={() => changeRole(m, m.role === 'officer' ? 'member' : 'officer')}
                  >
                    {m.role === 'officer' ? '관리자 해제' : '관리자 임명'}
                  </Chip>
                  <button className="text-[12px] text-sub hover:text-dps" disabled={busy} onClick={() => kick(m)}>
                    제명
                  </button>
                </span>
              )}
            </div>
          ))}
          {!members.length && (
            <p className="py-6 text-center text-[13px] text-sub">등록된 소속원이 없습니다.</p>
          )}
        </div>
      </Card>

      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}
