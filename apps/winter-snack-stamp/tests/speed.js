// 속도 재기: 진짜 Apps Script처럼 느린 서버(요청 한 번 ≈ 1.7초)와 느린 페이지 열기(≈ 2.5초)를 흉내 내고,
// 누른 뒤 다음 화면이 뜨기까지 몇 초 걸리는지 재요. (11/12 실제 웹앱에서 잰 값: 요청 1.3~2.2초, 페이지 열기 1.6~2.9초)
//   node tests/speed.js
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadApp, aid } = require('./gas-mock');

const API_MS = Number(process.env.API_MS || 1700);
const PAGE_MS = Number(process.env.PAGE_MS || 2500);
const NAMES = Array.from({ length: 31 }, (_, i) => '학생' + (i + 1));

function setup() {
  const app = loadApp({ random: () => 0.5 });
  const admin = app.ok('adminLogin', { pin: '0000' }).token;
  const teacher = app.ok('padLogin', { pin: '1234' }).token;
  let v = app.ok('saveRoster', { rows: NAMES.map((name, i) => ({ no: i + 1, name })) }, { token: admin });
  app.ok('saveSettings', { settings: Object.assign({}, v.settings, { className: '2학년 3반', startDate: '2026-11-02', endDate: '2026-12-04' }) }, { token: admin });
  // 1주일쯤 쓴 기록 (수업 25번, 수업마다 스탬프 여러 번)
  for (let k = 0; k < 25; k++) {
    const L = app.ok('startLesson', { subject: '국어', period: 1 + (k % 6), actionId: aid() }, { token: teacher }).lesson.id;
    app.ok('award', { lesson: L, tool: 'ready', students: [], actionId: aid() }, { token: teacher });
    for (let j = 0; j < 4; j++) app.ok('award', { lesson: L, tool: 'star', students: [1 + (k + j) % 31, 1 + (k * 3 + j) % 31, 1 + (k * 7 + j) % 31], actionId: aid() }, { token: teacher });
    app.ok('endLesson', { lesson: L, actionId: aid() }, { token: teacher });
  }
  const code1 = app.ok('adminState', {}, { token: admin }).students[0].code;
  return { app, admin, code1 };
}

async function main() {
  const { app, admin, code1 } = setup();
  const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const browser = await chromium.launch();
  const results = [];
  const errors = [];

  async function open(view, init, arg) {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(view + ': ' + e.message));
    if (init) await page.addInitScript(init, arg);
    await page.exposeFunction('__mockApiNode', async (req) => {
      await new Promise((r) => setTimeout(r, API_MS));
      return app.call(req.action, req.payload, { token: req.token, code: req.code, name: req.name, dev: req.dev });
    });
    await page.addInitScript(() => { window.__mockApi = (req) => window.__mockApiNode(req); });
    await page.route('https://app.test/**', async (route) => {
      const q = new URL(route.request().url()).searchParams;
      const s = q.get('s'), v = q.get('v');
      const boot = JSON.stringify({ view: s ? 'student' : (v === 'stu' ? 'login' : (v || 'home')), code: s || '', url: 'https://app.test/exec' });
      await new Promise((r) => setTimeout(r, PAGE_MS));
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace("'__BOOT__'", boot) });
    });
    return page;
  }
  async function timeIt(label, page, act, selector) {
    const t0 = Date.now();
    await act();
    // SHOTS=폴더 를 주면 기다리는 동안 보이는 화면을 찍어요 (빈 화면 대신 안내가 보이는지)
    if (process.env.SHOTS) { await page.waitForTimeout(PAGE_MS + 400); await page.screenshot({ path: path.join(process.env.SHOTS, 'wait-' + results.length + '.png') }); }
    await page.waitForSelector(selector, { timeout: 30000 });
    const ms = Date.now() - t0;
    results.push([label, ms]);
    console.log(label.padEnd(34), (ms / 1000).toFixed(1) + '초');
  }
  const go = (page, q) => () => page.goto('https://app.test/exec' + (q || ''), { waitUntil: 'commit' });

  // 학생: 저장된 로그인으로 앱 열기 (두 번째부터는 이 기기에 지난 화면이 있어요)
  let p = await open('student', (code) => { localStorage.setItem('wss:me', code); localStorage.setItem('wss:meName', '학생1'); }, code1);
  await timeIt('학생: 앱 열기 (처음)', p, go(p), '.cpn');
  await timeIt('학생: 앱 다시 열기', p, go(p), '.cpn');
  // 교실 패드
  p = await open('pad');
  await timeIt('패드: 앱 열기 → 잠금 화면', p, go(p, '?v=pad'), '.lock');
  await timeIt('패드: PIN 넣기 → 수업 준비 화면', p, async () => {
    await p.keyboard.press('Enter'); await p.waitForSelector('.pinbox'); await p.keyboard.type('1234'); await p.keyboard.press('Enter');
  }, '[data-act="padSubject"]');
  await p.click('[data-act="padSubject"][data-s="수학"]');
  await timeIt('패드: 수업 시작 → 이름 카드', p, () => p.click('[data-act="padStart"]'), '.names');
  // 첫 화면에서 교실 패드 버튼
  p = await open('home');
  await p.goto('https://app.test/exec', { waitUntil: 'load' });
  await p.waitForSelector('.teachers a, .teachers button');
  await timeIt('첫 화면 → 교실 패드 버튼 → 잠금 화면', p, () => p.click('.teachers .btn.red'), '.lock');
  // 담임 관리
  p = await open('admin');
  await p.goto('https://app.test/exec?v=admin', { waitUntil: 'load' });
  await p.waitForSelector('#admPin');
  await timeIt('담임: PIN 넣기 → 장부 화면', p, async () => { await p.fill('#admPin', '0000'); await p.click('[data-act="admLogin"]'); }, '.atabs');
  await timeIt('담임: 앱 다시 열기 (로그인 유지)', p, go(p, '?v=admin'), '.atabs');

  await browser.close();
  if (errors.length) { console.log('오류:\n' + errors.join('\n')); process.exitCode = 1; }
  if (process.env.SPEED_OUT) fs.writeFileSync(process.env.SPEED_OUT, JSON.stringify(results));
}

main().catch((e) => { console.error(e); process.exit(1); });
