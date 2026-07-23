import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import {
  saveGuildWowBinding,
  fetchKickProposals,
  dismissKickProposal,
  resolveKickProposal,
} from '../lib/db';
import { MonoLabel, Card, Avatar } from './ui';

// BNet 상시 로스터 검증 (사양 P3) — 길드 마스터 전용 패널.
// 실제 와우 길드 연결 + [지금 검증] + 이탈 감지 제명 제안 처리.

function slugifyGuildName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

const inputCls =
  'rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] text-txt outline-none focus:border-violet-deep';

export default function GuildVerifyPanel({ guildId, guild }) {
  const { gamedata } = useApp();
  const { servers } = gamedata;
  const [realmSlug, setRealmSlug] = useState(
    guild?.wowRealmSlug || servers.find((s) => s.isDefault)?.slug || servers[0]?.slug || ''
  );
  const [guildName, setGuildName] = useState('');
  const [savedSlug, setSavedSlug] = useState(guild?.wowGuildSlug || '');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState('');
  const [proposals, setProposals] = useState([]);

  const reload = () => fetchKickProposals(guildId).then(setProposals).catch(() => setProposals([]));
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const save = async () => {
    const slug = guildName.trim() ? slugifyGuildName(guildName) : savedSlug;
    if (!realmSlug || !slug) {
      setMsg('서버와 와우 길드명을 입력해주세요.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await saveGuildWowBinding(guildId, { wowRealmSlug: realmSlug, wowGuildSlug: slug });
      setSavedSlug(slug);
      setGuildName('');
      setMsg('와우 길드 연결을 저장했어요.');
    } catch (e) {
      setMsg(e.message || '저장에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const verifyNow = async () => {
    setVerifying(true);
    setMsg('');
    try {
      const call = httpsCallable(functions, 'verifyGuildNow');
      const res = await call({ guildId });
      const r = res.data || {};
      setMsg(
        r.skipped
          ? `검증을 건너뛰었어요 (${r.skipped}).`
          : `검증 완료 — 확인 ${r.checked}명 · 새 제안 ${r.proposed} · 해제 ${r.cleared}`
      );
      reload();
    } catch (e) {
      setMsg(e.message || '검증에 실패했어요.');
    } finally {
      setVerifying(false);
    }
  };

  const kick = async (p) => {
    if (!window.confirm(`${p.displayName} 님을 길드에서 제명할까요? (멤버십이 삭제됩니다)`)) return;
    try {
      await resolveKickProposal(p);
      reload();
    } catch (e) {
      window.alert(e.message || '제명에 실패했어요.');
    }
  };
  const keep = async (p) => {
    try {
      await dismissKickProposal(p.id);
      reload();
    } catch (e) {
      window.alert(e.message || '처리에 실패했어요.');
    }
  };

  return (
    <Card className="mt-4 p-5">
      <MonoLabel violet>ROSTER VERIFICATION · BNET</MonoLabel>
      <p className="text-[12px] text-sub">
        실제 와우 길드를 연결하면 소속 이탈(캐릭터 전원 탈퇴)을 감지해 제명 제안을 띄웁니다. 매일 새벽 5시 자동 검증.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-line bg-surface2 p-3">
        <select className={inputCls} value={realmSlug} onChange={(e) => setRealmSlug(e.target.value)}>
          {servers.map((s) => (
            <option key={s.slug} value={s.slug}>{s.ko}</option>
          ))}
        </select>
        <input
          className={`${inputCls} w-44`}
          placeholder={savedSlug ? `현재: ${savedSlug}` : '와우 길드명 (예: 별똥숲)'}
          value={guildName}
          onChange={(e) => setGuildName(e.target.value)}
        />
        <button className="btn-ghost" disabled={busy} onClick={save}>
          {busy ? '저장 중…' : '연결 저장'}
        </button>
        <button className="btn-primary" disabled={verifying || !savedSlug} onClick={verifyNow}>
          {verifying ? '검증 중…' : '지금 검증'}
        </button>
      </div>
      {savedSlug && (
        <p className="mt-1.5 text-[11px] text-mute">연결됨: {realmSlug} / {savedSlug}</p>
      )}
      {msg && <p className="mt-2 text-[12px] font-semibold text-violet-hi">{msg}</p>}

      <div className="mt-4">
        <MonoLabel>제명 제안 · {proposals.length}</MonoLabel>
        <div className="mt-2 flex flex-col gap-2">
          {proposals.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded border border-line bg-surface2 px-3 py-2">
              <Avatar name={p.displayName} size="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-txt">
                  {p.displayName}
                  {p.battletag && <span className="ml-1.5 font-normal text-mute">{p.battletag}</span>}
                </p>
                <p className="text-[11px] text-sub">길드 로스터에서 캐릭터가 확인되지 않음</p>
              </div>
              <button className="btn-ghost !px-3 !py-1 !text-[12px]" onClick={() => keep(p)}>유지</button>
              <button
                className="rounded border border-dps/50 px-3 py-1 text-[12px] font-semibold text-dps transition hover:bg-dps/10"
                onClick={() => kick(p)}
              >
                제명
              </button>
            </div>
          ))}
          {!proposals.length && <p className="text-[12px] text-mute">이탈 감지된 멤버가 없습니다.</p>}
        </div>
      </div>
    </Card>
  );
}
