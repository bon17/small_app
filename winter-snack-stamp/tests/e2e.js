// 화면 확인용: Code.gs(흉내 낸 시트)와 Index.html을 Chromium에서 함께 돌려 스크린샷을 찍어요.
//   node tests/e2e.js [스크린샷 폴더]
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadApp, aid } = require('./gas-mock');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots'));
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ['김하늘', '이바다', '박구름', '최별', '정눈', '강솔', '조은비', '윤도현', '장하린', '임서준', '한지우', '오세린', '서민재', '신아라', '권도윤', '황보람', '안유진', '송태오', '전다온', '홍시우',
  '고은채', '문지호', '양서아', '손건우', '배수아', '백승민', '허윤서', '유하준', '남궁별', '노을'];

function setup() {
  const app = loadApp({ random: () => 0.5 });
  const admin = app.ok('adminLogin', { pin: '0000' }).token;
  const teacher = app.ok('padLogin', { pin: '1234' }).token;
  let v = app.ok('saveRoster', { rows: NAMES.map((name, i) => ({ no: i + 1, name })) }, { token: admin });
  v = app.ok('saveSettings', { settings: Object.assign({}, v.settings, { className: '2학년 3반', startDate: '2026-11-02', endDate: '2026-11-20' }) }, { token: admin });
  app.ok('setStock', { items: [
    { coupon: 'bung', flavor: '슈크림', stocked: 10 }, { coupon: 'bung', flavor: '팥', stocked: 1 },
    { coupon: 'hop', flavor: '피자', stocked: 4 }, { coupon: 'hop', flavor: '단팥', stocked: 4 }, { coupon: 'hop', flavor: '야채', stocked: 0 }, { coupon: 'hop', flavor: '고구마', stocked: 4 },
  ] }, { token: admin });
  const codes = {};
  v.students.forEach((s) => { codes[s.no] = s.code; });
  // 지난 수업 기록 몇 개
  let L = app.ok('startLesson', { subject: '국어', period: 1, actionId: aid() }, { token: teacher }).lesson.id;
  const award = (tool, students, extra) => app.ok('award', Object.assign({ lesson: L, tool, students, actionId: aid() }, extra || {}), { token: teacher });
  award('ready', []);
  award('star', [1, 2, 3, 5, 8, 13]);
  award('extra', [1], { amount: 20, reason: '발표' });
  award('extra', [2], { amount: 20, reason: '봉사' });
  award('extra', [2], { amount: 11, reason: '봉사' });
  app.ok('penalty', { lesson: L, students: [4], amount: 1, reason: '잠', actionId: aid() }, { token: teacher });
  app.ok('endLesson', { lesson: L, actionId: aid() }, { token: teacher });
  app.backdateLesson(L, 1); // 어제 수업으로 바꿔서 오늘 되찾기 찬스가 열리게
  const stu = (no, action, p) => app.ok(action, Object.assign({ actionId: aid() }, p || {}), { code: codes[no] });
  stu(1, 'stamp', { coupon: 'bung', n: 14 });
  stu(1, 'stamp', { coupon: 'hop', n: 6 });
  stu(1, 'donate', { n: 2 });
  stu(2, 'stamp', { coupon: 'bung', n: 30 });
  stu(2, 'chooseFlavor', { coupon: 'bung', flavor: '슈크림' });
  stu(2, 'rulesRead');
  stu(3, 'sendPraise', { to: 1, text: '모둠 활동 때 자료를 먼저 나눠 줘서 정말 고마웠어' });
  stu(5, 'sendPraise', { to: 1, text: '수학 시간에 모르는 문제를 친절하게 알려 줘서 고마워' });
  return { app, codes, admin, teacher };
}

