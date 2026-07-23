// ★ 전역 함수 옵션 — 반드시 어떤 함수 정의보다 먼저 실행돼야 한다.
// index.js가 함수 모듈(discord/*, notifications, progressJobs, bnetVerify, wcl)을 import하기 전에
// 이 파일을 최상단에서 import해야, 그 모듈들의 함수 정의가 전역 옵션을 물려받는다.
//
// 왜: 기본 maxInstances=100이라 함수 16개면 Cloud Run 'total CPU per region' 쿼터를 초과한다
// (배포 시 onAppPromoted·scheduledGuildVerify 생성 실패). 소규모 커뮤니티엔 인스턴스 상한 2면 충분.

import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 2 });
