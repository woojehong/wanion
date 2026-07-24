// WANION 디자인 v2 — 모바일 하단 내비게이션 (screen-map 공통 헤더 모바일 항목)
// 360px 겹침 없음: 짧은 라벨 + 균등 그리드. 이모지 금지 → 얇은 stroke SVG.
import { NavLink } from 'react-router-dom';

const Icon = ({ path, filled = false }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const ICONS = {
  home: <path d="M3 11l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  board: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M8 13h8M8 16h5" />
    </>
  ),
  guide: (
    <>
      <path d="M5 4h9a2 2 0 0 1 2 2v14l-5-2.5L6 20V6" />
      <path d="M16 6h3v12l-3-1.5" />
    </>
  ),
  community: (
    <>
      <path d="M4 5h16v10H9l-4 3v-3H4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </>
  ),
};

const BASE_TABS = [
  { to: '/board', label: '파티', icon: 'board' },
  { to: '/guides', label: '공략', icon: 'guide' },
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/community', label: '게시판', icon: 'community' },
  { to: '/me', label: '마이', icon: 'me' },
];

export default function MobileTabBar({ isPlatformAdmin = false }) {
  const tabs = isPlatformAdmin ? [...BASE_TABS, { to: '/admin', label: '운영', icon: 'admin' }] : BASE_TABS;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="하단 내비게이션"
    >
      <ul className="mx-auto grid max-w-content" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-violet-hi' : 'text-mute'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon path={ICONS[t.icon]} filled={isActive} />
                  <span>{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