async function main() {
  const { app, codes, admin } = setup();
  // 진짜 Apps Script처럼 /* 주석 */을 지운 HTML로 띄워요.
  const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const browser = await chromium.launch();
  const errors = [];

  async function open(view, code, viewport) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(view + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errors.push(view + ' console: ' + m.text()); });
    await page.exposeFunction('__mockApiNode', (req) => app.call(req.action, req.payload, { token: req.token, code: req.code }));
    await page.addInitScript(() => { window.__mockApi = (req) => window.__mockApiNode(req); });
    const boot = JSON.stringify({ view, code: code || '', url: 'https://app.test/exec' });
    await page.route('https://app.test/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace("'__BOOT__'", boot) }));
    await page.goto('https://app.test/exec', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    return page;
  }
  const shot = async (page, name, full) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full }); };

  // ── 교실 패드 ──
  const pad = await open('pad', '', { width: 1180, height: 820 });
  await shot(pad, '01-pad-lock');
  // 노트북 키보드로 열어요: Enter → PIN 치기(틀린 글자는 Backspace) → Enter
  await pad.keyboard.press('Enter');
  await pad.waitForSelector('.pinbox');
  await pad.keyboard.type('12349');
  await pad.keyboard.press('Backspace');
  if ((await pad.$$('.pinbox .dots i.on')).length !== 4) throw new Error('키보드로 친 PIN이 4자리가 아니에요');
  await shot(pad, '01b-pad-pin');
  await pad.keyboard.press('Enter');
  await pad.waitForSelector('[data-act="padSubject"]');
  await pad.click('[data-act="padSubject"][data-s="수학"]');
  await shot(pad, '02-pad-setup');
  await pad.click('[data-act="padStart"]');
  await pad.waitForSelector('.names');
  await shot(pad, '02b-pad-class-start');
  if (await pad.$('[data-act="padSound"]') || await pad.evaluate(() => Sound.on)) throw new Error('교실 패드는 소리가 없어야 해요');
  for (const no of [1, 4, 7]) await pad.click('[data-act="padPick"][data-no="' + no + '"]');
  await pad.click('[data-act="padTool"][data-tool="star"]');
  await pad.waitForTimeout(600);
  await pad.click('[data-act="padPick"][data-no="2"]');
  await pad.click('[data-act="padTool"][data-tool="mvp"]');
  await pad.waitForTimeout(600);
  for (const no of [9, 10]) await pad.click('[data-act="padPick"][data-no="' + no + '"]');
  await pad.click('[data-act="padMinus"]');
  await pad.click('[data-act="padMinusOk"]');
  await pad.click('#cfYes');
  await pad.waitForTimeout(700);
  for (const no of [3, 5, 6]) await pad.click('[data-act="padPick"][data-no="' + no + '"]');
  await shot(pad, '03-pad-class');
  await pad.click('[data-act="padNone"]');
  await pad.click('[data-act="padReady"]');
  await pad.click('#cfYes');
  await pad.waitForTimeout(900);
  await shot(pad, '04-pad-ready-fx');
  await pad.waitForTimeout(3000);
  await pad.click('[data-act="padEnd"]');
  await pad.click('#cfYes');
  await pad.waitForSelector('.summary');
  await shot(pad, '05-pad-summary');

  // ── 학생 (폰) ──
  const phone = { width: 390, height: 844 };
  const s1 = await open('student', codes[1], phone);
  await s1.waitForSelector('#rulesBody');
  await shot(s1, '10-student-rules');
  await s1.evaluate(() => { const b = document.querySelector('#rulesBody'); b.scrollTop = b.scrollHeight; b.dispatchEvent(new Event('scroll')); });
  await s1.click('#rulesOk');
  await s1.waitForTimeout(600);
  await shot(s1, '11-student-main');
  await shot(s1, '12-student-main-full', true);
  await s1.click('.cpn[data-c="bung"]');
  await s1.waitForSelector('.cells');
  await shot(s1, '13-student-coupon-bung');
  await s1.click('button[data-act="stuStamp1"]');
  await s1.waitForTimeout(900);
  await shot(s1, '14-student-coupon-stamped');
  await s1.click('.tabs [data-c="hop"]');
  await s1.waitForTimeout(400);
  await shot(s1, '15-student-coupon-hop');
  await s1.click('[data-act="closeModal"]');
  await s1.click('[data-act="stuPraise"]');
  await s1.click('[data-act="stuPraiseTo"][data-no="2"]');
  await s1.fill('#prText', '발표할 때 목소리가 크고 또박또박해서 멋있었어');
  await s1.waitForTimeout(200);
  await shot(s1, '16-student-praise');
  await s1.click('#prSend');
  await s1.waitForTimeout(700);

  const s2 = await open('student', codes[2], phone);
  await s2.waitForTimeout(600);
  await s2.click('[data-act="stuTicket"]');
  await s2.waitForTimeout(500);
  await shot(s2, '17-student-ticket');
  await s2.click('[data-act="closeModal"]');
  // 3번 학생: 호빵 쿠폰을 모두 찍어 다 채우고 맛을 골라 교환권 받기 (야채는 품절)
  app.ok('adjust', { no: 3, amount: 50, reason: '확인용', actionId: aid() }, { token: admin });
  app.ok('rulesRead', { actionId: aid() }, { code: codes[3] });
  const s3 = await open('student', codes[3], phone);
  await s3.waitForTimeout(600);
  await s3.click('.cpn[data-c="hop"]');
  await s3.click('[data-act="stuStampAll"]');
  await s3.waitForSelector('[data-act="stuFlavor"].big', { timeout: 5000 });
  await shot(s3, '18-student-complete');
  await s3.click('[data-act="stuFlavor"].big');
  await s3.waitForSelector('.flavors');
  await shot(s3, '19-student-flavor');
  await s3.click('[data-act="stuPickFlavor"][data-f="고구마"]');
  await s3.click('#cfYes');
  await s3.waitForSelector('.ticket-scale', { timeout: 5000 });
  await shot(s3, '19b-student-new-ticket');
  const after = app.ok('studentState', {}, { code: codes[3] });
  if (after.tickets.length !== 1 || after.tickets[0].flavor !== '고구마' || after.coupons.hop.filled !== 0) throw new Error('맛 고르기 결과가 이상해요');

  // ── 담임 관리 ──
  const adm = await open('admin', '', { width: 1280, height: 900 });
  await adm.fill('#admPin', '0000');
  await adm.click('[data-act="admLogin"]');
  await adm.waitForSelector('.atabs');
  await shot(adm, '20-admin-status');
  for (const [t, n] of [['tickets', '21-admin-tickets'], ['stock', '22-admin-stock'], ['praise', '23-admin-praise'], ['log', '24-admin-log'], ['roster', '25-admin-roster'], ['stats', '26-admin-stats'], ['settings', '27-admin-settings']]) {
    await adm.click('[data-act="admTab"][data-t="' + t + '"]');
    await adm.waitForTimeout(300);
    await shot(adm, n);
  }
  // 교환권 인쇄 모양 (A4)
  const print = await open('home', '', { width: 794, height: 1123 });
  await print.evaluate(() => {
    const list = [
      { no: '붕-001', student: 2, name: '이바다', coupon: 'bung', flavor: '슈크림', validUntil: '2026-11-27' },
      { no: '붕-002', student: 7, name: '조은비', coupon: 'bung', flavor: '팥', validUntil: '2026-11-27', reprint: true },
      { no: '호-001', student: 11, name: '한지우', coupon: 'hop', flavor: '피자', validUntil: '2026-11-27' },
      { no: '호-002', student: 12, name: '오세린', coupon: 'hop', flavor: '단팥', validUntil: '2026-11-27' },
      { no: '호-003', student: 13, name: '서민재', coupon: 'hop', flavor: '야채', validUntil: '2026-11-27' },
      { no: '호-004', student: 14, name: '남궁별', coupon: 'hop', flavor: '고구마', validUntil: '2026-11-27' },
    ];
    document.body.innerHTML = '<div id="printRoot" style="display:block">' + Tk.sheets(list, 'l', '2학년 3반') + Tk.sheets(list, 'm', '2학년 3반') + '</div>';
    Tk.fit(document.body);
  });
  await shot(print, '30-print-tickets', true);
  await print.evaluate(() => {
    const kids = Array.from({ length: 8 }, (_, i) => ({ no: i + 1, name: ['김하늘', '이바다', '박구름', '최별', '정눈', '강솔', '조은비', '윤도현'][i], link: 'https://script.google.com/macros/s/TEST/exec?s=abcd' + i }));
    const card = (s) => { const qr = qrcode(0, 'M'); qr.addData(s.link); qr.make(); return '<div class="qrcard"><div class="qr">' + qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) + '</div><div><small>🏮 2학년 3반 겨울 간식 포장마차</small><b>' + s.no + '번 ' + s.name + '</b><small>폰 카메라로 찍으면 내 스탬프·쿠폰이 열려요.</small></div></div>'; };
    document.body.innerHTML = '<div id="printRoot" style="display:block"><div class="sheet"><div class="qrsheet">' + kids.map(card).join('') + '</div></div></div>';
  });
  await shot(print, '31-print-qr', true);
  // 그림 모음
  await print.evaluate(() => {
    const cell = (h, cap) => '<div style="display:inline-block;width:180px;margin:6px;text-align:center;font:14px sans-serif"><div style="width:170px;margin:auto">' + h + '</div>' + cap + '</div>';
    let h = '';
    for (let i = 1; i <= 5; i++) h += cell(Art.bakeStage(i), '붕어빵 ' + i);
    for (let i = 1; i <= 5; i++) h += cell(Art.steamStage(i), '호빵 ' + i);
    h += cell(Art.stickerBung(), '붕어빵 스티커') + cell(Art.stickerHop(), '호빵 스티커') + cell(Art.stickerBurnt('bung'), '탄 스티커') + cell(Art.piggy(), '저금통') + cell(Art.batter(), '반죽') + cell(Art.bag(), '종이봉투');
    ['슈크림', '팥'].forEach((f) => { h += cell(Art.flavor('bung', f), f); });
    ['피자', '단팥', '야채', '고구마'].forEach((f) => { h += cell(Art.flavor('hop', f), f); });
    document.body.innerHTML = '<div style="background:#FFF6E6;padding:10px">' + h + '</div>';
  });
  await shot(print, '32-art', true);

  await browser.close();
  console.log('스크린샷:', OUT);
  if (errors.length) { console.log('오류:\n' + errors.join('\n')); process.exitCode = 1; } else console.log('페이지 오류 없음');
}

main().catch((e) => { console.error(e); process.exit(1); });
