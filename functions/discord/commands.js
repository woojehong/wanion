// 슬래시 명령 정의 (전역 등록용). scripts/registerDiscordCommands.mjs가 이 배열을 Discord에 PUT.
// 명령/옵션 이름은 소문자만 허용되나 한글은 대소문자가 없어 그대로 사용 가능.

import { CommandOptionType } from './constants.js';

const ROLE_CHOICES = [
  { name: '탱커', value: 'tank' },
  { name: '힐러', value: 'heal' },
  { name: '딜러', value: 'dps' },
];

export const COMMANDS = [
  {
    name: '연동',
    description: '와니온 계정과 이 디스코드 계정을 연결합니다 (마이페이지에서 코드 발급)',
    options: [
      { type: CommandOptionType.STRING, name: '코드', description: '마이페이지에서 발급한 6자리 연동 코드', required: true },
    ],
  },
  {
    name: '일정',
    description: '다가오는 레이드 일정을 봅니다',
    options: [
      {
        type: CommandOptionType.STRING,
        name: '범위',
        description: '전체 또는 내 소속 공대만',
        required: false,
        choices: [
          { name: '전체', value: 'all' },
          { name: '내공대', value: 'mine' },
        ],
      },
    ],
  },
  { name: '내신청', description: '내가 신청한 레이드 현황을 봅니다' },
  {
    name: '프로필',
    description: '누적 포인트·대표 캐릭터·소속을 봅니다',
    options: [
      { type: CommandOptionType.USER, name: '유저', description: '다른 사람의 프로필 (비우면 내 프로필)', required: false },
    ],
  },
  {
    name: '신청',
    description: '레이드에 신청합니다 (Battle.net 연동·대표 캐릭터 필요)',
    options: [
      { type: CommandOptionType.STRING, name: '공대', description: '신청할 레이드', required: true, autocomplete: true },
      { type: CommandOptionType.STRING, name: '캐릭터', description: '참가할 캐릭터', required: true, autocomplete: true },
      { type: CommandOptionType.STRING, name: '역할', description: '맡을 역할', required: true, choices: ROLE_CHOICES },
      { type: CommandOptionType.BOOLEAN, name: '벤치', description: '정원과 무관한 예비 인원으로 신청', required: false },
    ],
  },
  {
    name: '취소',
    description: '레이드 신청을 취소합니다',
    options: [
      { type: CommandOptionType.STRING, name: '공대', description: '취소할 레이드', required: true, autocomplete: true },
    ],
  },
  {
    name: '픽스',
    description: '[공대장] 확정 인원으로 로스터를 잠그고 출발 알림을 보냅니다',
    options: [
      { type: CommandOptionType.STRING, name: '공대', description: '픽스할 레이드', required: true, autocomplete: true },
    ],
  },
  {
    name: '카드채널',
    description: '[관리자] 이 채널을 특정 스코프의 레이드 카드보드로 지정합니다',
    options: [
      { type: CommandOptionType.STRING, name: '스코프', description: '카드가 게시될 조직 범위', required: true, autocomplete: true },
    ],
  },
];
