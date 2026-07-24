import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { loadGamedata } from '../lib/db';
import { CLASSES, SYNERGIES, SERVERS } from '../lib/constants';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // users/{uid}
  const [platformRole, setPlatformRole] = useState(null); // memberships/{uid}_platform_platform
  const [gamedata, setGamedata] = useState({ classes: CLASSES, synergies: SYNERGIES, servers: SERVERS });

  // 인증 상태 — uid = auth.uid 직접 사용 (authlinks 간접층 없음)
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // 프로필 구독 + 최초 로그인 시 프로필 문서 생성
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return undefined;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        } else {
          // 최초 로그인 — 기본 프로필 생성 (대표캐릭 설정은 BNet 연동(P2) 후 강제)
          setDoc(ref, {
            displayName: user.displayName || '모험가',
            photoURL: user.photoURL || null,
            bnetLinked: false,
            mainCharId: null,
            createdAt: serverTimestamp(),
          }).catch(() => {});
        }
      },
      () => setProfile(null)
    );
    return unsub;
  }, [user]);

  // 플랫폼 역할 (운영자 콘솔 노출 판단)
  useEffect(() => {
    if (!user) {
      setPlatformRole(null);
      return undefined;
    }
    const unsub = onSnapshot(
      doc(db, 'memberships', `${user.uid}_platform_platform`),
      (snap) => setPlatformRole(snap.exists() ? snap.data().role : null),
      () => setPlatformRole(null)
    );
    return unsub;
  }, [user]);

  // 게임데이터 (세션당 1회)
  useEffect(() => {
    loadGamedata().then(setGamedata).catch(() => {});
  }, [user?.uid]);

  const value = useMemo(
    () => ({
      authReady,
      user,
      uid: user?.uid || null,
      profile,
      gamedata,
      // 표시 이름 — 대표 캐릭터가 있으면 캐릭터명 + 클래스 컬러, 없으면 구글 이름 폴백
      displayName: profile?.mainChar?.name || profile?.displayName || user?.displayName || '모험가',
      displayColor: profile?.mainChar?.classColor || null,
      isPlatformAdmin: platformRole === 'owner' || platformRole === 'staff',
      isOwner: platformRole === 'owner',
      signInGoogle: () => signInWithPopup(auth, googleProvider),
      signOutUser: () => signOut(auth),
    }),
    [authReady, user, profile, gamedata, platformRole]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
