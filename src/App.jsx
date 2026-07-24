import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
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
  // "/" 는 상태별로: 비로그인 = 마케팅 랜딩 / 로그인 = 파티·내일정·진도 전용 홈.
  // 로그인 사용자의 홈(HomePage)은 자체 헤더가 없으므로 전역 Header를 함께 노출한다.
  const showMarketingLanding = pathname === '/' && authReady && !user;
  const home = !authReady ? null : user ? <HomePage /> : <LandingPage />;
  return (
    <div className="min-h-screen bg-ink text-txt">
      {!showMarketingLanding && <Header />}
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
      {/* 마케팅 랜딩은 자체 푸터를 가진다. 그 외(로그인 홈 포함)는 슬림 푸터. */}
      {!showMarketingLanding && (
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
