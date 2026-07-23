import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  fetchGuilds,
  fetchTeams,
  fetchAlliances,
  fetchScopeMembers,
  upsertMembership,
  removeMembership,
} from '../../lib/db';
import { MonoLabel, SectionTitle, Card, Chip, Avatar } from '../../components/ui';

const inputCls =
  'rounded border border-line bg-surface2 px-3 py-2 text-[13px] text-txt outline-none focus:border-violet-deep';

const SCOPE_TYPES = [
  { id: 'guild', label: '길드' },
  { id: 'team', label: '공대' },
  { id: 'alliance', label: '연합' },
];
const ROLE_OPTIONS = {
  guild: [
    { id: 'master', label: '길드 마스터' },
    { id: 'officer', label: '관리자' },
    { id: 'member', label: '길드원' },
  ],
  team: [
    { id: 'leader', label: '공대장' },
    { id: 'officer', label: '관리자' },
    { id: 'member', label: '공대원' },
  ],
  alliance: [
    { id: 'officer', label: '연합 운영진' },
    { id: 'member', label: '연합원' },
  ],
};
const ROLE_LABELS = Object.fromEntries(
  Object.values(ROLE_OPTIONS).flat().map((r) => [r.id, r.label])
);

export default function OrgsTab() {
  const { isOwner } = useApp();
  const [orgs, setOrgs] = useState({ guild: [], team: [], alliance: [] });
  const [scopeType, setScopeType] = useState('guild');
  const [scopeId, setScopeId] = useState('');
  const [members, setMembers] = useState(null);
  const [form, setForm] = useState({ uid: '', role: 'member' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Promise.all([fetchGuilds(), fetchTeams(), fetchAlliances()]).then(([g, t, a]) => {
      setOrgs({
        guild: g.filter((x) => !x.isNone && !x.isUnion),
        team: t,
        alliance: a,
      });
    });
  }, []);

  const currentOrgs = orgs[scopeType] || [];

  // 스코프 유형이 바뀌면 첫 조직 자동 선택
  useEffect(() => {
    setScopeId((prev) => (currentOrgs.some((o) => o.id === prev) ? prev : currentOrgs[0]?.id || ''));
  }, [scopeType, orgs]); // eslint-disable-line

  const reloadMembers = () => {
    if (!scopeId) return setMembers([]);
    setMembers(null);
    fetchScopeMembers(scopeType, scopeId).then(setMembers).catch(() => setMembers([]));
  };
  useEffect(() => { reloadMembers(); }, [scopeType, scopeId]); // eslint-disable-line

  const roleOptions = ROLE_OPTIONS[scopeType];
  const orgName = useMemo(
    () => currentOrgs.find((o) => o.id === scopeId)?.name || scopeId,
    [currentOrgs, scopeId]
  );

  const appoint = async () => {
    const uid = form.uid.trim();
    if (!uid) return setMsg({ ok: false, text: 'UID를 입력해주세요 — 유저 탭에서 클릭해 복사할 수 있습니다.' });
    if (!scopeId) return setMsg({ ok: false, text: '조직을 선택해주세요.' });
    setBusy(true);
    setMsg(null);
    try {
      await upsertMembership(uid, scopeType, scopeId, form.role);
      setForm({ uid: '', role: form.role });
      reloadMembers();
      setMsg({ ok: true, text: `${orgName} — ${ROLE_LABELS[form.role]}(으)로 등록되었습니다.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다 (멤버십 변경은 소유자 전용).' });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (m) => {
    if (!window.confirm(`${m.displayName} — ${orgName}에서 해임할까요?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await removeMembership(m.uid, scopeType, scopeId);
      reloadMembers();
      setMsg({ ok: true, text: '해임되었습니다.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle
          ko="조직 · 멤버십"
          en="ORGS & MEMBERSHIPS"
          right={isOwner ? '한길련·TeamSAD 입주(P1-7)의 수동 도구' : '임명·해임은 소유자 전용'}
        />

        {/* 스코프 선택 */}
        <div className="flex flex-wrap items-center gap-2">
          {SCOPE_TYPES.map((s) => (
            <Chip
              key={s.id}
              active={scopeType === s.id}
              onClick={() => {
                setScopeType(s.id);
                setForm((f) => ({ ...f, role: 'member' })); // 스코프별 역할 목록이 다르므로 공통값으로 리셋
              }}
            >
              {s.label}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          {currentOrgs.map((o) => (
            <Chip key={o.id} active={scopeId === o.id} onClick={() => setScopeId(o.id)}>{o.name}</Chip>
          ))}
          {!currentOrgs.length && <span className="text-[12px] text-mute">조직 없음 — 시드를 먼저 실행하세요.</span>}
        </div>

        {/* 소속원 목록 */}
        <div className="mt-4 flex flex-col">
          {(members || []).map((m, i) => (
            <div key={m.id} className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Avatar name={m.displayName} size="h-7 w-7" />
              <span className="min-w-0 max-w-[180px] truncate text-[13px] font-bold text-txt">{m.displayName}</span>
              <span className="text-[12px] text-sub">{ROLE_LABELS[m.role] || m.role}</span>
              <span className="num ml-auto max-w-[120px] truncate font-mono text-[11px] text-mute">{m.uid}</span>
              {isOwner && (
                <button className="text-[12px] text-sub hover:text-dps" disabled={busy} onClick={() => dismiss(m)}>
                  해임
                </button>
              )}
            </div>
          ))}
          {members && !members.length && (
            <p className="py-6 text-center text-[13px] text-sub">{orgName ? `${orgName}에 등록된 소속원이 없습니다.` : '조직을 선택하세요.'}</p>
          )}
          {!members && <p className="py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
        </div>

        {/* 임명 폼 — 소유자 전용 */}
        {isOwner && (
          <div className="mt-4 border-t border-line pt-4">
            <MonoLabel violet>APPOINT</MonoLabel>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} w-64`}
                placeholder="유저 UID (유저 탭에서 복사)"
                value={form.uid}
                onChange={(e) => setForm({ ...form, uid: e.target.value })}
              />
              <select
                className={inputCls}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <button className="btn-primary !px-3 !py-2 !text-[13px]" disabled={busy} onClick={appoint}>
                {orgName || '조직'}에 등록
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              P2부터는 가입 신청·승인 플로우가 이 수동 등록을 대체합니다. 대량 입주는 P1-7 마이그레이션 스크립트로 진행합니다.
            </p>
          </div>
        )}
      </Card>
      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}
