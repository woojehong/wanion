import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import BoardPage from './pages/BoardPage';
import RaidDetailPage from './pages/RaidDetailPage';
import GuildPage from './pages/GuildPage';
import TeamPage from './pages/TeamPage';
import MyPage from './pages/MyPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  return (
    <div className="min-h-screen bg-ink text-txt">
      {!isLanding && <Header />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/raid/:raidId" element={<RaidDetailPage />} />
        <Route path="/guild/:guildId" element={<GuildPage />} />
        <Route path="/team/:teamId" element={<TeamPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="border-t border-line py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <span className="mono-label">WANION · 와니온</span>
          <span className="text-[12px] text-sub">Made by 후제공방</span>
        </div>
      </footer>
    </div>
  );
}
