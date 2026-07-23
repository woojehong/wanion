import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/db';
import { MonoLabel } from './ui';

// 알림 유형 → 점 색 + 짧은 태그 (이모지 금지 규칙 — 색점으로 구분)
const TYPE_META = {
  org_accepted: { dot: 'bg-heal', tag: '가입 승인' },
  org_rejected: { dot: 'bg-mute', tag: '가입 결과' },
  raid_fixed: { dot: 'bg-violet', tag: '픽스' },
  app_promoted: { dot: 'bg-heal', tag: '승격' },
  role_changed: { dot: 'bg-violet', tag: '역할' },
};

function relTime(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '방금';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NotificationBell() {
  const { uid } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return undefined;
    }
    return subscribeNotifications(uid, setItems);
  }, [uid]);

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  if (!uid) return null;

  const openItem = (it) => {
    if (!it.read) markNotificationRead(uid, it.id).catch(() => {});
    setOpen(false);
    if (it.link) navigate(it.link);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded text-sub transition hover:text-txt"
        title="알림"
        aria-label="알림"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[320px] max-w-[86vw] overflow-hidden rounded border border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <MonoLabel violet>NOTIFICATIONS</MonoLabel>
              {unread > 0 && (
                <button
                  className="text-[12px] text-sub hover:text-txt"
                  onClick={() => markAllNotificationsRead(uid, items).catch(() => {})}
                >
                  모두 읽음
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.map((it) => {
                const meta = TYPE_META[it.type] || { dot: 'bg-sub' };
                return (
                  <button
                    key={it.id}
                    onClick={() => openItem(it)}
                    className={`flex w-full gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition last:border-0 hover:bg-surface2 ${
                      it.read ? '' : 'bg-violet/5'
                    }`}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${it.read ? 'bg-transparent' : meta.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-bold text-txt">{it.title}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-mute">{relTime(it.createdAt)}</span>
                      </span>
                      {it.body && <span className="mt-0.5 block text-[12px] leading-snug text-sub">{it.body}</span>}
                    </span>
                  </button>
                );
              })}
              {!items.length && <p className="px-3 py-8 text-center text-[12px] text-mute">새 알림이 없어요.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
