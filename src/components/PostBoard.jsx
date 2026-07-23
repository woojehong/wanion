import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  fetchBoardMeta,
  saveBoardMeta,
  fetchMyScopeRole,
  fetchPosts,
  createPost,
  updatePost,
  setPostPinned,
  deletePost,
  subscribeComments,
  addComment,
  deleteComment,
} from '../lib/db';
import { MonoLabel, Card, Chip } from './ui';

const inputCls =
  'w-full rounded border border-line bg-surface2 px-3 py-2 text-[14px] text-txt outline-none focus:border-violet-deep';

const SCOPE_ADMIN_ROLES = ['master', 'officer', 'leader'];

function fmtDateTime(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 글 작성/수정 모달 ────────────────────────────────────────────────
function PostForm({ scopeType, scopeId, categories, adminOnly, isAdmin, editing, onClose }) {
  const { uid, profile } = useApp();
  const writable = useMemo(
    () => categories.filter((c) => isAdmin || !adminOnly.includes(c.id)),
    [categories, adminOnly, isAdmin]
  );
  const [category, setCategory] = useState(editing?.category || writable[0]?.id || 'free');
  const [title, setTitle] = useState(editing?.title || '');
  const [body, setBody] = useState(editing?.body || '');
  const [pinned, setPinned] = useState(!!editing?.pinned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!title.trim()) return setError('제목을 입력해주세요.');
    if (!body.trim()) return setError('내용을 입력해주세요.');
    setBusy(true);
    try {
      if (editing) {
        await updatePost(editing.id, { title, body: body.trim() });
      } else {
        await createPost({
          scopeType,
          scopeId,
          category,
          title,
          body: body.trim(),
          author: { uid, name: profile?.displayName || '모험가', classColor: null },
          pinned: isAdmin && pinned,
        });
      }
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
        <MonoLabel violet>{editing ? 'EDIT POST' : 'NEW POST'}</MonoLabel>
        <h2 className="text-[17px] font-extrabold">{editing ? '글 수정' : '글 작성'}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {!editing && (
            <div className="flex flex-wrap gap-1.5">
              {writable.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</Chip>
              ))}
            </div>
          )}
          <input className={inputCls} placeholder="제목" value={title} maxLength={80}
            onChange={(e) => setTitle(e.target.value)} />
          <textarea className={`${inputCls} h-44 resize-none`} placeholder="내용"
            value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
          {!editing && isAdmin && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-sub">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              목록 상단에 고정
            </label>
          )}
          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? '저장 중…' : editing ? '수정' : '등록'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 카테고리 관리 모달 (스코프 관리자 전용) ─────────────────────────
