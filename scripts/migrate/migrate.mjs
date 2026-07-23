#!/usr/bin/env node
// WANION P1-7 — kgusystem(wowkorea) → 와니온(raidkorea-f34c9) 마이그레이션 CLI
//
// 사용법 (scripts/migrate 폴더에서):
//   npm install
//   node migrate.mjs export      # 원본 프로젝트에서 JSON 덤프 (sa-source.json 필요)
//   node migrate.mjs transform   # 와니온 스키마로 변환 + 리포트
//   node migrate.mjs import      # 드라이런 — 쓸 내용 요약만 출력
//   node migrate.mjs import --apply   # 실제 기록 (sa-target.json 필요)
//   node migrate.mjs verify      # 대상 프로젝트 문서 수 대조
//
// 서비스 계정 키(비공개 키 JSON)는 이 폴더에 sa-source.json / sa-target.json 으로
// 두며, .gitignore 로 커밋이 차단되어 있다. 작업 후 즉시 삭제할 것.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { transformAll } from './transform.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;
const phase = process.argv[2];
const APPLY = process.argv.includes('--apply');

function die(msg) {
  console.error(`[중단] ${msg}`);
  process.exit(1);
}

function initDb(keyFile, label) {
  if (!existsSync(new URL(`./${keyFile}`, import.meta.url).pathname)) {
    die(`${keyFile} 이 없습니다 — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 (${label})`);
  }
  const key = JSON.parse(readFileSync(new URL(`./${keyFile}`, import.meta.url).pathname, 'utf8'));
  const app = initializeApp({ credential: cert(key) }, label);
  console.log(`[연결] ${label}: ${key.project_id}`);
  return getFirestore(app);
}

// ── Timestamp 직렬화 (JSON 왕복) ─────────────────────────────────────
function pack(value) {
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) return value.map(pack);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = pack(v);
    return out;
  }
  return value;
}

function unpack(value) {
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp') return new Timestamp(value.seconds, value.nanoseconds);
    if (Array.isArray(value)) return value.map(unpack);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = unpack(v);
    return out;
  }
  return value;
}

