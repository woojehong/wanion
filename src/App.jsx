import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import BoardPage from './pages/BoardPage';
import RaidDetailPage from './pages/RaidDetailPage';
import GuildPage from './pages/GuildPage';
import TeamPage from './pages/TeamPage';
import MyPage from './pages/MyPage';
import AdminPage from './pages/AdminPage';
import GuidesPage from './pages/GuidesPage';
import CommunityPage from './pages/CommunityPage';

export default function App() {
  const { pathname } = useLocation();
  const { user, authReady } = useApp();
  // 랜딩(마케팅·온보딩)은 비로그인 방문자에게만. 로그인 사용자는 "/" 진입 시 곧바로 파티 보드로.
  const isLanding = pathname === '/';
  const home = !authReady ? null : user ? <Navigate to="/board" replace /> : <LandingPage />;
  return (
    <div className="min-h-screen bg-ink text-txt">
      {!isLanding && <Header />}
      <Routes>
        <Route path="/" element={home} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/raid/:raidId" element={<RaidDetailPage />} />
        <Route path="/guild/:guildId" element={<GuildPage />} />
        <Route path="/team/:teamId" element={<TeamPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* 랜딩은 자체 푸터(RUN BY STUDIO HOOJE)를 가진다. 그 외 페이지는 슬림 푸터. */}
      {!isLanding && (
        <footer className="border-t border-line py-6">
          <div className="mx-auto flex max-w-content items-center justify-between px-4">
            <span className="mono-label">WANION · 와니온</span>
            <span className="credit-hooje text-[12px]">RUN BY STUDIO HOOJE</span>
          </div>
        </footer>
      )}
    </div>
  );
}
