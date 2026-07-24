import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Avatar } from './ui';
import NotificationBell from './NotificationBell';
import MobileTabBar from './design-v2/MobileTabBar';

// 데스크톱 중앙 메뉴 (screen-map 공통 헤더): 파티 찾기 / 공략 / 게시판 / 길드 / 공격대
// 마이페이지는 우측 프로필(아바타)로 접근한다.
const MENU = [
  { to: '/board', label: '파티 찾기' },
  { to: '/guides', label: '공략' },
  { to: '/community', label: '게시판' },
  { to: '/guild/dogs', label: '길드' },
  { to: '/team/teamsad', label: '공격대' },
];

export default function Header() {
  const { authReady, user, isPlatformAdmin, signInGoogle, signOutUser, displayName, displayColor } = useApp();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-content items-center gap-6 px-4">
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
                  `whitespace-nowrap rounded-btn px-3 py-1.5 text-[13px] font-semibold transition-colors ${
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
                  `whitespace-nowrap rounded-btn px-3 py-1.5 text-[13px] font-semibold transition-colors ${
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
                <NotificationBell />
                <Link to="/me" className="flex items-center gap-2">
                  <Avatar name={displayName || 'W'} color={displayColor || undefined} size="h-7 w-7" />
                  <span className="hidden max-w-[96px] truncate text-[13px] font-semibold text-txt sm:inline" style={{ color: displayColor || undefined }}>
                    {displayName}
                  </span>
                </Link>
                <button
                  onClick={signOutUser}
                  className="hidden whitespace-nowrap text-[12px] text-sub hover:text-txt sm:inline"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {/* 모바일 하단 5탭 내비게이션 (md 미만) — 세로 글자 흘림·메뉴 겹침 방지 */}
      <MobileTabBar isPlatformAdmin={isPlatformAdmin} />
    </>
  );
}
