import { useEffect, useState } from 'react';
import {
  seedInitialData,
  fetchAllZones,
  fetchBosses,
  saveZone,
  saveBoss,
  deleteBoss,
  reorderBosses,
} from '../../lib/db';
import { MonoLabel, SectionTitle, Card, Chip } from '../../components/ui';

const inputCls =
  'rounded border border-line bg-surface2 px-3 py-2 text-[13px] text-txt outline-none focus:border-violet-deep';

// ── 네임드 에디터 (던전별) ───────────────────────────────────────────
function BossEditor({ zone }) {
  const [bosses, setBosses] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => fetchBosses(zone.id).then(setBosses);
  useEffect(() => { reload(); }, [zone.id]); // eslint-disable-line

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      window.alert(e.message || '실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await saveBoss(zone.id, null, { name, order: (bosses?.length || 0) + 1 });
      setNewName('');
    });
  };

  const rename = (b, name) => {
    if (!name.trim() || name === b.name) return;
    run(() => saveBoss(zone.id, b.id, { name: name.trim() }));
  };

  const move = (idx, dir) => {
    const next = bosses.slice();
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    run(() => reorderBosses(zone.id, next.map((b) => b.id)));
  };

  const del = (b) => {
    if (!window.confirm(`「${b.name}」 네임드를 삭제할까요? 연결된 공략글의 분류가 깨질 수 있습니다.`)) return;
    run(async () => {
      await deleteBoss(zone.id, b.id);
      await reorderBosses(zone.id, bosses.filter((x) => x.id !== b.id).map((x) => x.id));
    });
  };

  if (!bosses) return <p className="py-3 text-[12px] text-mute">네임드 불러오는 중…</p>;

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
      {bosses.map((b, i) => (
        <div key={b.id} className="flex items-center gap-2">
          <span className="num w-8 shrink-0 font-mono text-[11px] text-mute">{i + 1}넴</span>
          <input
            className={`${inputCls} min-w-0 flex-1 !py-1`}
            defaultValue={b.name}
            maxLength={30}
            onBlur={(e) => rename(b, e.target.value)}
            disabled={busy}
          />
          <button className="text-[12px] text-sub hover:text-txt disabled:opacity-30" disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
          <button className="text-[12px] text-sub hover:text-txt disabled:opacity-30" disabled={busy || i === bosses.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button className="text-[11px] text-mute hover:text-dps" disabled={busy} onClick={() => del(b)}>삭제</button>
        </div>
      ))}
      <div className="mt-1 flex gap-2">
        <input
          className={`${inputCls} min-w-0 flex-1 !py-1`}
          placeholder="새 네임드 이름"
          value={newName}
          maxLength={30}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-ghost !px-3 !py-1 !text-[12px]" disabled={busy} onClick={add}>추가</button>
      </div>
    </div>
  );
}

// ── 게임데이터 탭 ────────────────────────────────────────────────────
export default function GamedataTab() {
  const [zones, setZones] = useState(null);
  const [openZone, setOpenZone] = useState(null);
  const [newZone, setNewZone] = useState({ id: '', name: '', season: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = () => fetchAllZones().then(setZones);
  useEffect(() => { reload(); }, []);

  const run = async (fn, okText) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message || '실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const addZone = () => {
    const id = newZone.id.trim().toLowerCase();
    const name = newZone.name.trim();
    if (!/^[a-z0-9-]{2,30}$/.test(id)) return setMsg({ ok: false, text: '던전 ID는 영소문자·숫자·하이픈 2~30자입니다.' });
    if (!name) return setMsg({ ok: false, text: '던전 이름을 입력해주세요.' });
    run(async () => {
      await saveZone(id, { name, season: newZone.season.trim() || null, active: false });
      setNewZone({ id: '', name: '', season: '' });
    }, '던전이 추가되었습니다 — 네임드를 등록한 뒤 활성화하세요.');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SectionTitle ko="초기 데이터 시드" en="SEED — GAMEDATA · GUILDS · ZONES" />
        <p className="text-[13px] leading-relaxed text-sub">
          클래스·시너지·서버 게임데이터, 창립 길드·연합·정공, 시즌 던전(공허첨탑 8넴)을 설치합니다.
          merge 방식이라 여러 번 실행해도 안전합니다.
        </p>
        <button className="btn-primary mt-3" disabled={busy} onClick={() => run(seedInitialData, '시드 완료.')}>
          시드 실행
        </button>
      </Card>

      <Card className="p-5">
        <SectionTitle ko="던전·네임드 관리" en="ZONES & BOSSES" right="공략게시판·킬 타임라인의 단일 소스" />
        <div className="flex flex-col gap-2">
          {(zones || []).map((z) => (
            <div key={z.id} className="rounded border border-line bg-surface2/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-bold text-txt">{z.name}</span>
                <span className="font-mono text-[10px] tracking-[0.06em] text-mute">{z.id}</span>
                {z.season && <span className="chip !py-0">{z.season}</span>}
                <span className="ml-auto flex items-center gap-2">
                  <Chip
                    active={!!z.active}
                    onClick={() => run(() => saveZone(z.id, { active: !z.active }), z.active ? '비활성화됨.' : '활성화됨 — 공략게시판에 노출됩니다.')}
                  >
                    {z.active ? '활성' : '비활성'}
                  </Chip>
                  <button className="text-[12px] text-sub hover:text-txt" onClick={() => setOpenZone(openZone === z.id ? null : z.id)}>
                    {openZone === z.id ? '네임드 닫기' : '네임드 편집'}
                  </button>
                </span>
              </div>
              {openZone === z.id && <BossEditor zone={z} />}
            </div>
          ))}
          {zones && !zones.length && (
            <p className="py-4 text-center text-[13px] text-sub">등록된 던전이 없습니다 — 시드를 먼저 실행하세요.</p>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <MonoLabel violet>NEW ZONE</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className={`${inputCls} w-40`} placeholder="ID (영문 슬러그)" value={newZone.id}
              onChange={(e) => setNewZone({ ...newZone, id: e.target.value })} />
            <input className={`${inputCls} w-44`} placeholder="던전 이름" value={newZone.name} maxLength={30}
              onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} />
            <input className={`${inputCls} w-36`} placeholder="시즌 (선택)" value={newZone.season} maxLength={20}
              onChange={(e) => setNewZone({ ...newZone, season: e.target.value })} />
            <button className="btn-ghost" disabled={busy} onClick={addZone}>던전 추가</button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mute">
            시즌 전환 시: 새 던전 추가 → 네임드 등록 → 활성화, 이전 던전은 비활성화(공략은 보존됩니다).
          </p>
        </div>
      </Card>

      {msg && <p className={`text-[13px] font-semibold ${msg.ok ? 'text-heal' : 'text-dps'}`}>{msg.text}</p>}
    </div>
  );
}