function CategoryManager({ scopeType, scopeId, categories, adminOnly, onClose }) {
  const [items, setItems] = useState(categories.map((c) => ({ ...c })));
  const [adminSet, setAdminSet] = useState(new Set(adminOnly));
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = () => {
    const name = label.trim();
    if (!name) return;
    if (items.some((c) => c.label === name)) return setError('이미 있는 카테고리입니다.');
    const id = `c${Date.now().toString(36)}`;
    setItems([...items, { id, label: name }]);
    setLabel('');
    setError('');
  };

  const remove = (id) => {
    setItems(items.filter((c) => c.id !== id));
    setAdminSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleAdmin = (id) => {
    setAdminSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!items.length) return setError('카테고리는 1개 이상 필요합니다.');
    setBusy(true);
    setError('');
    try {
      await saveBoardMeta(scopeType, scopeId, {
        categories: items,
        adminOnlyCategories: [...adminSet],
      });
      onClose(true);
    } catch (e) {
      setError(e.message || '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-10 w-full max-w-md rounded border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <MonoLabel violet>BOARD SETTINGS</MonoLabel>
        <h2 className="text-[17px] font-extrabold">카테고리 관리</h2>
        <p className="mt-1 text-[12px] text-sub">「관리자 전용」은 해당 카테고리 글쓰기를 관리자로 제한합니다.</p>
        <div className="mt-4 flex flex-col gap-2">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded border border-line bg-surface2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-txt">{c.label}</span>
              <label className="flex cursor-pointer items-center gap-1 text-[11px] text-sub">
                <input type="checkbox" checked={adminSet.has(c.id)} onChange={() => toggleAdmin(c.id)} />
                관리자 전용
              </label>
              <button className="text-[11px] text-mute hover:text-dps" onClick={() => remove(c.id)}>삭제</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className={inputCls} placeholder="새 카테고리 이름" value={label} maxLength={12}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="btn-ghost shrink-0" onClick={add}>추가</button>
          </div>
          {error && <p className="text-[13px] font-semibold text-dps">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => onClose(false)}>취소</button>
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 댓글 영역 (글을 펼친 동안에만 구독) ─────────────────────────────
function Comments({ post, isAdmin }) {
  const { uid, user, profile, signInGoogle } = useApp();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeComments(post.id, setList), [post.id]);

  const submit = async () => {
    if (!user) return signInGoogle();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addComment(post.id, {
        authorId: uid,
        authorName: profile?.displayName || '모험가',
        authorClassColor: null,
        body: text,
      });
      setText('');
    } catch (e) {
      window.alert(e.message || '댓글 등록 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <MonoLabel>COMMENTS · {post.commentCount || 0}</MonoLabel>
      <div className="mt-2 flex flex-col gap-2">
        {(list || []).map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-[13px]">
            <span className="shrink-0 font-semibold" style={{ color: c.authorClassColor || undefined }}>
              {c.authorName}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-txt">{c.body}</span>
            <span className="num shrink-0 font-mono text-[11px] text-mute">{fmtDateTime(c.createdAt)}</span>
            {(isAdmin || c.authorId === uid) && (
              <button
                className="shrink-0 text-[11px] text-mute hover:text-dps"
                onClick={() => deleteComment(post.id, c.id).catch((e) => window.alert(e.message))}
              >
                삭제
              </button>
            )}
          </div>
        ))}
        {list && !list.length && <p className="text-[12px] text-mute">첫 댓글을 남겨보세요.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className={inputCls}
          placeholder={user ? '댓글 입력' : '로그인 후 댓글을 남길 수 있습니다'}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
        />
        <button className="btn-ghost shrink-0" disabled={busy} onClick={submit}>등록</button>
      </div>
    </div>
  );
}

// ── 게시판 본체 — scopeType: 'global' | 'guild' | 'team' ─────────────
export default function PostBoard({ scopeType, scopeId = null }) {
  const { uid, user, isPlatformAdmin, signInGoogle } = useApp();
  const [meta, setMeta] = useState({ categories: [], adminOnlyCategories: [] });
  const [scopeRole, setScopeRole] = useState(null);
  const [cat, setCat] = useState('all');
  const [posts, setPosts] = useState(null);
  const [gated, setGated] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [catManageOpen, setCatManageOpen] = useState(false);

  const isAdmin = isPlatformAdmin || SCOPE_ADMIN_ROLES.includes(scopeRole);
  const catLabel = useMemo(() => {
    const map = {};
    meta.categories.forEach((c) => { map[c.id] = c.label; });
    return map;
  }, [meta.categories]);

  const reloadMeta = useCallback(() => {
    fetchBoardMeta(scopeType, scopeId).then(setMeta);
  }, [scopeType, scopeId]);

  useEffect(() => { reloadMeta(); }, [reloadMeta]);

  useEffect(() => {
    fetchMyScopeRole(uid, scopeType, scopeId).then(setScopeRole);
  }, [uid, scopeType, scopeId]);

  const reload = useCallback(async () => {
    setGated(false);
    try {
      const list = await fetchPosts({
        scopeType,
        scopeId,
        category: cat === 'all' ? null : cat,
      });
      setPosts(list);
    } catch {
      // 규칙상 열람 불가 (비로그인·비소속) — 게이트 안내로 전환
      setPosts([]);
      setGated(true);
    }
  }, [scopeType, scopeId, cat]);

  useEffect(() => { reload(); }, [reload, uid]);

  const del = async (p) => {
    if (!window.confirm('이 글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.')) return;
    await deletePost(p.id);
    reload();
  };

  const togglePin = async (p) => {
    await setPostPinned(p.id, !p.pinned);
    reload();
  };

  return (
    <div>
      {/* 툴바: 카테고리 필터 + 액션 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>전체</Chip>
        {meta.categories.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>
        ))}
        <span className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button className="btn-ghost !px-3 !py-1.5 !text-[13px]" onClick={() => setCatManageOpen(true)}>
              카테고리 관리
            </button>
          )}
          <button
            className="btn-primary !px-3 !py-1.5 !text-[13px]"
            onClick={() => (user ? (setEditing(null), setFormOpen(true)) : signInGoogle())}
          >
            글 작성
          </button>
        </span>
      </div>

      {/* 목록 */}
      <Card>
        {(posts || []).map((p, i) => {
          const open = openId === p.id;
          const mine = p.authorId === uid;
          return (
            <div key={p.id} className={i > 0 ? 'border-t border-line' : ''}>
              <button
                className={`flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-surface2 ${open ? 'bg-surface2' : ''}`}
                onClick={() => setOpenId(open ? null : p.id)}
              >
                {p.pinned && (
                  <span className="shrink-0 rounded border border-violet-deep px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.06em] text-violet-hi">
                    고정
                  </span>
                )}
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] font-bold text-sub">
                  {catLabel[p.category] || p.category}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-txt">
                  {p.title}
                  {p.commentCount > 0 && (
                    <span className="num ml-1.5 font-mono text-[12px] font-bold text-violet-hi">[{p.commentCount}]</span>
                  )}
                </span>
                <span className="hidden shrink-0 text-[12px] font-semibold sm:inline" style={{ color: p.authorClassColor || undefined }}>
                  {p.authorName}
                </span>
                <span className="num shrink-0 font-mono text-[11px] text-mute">{fmtDateTime(p.createdAt)}</span>
              </button>
              {open && (
                <div className="border-t border-line/50 bg-surface2/50 px-4 py-4">
                  <div className="mb-1 flex items-center gap-2 text-[12px] text-sub sm:hidden">
                    <span className="font-semibold" style={{ color: p.authorClassColor || undefined }}>{p.authorName}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-txt">{p.body}</div>
                  {(mine || isAdmin) && (
                    <div className="mt-3 flex gap-3 text-[12px]">
                      {mine && (
                        <button className="text-sub hover:text-txt" onClick={() => { setEditing(p); setFormOpen(true); }}>
                          수정
                        </button>
                      )}
                      {isAdmin && (
                        <button className="text-sub hover:text-violet-hi" onClick={() => togglePin(p)}>
                          {p.pinned ? '고정 해제' : '상단 고정'}
                        </button>
                      )}
                      <button className="text-sub hover:text-dps" onClick={() => del(p)}>삭제</button>
                    </div>
                  )}
                  <Comments post={p} isAdmin={isAdmin} />
                </div>
              )}
            </div>
          );
        })}
        {posts && !posts.length && (
          <div className="p-10 text-center text-[13px] text-sub">
            {gated
              ? scopeType === 'global'
                ? '게시판은 로그인 후 열람할 수 있습니다.'
                : '이 게시판은 소속원만 열람할 수 있습니다.'
              : '아직 게시글이 없습니다 — 첫 글을 남겨보세요.'}
          </div>
        )}
        {!posts && <p className="p-10 text-center text-[13px] text-mute">불러오는 중…</p>}
      </Card>

      {formOpen && (
        <PostForm
          scopeType={scopeType}
          scopeId={scopeId}
          categories={meta.categories}
          adminOnly={meta.adminOnlyCategories}
          isAdmin={isAdmin}
          editing={editing}
          onClose={(saved) => { setFormOpen(false); setEditing(null); if (saved) reload(); }}
        />
      )}
      {catManageOpen && (
        <CategoryManager
          scopeType={scopeType}
          scopeId={scopeId}
          categories={meta.categories}
          adminOnly={meta.adminOnlyCategories}
          onClose={(saved) => { setCatManageOpen(false); if (saved) reloadMeta(); }}
        />
      )}
    </div>
  );
}
