import PostBoard from '../components/PostBoard';
import { MonoLabel } from '../components/ui';

/**
 * 전체(플랫폼) 통합 게시판 — 스코프 3층 구조의 1층.
 * 길드·공대 게시판은 동일한 PostBoard 컴포넌트를 각 페이지에서 재사용한다.
 */
export default function CommunityPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <MonoLabel violet>COMMUNITY BOARD</MonoLabel>
        <h1 className="mt-1 text-[26px] font-extrabold">게시판</h1>
        <p className="mt-1 text-[13px] text-sub">와니온 전체 공지와 자유 이야기, 구인구직·거래까지 — 모든 스코프의 시작점.</p>
      </div>
      <PostBoard scopeType="global" />
    </main>
  );
}
