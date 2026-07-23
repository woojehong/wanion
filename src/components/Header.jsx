import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Avatar } from './ui';

const MENU = [
  { to: '/board', label: '파티 찾기' },
  { to: '/guild/starfall', label: '길드' },
  { to: '/team/teamsad', label: '공격대' },
  { to: '/me', label: '마이페이지' },
];

export default function Header() {
  const { authReady, user, profile, isPlatformAdmin, signInGoogle, signOutUser } = useApp();
  const displayName = profile?.displayName || user?.displayName || '';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-[17px] font-extrabold tracking-[0.14em] text-txt">
            WAN<span className="text-violet">ION</span>
          </span>
          <span className="mono-label hidden sm:inline">RAID OPERATIONS</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-semibold transition ${
                  isActive ? 'bg-violet/10 text-violet-hi' : 'text-sub hover:text-txt'
                }`
              }
            >
              {m.label}
            </NavLink>
          ))}
          {isPlatformAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-semibold transition ${
                  isActive ? 'bg-violet/10 text-violet-hi' : 'text-violet hover:text-violet-hi'
                }`
              }
            >
              운영자
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {authReady && !user && (
            <button onClick={signInGoogle} className="btn-primary whitespace-nowrap !px-3 !py-1.5 !text-[13px]">
              로그인
            </button>
          )}
          {user && (
            <>
              <Link to="/board" className="btn-primary hidden whitespace-nowrap !px-3 !py-1.5 !text-[13px] sm:inline-flex">
                파티 개설
              </Link>
              <Link to="/me" className="flex items-center gap-2">
                <Avatar name={displayName || 'W'} size="h-7 w-7" />
                <span className="hidden max-w-[96px] truncate text-[13px] font-semibold text-txt sm:inline">
                  {displayName}
                </span>
              </Link>
              <button
                onClick={signOutUser}
                className="whitespace-nowrap text-[12px] text-sub hover:text-txt"
                title="로그아웃"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
      {/* 모바일 보조 내비 — 세로 글자 흘림 방지: 별도 행 + 가로 스크롤 */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-1.5 md:hidden">
        {MENU.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded px-3 py-1 text-[13px] font-semibold ${
                isActive ? 'bg-violet/10 text-violet-hi' : 'text-sub'
              }`
            }
          >
            {m.label}
          </NavLink>
        ))}
        {isPlatformAdmin && (
          <NavLink to="/admin" className="whitespace-nowrap rounded px-3 py-1 text-[13px] font-semibold text-violet">
            운영자
          </NavLink>
        )}
      </nav>
    </header>
  );
}
