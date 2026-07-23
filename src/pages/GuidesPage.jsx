import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  fetchActiveZones,
  fetchBosses,
  fetchBestGuides,
  fetchGuides,
  createGuide,
  voteGuide,
  fetchMyGuideVote,
  deleteGuide,
} from '../lib/db';
import { MonoLabel, SectionTitle, Card, Chip } from '../components/ui';

const DIFFS = ['일반', '영웅', '신화'];
const inputCls =
  'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
}

// ── 공략 작성 모달 ───────────────────────────────────────────────────
function GuideForm({ zone, boss, onClose }) {
  const { uid, profile } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('신화');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!title.trim()) return setError('제목을 입력해주세요.');
    if (!body.trim()) return setError('내용을 입력해주세요.');
    setBusy(true);
    try {
      await createGuide({
        zoneId: zone.id,
        bossId: boss.id,
        difficulty,
        title,
        body: body.trim(),
        links: link.trim() ? [link.trim()] : [],
        // P2: 대표 캐릭터 스냅샷으로 대체 (BNet 연동 후 강제)
        author: { uid, charName: profile?.displayName || '모험가', classId: null, classColor: '#B9A8FF' },
        scopeKeys: ['global'], // P1: 전체 공개만. 길드/공대 스코프는 멤버십 도입 시 체크박스 활성
      });
      onClose(true);
    } catch (e) {
      setError(e.message || '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-10 w-full max-w-lg rounded border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <MonoLabel violet>NEW GUIDE</MonoLabel>
        <h2 className="text-[17px] font-extrabold">{zone.name} — {boss.name} 공략 작성</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-1.5">
            {DIFFS.map((d) => (
              <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{d}</Chip>
            ))}
          </div>
          <input className={inputCls} placeholder="제목" value={title} maxLength={60}
            onChange={(e) => setTitle(e.target.value)} />
          <textarea className={`${inputCls} h-48 resize-none`} placeholder="공략 내용 — 페이즈별 오더, 주의 기술, 생존기 로테이션 등"
            value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
          <input className={inputCls} placeholder="영상/WCL 링크 (선택)" value={link}
            onChange={(e) => setLink(e.target.value)} />
          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? '등록 중…' : '등록'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 공략 카드 ────────────────────────────────────────────────────────
function GuideCard({ g, best, myVote, onVote, canDelete, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={`p-4 ${best ? 'border-violet-deep/60' : ''}`}>
      <div className="flex items-start gap-3">
        {best && <span className="rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.06em] text-violet-hi">BEST</span>}
        <div className="min-w-0 flex-1">
          <button className="block w-full text-left" onClick={() => setOpen(!open)}>
            <div className="flex flex-wrap items-center gap-2">
              {g.difficulty && <span className="rounded border border-line px-1 py-0.5 text-[10px] font-bold text-sub">{g.difficulty}</span>}
              <h3 className="truncate text-[15px] font-bold text-txt hover:text-violet-hi">{g.title}</h3>
            </div>
            <p className="mt-1 text-[12px] text-sub">
              <span style={{ color: g.authorClassColor || undefined }} className="font-semibold">{g.authorChar}</span>
              <span className="num ml-2 font-mono text-mute">{fmtDate(g.createdAt)}</span>
            </p>
          </button>
          {open && (
            <div className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-[13px] leading-relaxed text-txt">
              {g.body}
              {(g.links || []).map((l) => (
                <a key={l} href={l} target="_blank" rel="noreferrer" className="mt-2 block truncate text-[12px] text-violet-hi hover:underline">{l}</a>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`num font-mono text-[15px] font-extrabold ${g.score > 0 ? 'text-violet-hi' : g.score < 0 ? 'text-dps' : 'text-sub'}`}>
            {g.score > 0 ? '+' : ''}{g.score}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onVote(g, myVote === 1 ? 0 : 1)}
              className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${myVote === 1 ? 'border-heal/60 bg-heal/10 text-heal' : 'border-line text-sub hover:border-heal/50'}`}
              title="도움이 되었어요 (익명)"
            >
              도움 {g.up}
            </button>
            <button
              onClick={() => onVote(g, myVote === -1 ? 0 : -1)}
              className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${myVote === -1 ? 'border-dps/60 bg-dps/10 text-dps' : 'border-line text-sub hover:border-dps/50'}`}
              title="도움이 안 돼요 (익명)"
            >
              별로 {g.down}
            </button>
          </div>
          {canDelete && (
            <button className="text-[10px] text-mute hover:text-dps" onClick={() => onDelete(g)}>삭제</button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────
export default function GuidesPage() {
  const { uid, user, isPlatformAdmin, signInGoogle } = useApp();
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState(null);
  const [bosses, setBosses] = useState([]);
  const [boss, setBoss] = useState(null);
  const [best, setBest] = useState([]);
  const [list, setList] = useState([]);
  const [sort, setSort] = useState('recent'); // recent | helpful
  const [myVotes, setMyVotes] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveZones().then((zs) => {
      setZones(zs);
      setZone(zs[0] || null);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!zone) return;
    fetchBosses(zone.id).then((bs) => {
      setBosses(bs);
      setBoss(bs[0] || null);
    });
  }, [zone]);

  const reload = async () => {
    if (!zone || !boss) return;
    setLoading(true);
    const [b, l] = await Promise.all([
      fetchBestGuides(zone.id, boss.id, 'global'),
      fetchGuides(zone.id, boss.id, 'global', sort),
    ]);
    setBest(b);
    setList(l);
    setLoading(false);
    if (uid) {
      const all = [...b, ...l];
      const votes = {};
      await Promise.all(all.map(async (g) => { votes[g.id] = await fetchMyGuideVote(g.id, uid); }));
      setMyVotes(votes);
    }
  };

  useEffect(() => { reload(); }, [zone, boss, sort, uid]); // eslint-disable-line

  const vote = async (g, value) => {
    if (!user) return signInGoogle();
    try {
      await voteGuide(g.id, uid, value);
      setMyVotes((p) => ({ ...p, [g.id]: value }));
      reload();
    } catch (e) {
      window.alert(e.message);
    }
  };

  const del = async (g) => {
    if (!window.confirm('이 공략을 삭제하시겠습니까?')) return;
    await deleteGuide(g.id);
    reload();
  };

  const bestIds = new Set(best.map((g) => g.id));
  const rest = list.filter((g) => !bestIds.has(g.id));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <MonoLabel violet>STRATEGY BOARD</MonoLabel>
          <h1 className="mt-1 text-[26px] font-extrabold">공략</h1>
          <p className="mt-1 text-[13px] text-sub">네임드별 공략을 공유하고, 익명 평가로 베스트를 가립니다.</p>
        </div>
        <button className="btn-primary" onClick={() => (user ? setFormOpen(true) : signInGoogle())}>
          공략 작성
        </button>
      </div>

      {/* 던전 / 네임드 탭 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {zones.map((z) => (
          <Chip key={z.id} active={zone?.id === z.id} onClick={() => setZone(z)}>{z.name}</Chip>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-line pb-4">
        {bosses.map((b, i) => (
          <Chip key={b.id} active={boss?.id === b.id} onClick={() => setBoss(b)}>
            <span className="num font-mono text-[10px] text-mute">{i + 1}넴</span> {b.name}
          </Chip>
        ))}
      </div>

      {boss && (
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle ko={boss.name} en={`${zone?.name || ''} · GUIDES`} />
          <div className="flex gap-1.5">
            <Chip active={sort === 'recent'} onClick={() => setSort('recent')}>등록순</Chip>
            <Chip active={sort === 'helpful'} onClick={() => setSort('helpful')}>도움순</Chip>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {best.map((g) => (
          <GuideCard key={g.id} g={g} best myVote={myVotes[g.id] || 0} onVote={vote}
            canDelete={isPlatformAdmin || g.authorId === uid} onDelete={del} />
        ))}
        {rest.map((g) => (
          <GuideCard key={g.id} g={g} myVote={myVotes[g.id] || 0} onVote={vote}
            canDelete={isPlatformAdmin || g.authorId === uid} onDelete={del} />
        ))}
        {!loading && !best.length && !rest.length && (
          <Card className="p-10 text-center text-[13px] text-sub">
            아직 공략이 없습니다 — 첫 공략의 주인공이 되어보세요.
          </Card>
        )}
        {loading && <p className="py-8 text-center text-[13px] text-mute">불러오는 중…</p>}
      </div>

      {formOpen && zone && boss && (
        <GuideForm zone={zone} boss={boss} onClose={(saved) => { setFormOpen(false); if (saved) reload(); }} />
      )}
    </main>
  );
}
