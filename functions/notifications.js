// 알림 트리거 4종 — 이벤트 발생 시 알림 생성(+연동 유저 디코 DM).
//  1) 가입/지원 승인·반려   (orgApplications 상태 전이)
//  2) 출발 확정(픽스)        (raids.fixed false→true)
//  3) 대기→확정 승격         (apps.status *→active)
//  4) 조직 역할 변경          (memberships.role 변경)
//
// 리전은 명시 지정(setGlobalOptions보다 import 시점이 앞서므로).

import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { DISCORD_BOT_TOKEN } from './discord/index.js';
import { createNotification } from './notify.js';
import { fmtDateTime } from './discord/embeds.js';

const REGION = 'asia-northeast3';
const ORG_COL = { guild: 'guilds', team: 'teams', alliance: 'alliances' };
const SCOPE_KO = { guild: '길드', team: '공대', alliance: '연합' };
const ROLE_KO = {
  owner: '소유자',
  staff: '운영진',
  master: '길드마스터',
  officer: '관리자',
  leader: '공대장',
  member: '멤버',
};

async function orgName(db, scopeType, scopeId) {
  try {
    const s = await db.doc(`${ORG_COL[scopeType] || 'guilds'}/${scopeId}`).get();
    return s.exists ? s.data().name : scopeId;
  } catch {
    return scopeId;
  }
}
function orgLink(scopeType, scopeId) {
  return scopeType === 'team' ? `/team/${scopeId}` : `/guild/${scopeId}`;
}

/** 1) 가입/지원 판정 */
export const onOrgApplicationDecided = onDocumentUpdated(
  { region: REGION, document: 'orgApplications/{appId}', secrets: [DISCORD_BOT_TOKEN] },
  async (event) => {
    const b = event.data?.before?.data();
    const a = event.data?.after?.data();
    if (!b || !a) return;
    if (b.status !== 'pending' || !['accepted', 'rejected'].includes(a.status)) return;
    const db = getFirestore();
    const name = await orgName(db, a.scopeType, a.scopeId);
    const scope = SCOPE_KO[a.scopeType] || '';
    const accepted = a.status === 'accepted';
    await createNotification(
      db,
      a.uid,
      {
        type: accepted ? 'org_accepted' : 'org_rejected',
        title: accepted ? `${scope} 가입 승인` : `${scope} 가입 결과`,
        body: accepted
          ? `'${name}' ${scope} 가입이 승인됐어요. 환영합니다!`
          : `'${name}' ${scope} 가입 신청이 반려됐어요.`,
        link: orgLink(a.scopeType, a.scopeId),
      },
      { botToken: DISCORD_BOT_TOKEN.value() }
    );
  }
);

/** 2) 출발 확정(픽스) — 확정 인원 전원에게 */
export const onRaidFixedNotify = onDocumentUpdated(
  { region: REGION, document: 'raids/{raidId}', secrets: [DISCORD_BOT_TOKEN] },
  async (event) => {
    const b = event.data?.before?.data();
    const a = event.data?.after?.data();
    if (!b || !a) return;
    if (b.fixed === true || a.fixed !== true) return; // false→true 전이만
    const ids = Array.isArray(a.fixedUserIds) ? a.fixedUserIds : [];
    if (!ids.length) return;
    const db = getFirestore();
    const token = DISCORD_BOT_TOKEN.value();
    const link = `/raid/${event.params.raidId}`;
    const when = fmtDateTime(a.startAt);
    await Promise.all(
      ids.map((uid) =>
        createNotification(
          db,
          uid,
          {
            type: 'raid_fixed',
            title: '출발 확정 (픽스)',
            body: `'${a.title}' 로스터가 확정됐어요. 집결 ${when}.`,
            link,
          },
          { botToken: token }
        )
      )
    );
  }
);

/** 3) 대기/벤치/승인대기 → 확정 승격 */
export const onAppPromoted = onDocumentUpdated(
  { region: REGION, document: 'raids/{raidId}/apps/{appId}', secrets: [DISCORD_BOT_TOKEN] },
  async (event) => {
    const b = event.data?.before?.data();
    const a = event.data?.after?.data();
    if (!b || !a) return;
    if (!['wait', 'pending', 'bench'].includes(b.status) || a.status !== 'active') return;
    const uid = a.userId || event.params.appId;
    const db = getFirestore();
    let title = '레이드';
    try {
      const r = await db.doc(`raids/${event.params.raidId}`).get();
      if (r.exists) title = r.data().title;
    } catch {
      /* keep default */
    }
    await createNotification(
      db,
      uid,
      {
        type: 'app_promoted',
        title: '확정 승격',
        body: `'${title}' 에서 확정 인원으로 올라갔어요!`,
        link: `/raid/${event.params.raidId}`,
      },
      { botToken: DISCORD_BOT_TOKEN.value() }
    );
  }
);

/** 4) 조직 역할 변경 (member↔officer 등). 생성/삭제는 제외(가입=orgApp 트리거, 탈퇴/제명 오탐 방지) */
export const onMembershipRoleChanged = onDocumentWritten(
  { region: REGION, document: 'memberships/{id}', secrets: [DISCORD_BOT_TOKEN] },
  async (event) => {
    const b = event.data?.before?.exists ? event.data.before.data() : null;
    const a = event.data?.after?.exists ? event.data.after.data() : null;
    if (!b || !a) return;
    if (b.role === a.role) return;
    if (a.scopeType === 'platform') return;
    const db = getFirestore();
    const name = await orgName(db, a.scopeType, a.scopeId);
    const scope = SCOPE_KO[a.scopeType] || '';
    await createNotification(
      db,
      a.uid,
      {
        type: 'role_changed',
        title: `${scope} 역할 변경`,
        body: `'${name}' 에서 역할이 '${ROLE_KO[a.role] || a.role}'(으)로 변경됐어요.`,
        link: orgLink(a.scopeType, a.scopeId),
      },
      { botToken: DISCORD_BOT_TOKEN.value() }
    );
  }
);