const save = (name, data) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}${name}.json`, JSON.stringify(pack(data), null, 1));
  console.log(`[저장] out/${name}.json`);
};
const load = (name) => unpack(JSON.parse(readFileSync(`${OUT}${name}.json`, 'utf8')));

async function dumpCollection(db, path) {
  const snap = await db.collection(path).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── export ───────────────────────────────────────────────────────────
async function runExport() {
  const db = initDb('sa-source.json', 'source');
  const [guilds, users, nicknames, postsRaw, raidsRaw] = await Promise.all([
    dumpCollection(db, 'guilds'),
    dumpCollection(db, 'users'),
    dumpCollection(db, 'nicknames'),
    dumpCollection(db, 'posts'),
    dumpCollection(db, 'raids'),
  ]);

  const posts = [];
  for (const p of postsRaw) {
    posts.push({ ...p, comments: await dumpCollection(db, `posts/${p.id}/comments`) });
  }
  const raids = [];
  for (const r of raidsRaw) {
    raids.push({
      ...r,
      apps: await dumpCollection(db, `raids/${r.id}/apps`),
      memos: await dumpCollection(db, `raids/${r.id}/memos`),
      cancels: await dumpCollection(db, `raids/${r.id}/cancels`),
      logs: await dumpCollection(db, `raids/${r.id}/logs`),
    });
    process.stdout.write(`\r[레이드] ${raids.length}/${raidsRaw.length}`);
  }
  console.log('');
  save('source', { guilds, users, nicknames, posts, raids });
  console.log(
    `[완료] guilds ${guilds.length} · users ${users.length} · nicknames ${nicknames.length}` +
      ` · raids ${raids.length} · posts ${posts.length}`
  );
}

// ── transform ────────────────────────────────────────────────────────
function runTransform() {
  const source = load('source');
  const result = transformAll(source);
  save('target', result);
  console.log(JSON.stringify(result.report, null, 2));
  if (result.report.warnings.length) {
    console.log(`[경고 ${result.report.warnings.length}건] 위 리포트 warnings 확인`);
  }
}

// ── import ───────────────────────────────────────────────────────────
class BatchWriter {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.pending = 0;
    this.total = 0;
  }
  async set(ref, data, opts) {
    this.batch.set(ref, data, opts || {});
    this.pending += 1;
    this.total += 1;
    if (this.pending >= 400) await this.flush();
  }
  async flush() {
    if (!this.pending) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.pending = 0;
    process.stdout.write(`\r[기록] ${this.total} docs`);
  }
}

async function runImport() {
  const t = load('target');
  const plan = t.report.counts;
  console.log('[계획]', JSON.stringify(plan));
  if (!APPLY) {
    console.log('[드라이런] 실제 기록하려면: node migrate.mjs import --apply');
    return;
  }
  const db = initDb('sa-target.json', 'target');
  const w = new BatchWriter(db);
  const mig = { migratedAt: FieldValue.serverTimestamp(), migratedFrom: 'kgusystem' };

  for (const g of t.guilds) {
    const { id, ...data } = g;
    await w.set(db.doc(`guilds/${id}`), { ...data, ...mig }, { merge: true }); // 시드 보존 병합
  }
  for (const u of t.legacyUsers) {
    const { id, ...data } = u;
    await w.set(db.doc(`legacyUsers/${id}`), { ...data, ...mig });
  }
  for (const n of t.legacyNicknames) {
    const { id, ...data } = n;
    await w.set(db.doc(`legacyNicknames/${id}`), { ...data, ...mig });
  }
  for (const r of t.raids) {
    const { id, apps, memos, cancels, logs, ...data } = r;
    await w.set(db.doc(`raids/${id}`), { ...data, ...mig });
    for (const a of apps) {
      const { id: aid, ...ad } = a;
      await w.set(db.doc(`raids/${id}/apps/${aid}`), ad);
    }
    for (const m of memos) {
      const { id: mid, ...md } = m;
      await w.set(db.doc(`raids/${id}/memos/${mid}`), md);
    }
    for (const c of cancels) {
      const { id: cid, ...cd } = c;
      await w.set(db.doc(`raids/${id}/cancels/${cid}`), cd);
    }
    for (const l of logs) {
      const { id: lid, ...ld } = l;
      await w.set(db.doc(`raids/${id}/logs/${lid}`), ld);
    }
  }
  for (const p of t.posts) {
    const { id, comments, ...data } = p;
    await w.set(db.doc(`posts/${id}`), { ...data, ...mig });
    for (const c of comments) {
      const { id: cid, ...cd } = c;
      await w.set(db.doc(`posts/${id}/comments/${cid}`), cd);
    }
  }
  await w.flush();
  console.log(`\n[완료] 총 ${w.total} 문서 기록. 다음: node migrate.mjs verify`);
}

// ── verify ───────────────────────────────────────────────────────────
async function runVerify() {
  const t = load('target');
  const db = initDb('sa-target.json', 'target');
  const count = async (path) => (await db.collection(path).count().get()).data().count;
  const groupCount = async (name) => (await db.collectionGroup(name).count().get()).data().count;

  const actual = {
    legacyUsers: await count('legacyUsers'),
    legacyNicknames: await count('legacyNicknames'),
    raids: await count('raids'),
    apps: await groupCount('apps'),
    cancels: await groupCount('cancels'),
    posts: await count('posts'),
    comments: await groupCount('comments'),
  };
  const expected = t.report.counts;
  let ok = true;
  for (const [k, v] of Object.entries(actual)) {
    const exp = expected[k];
    const pass = exp === undefined || v >= exp; // 대상에 기존 문서가 있을 수 있어 >= 로 판정
    if (!pass) ok = false;
    console.log(`${pass ? 'OK ' : 'FAIL'} ${k}: 기대 ${exp} / 실제 ${v}`);
  }
  console.log(ok ? '[검증 통과]' : '[검증 실패] — 재실행 또는 리포트 확인 필요');
  process.exit(ok ? 0 : 1);
}

const phases = { export: runExport, transform: runTransform, import: runImport, verify: runVerify };
if (!phases[phase]) {
  console.log('사용법: node migrate.mjs <export|transform|import [--apply]|verify>');
  process.exit(1);
}
await phases[phase]();
