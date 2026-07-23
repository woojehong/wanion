import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchRecentUsers, fetchScopeMembers, upsertMembership, removeMembership } from '../../lib/db';
import { SectionTitle, Card, Avatar } from '../../components/ui';

const inputCls =
  'w-full max-w-xs rounded border border-line bg-surface2 px-3 py-2 text-[13px] text-txt outline-none focus:border-violet-deep';

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}` : '—';
}

export default function UsersTab() {
  const { isOwner } = useApp();
  const [users, setUsers] = useState(null);
  const [platformRoles, setPlatformRoles] = useState({}); // uid → role
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = async () => {
    const [list, staff] = await Promise.all([
      fetchRecentUsers(),
      fetchScopeMembers('platform', 'platform'),
    ]);
    setUsers(list);
    const roles = {};
    staff.forEach((m) => { roles[m.uid] = m.role; });
    setPlatformRoles(roles);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users || [];
    return (users || []).filter(
      (u) => (u.displayName || '').toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleStaff = async (u) => {
    const cur = platformRoles[u.id];
    if (cur === 'owner') return;
    setBusy(true);
    setMsg(null);
    try {
      if (cur === 'staff') {
        await removeMembership(u.id, 'platform', 'platform');
        setMsg({ ok: true, text: `${u.displayName} — 운영진 해임됨.` });
      } else {
        await upsertMembership(u.id, 'platform', 'platform', 'staff');
        setMsg({ ok: true, text: `${u.displayName} — 운영진(staff)으로 임명됨.` });
      }
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const copyUid = (uid) => {
    navigator.clipboard?.writeText(uid).then(
      () => setMsg({ ok: true, text: 'UID가 복사되었습니다 — 조직·멤버십 탭에서 사용하세요.' }),
      () => setMsg({ ok: false, text: '복사 실패 — UID를 직접 선택해 복사해주세요.' })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle ko="유저 관리" en={`USERS · 최근 ${users?.length ?? '—'}명`} right="포인트·제재는 P2 이후" />
        <input
          className={inputCls}
          placeholder="이름 · UID 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-3 flex flex-col">
          {filtered.map((u, i) => {
            const role = platformRoles[u.id];
            return (
              <div key={u.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                <Avatar name={u.displayName || '?'} size="h-7 w-7" />
                <span className="min-w-0 max-w-[160px] truncate text-[13px] font-bold text-txt">{u.displayName || '모험가'}</span>
                {role && (
                  <span className="rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-violet-hi">
                    {role === 'owner' ? 'OWNER' : 'STAFF'}
                  </span>
                )}
                {u.bnetLinked && (
                  <span className="font-mono text-[10px] tracking-[0.06em] text-heal">BNET</span>
                )}
                <button
                  className="num max-w-[120px] truncate font-mono text-[11px] text-mute hover:text-txt"
                  title="클릭하여 UID 복사"
                  onClick={() => copyUid(u.id)}
                >
                  {u.id}
                </button>
                <span className="num ml-auto font-mono text-[11px] text-sub">{fmtDate(u.createdAt)}</span>
                {isOwner && role !== 'owner' && (
                  <button
                    className="btn-ghost !px-2.5 !py-1 !text-[12px]"
                    disabled={busy}
                    onClick={() => toggleStaff(u)}
                  >
                    {role === 'staff' ? '운영진 해임' : '운영진 임명'}
                  </button>
                )}
              </div>
            );
          })}
          {users && !filtered.length && (
            <p className="py-6 text-center text-[13px] text-sub">조건에 맞는 유저가 없습니다.</p>
          )}
          {!users && <p className="py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
        </div>
      </Card>
      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}
