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
  const who = (no) => ({ code: codes[no], name: NAMES[no - 1] }); // 학생은 이름 + 코드로 들어와요
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
  const stu = (no, action, p) => app.ok(action, Object.assign({ actionId: aid() }, p || {}), who(no));
  stu(1, 'stamp', { coupon: 'bung', n: 14 });
  stu(1, 'stamp', { coupon: 'hop', n: 6 });
  stu(1, 'donate', { n: 2 });
  stu(2, 'stamp', { coupon: 'bung', n: 30 });
  stu(2, 'chooseFlavor', { coupon: 'bung', flavor: '슈크림' });
  stu(2, 'rulesRead');
  stu(3, 'sendPraise', { to: 1, text: '모둠 활동 때 자료를 먼저 나눠 줘서 정말 고마웠어' });
  stu(5, 'sendPraise', { to: 1, text: '수학 시간에 모르는 문제를 친절하게 알려 줘서 고마워' });
  return { app, codes, who, admin, teacher };
}

async function main() {
  const { app, codes, who, admin } = setup();
  // 진짜 Apps Script처럼 /* 주석 */을 지운 HTML로 띄워요.
  const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const browser = await chromium.launch();
  const errors = [];

  // login: 이 기기에 이미 로그인해 둔 학생 번호 (로그아웃 전 상태)
  async function open(view, code, viewport, login) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (login) await page.addInitScript((w) => { if (!localStorage.getItem('wss:me')) { localStorage.setItem('wss:me', w.code); localStorage.setItem('wss:meName', w.name); } }, who(login));
    page.on('pageerror', (e) => errors.push(view + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errors.push(view + ' console: ' + m.text()); });
    await page.exposeFunction('__mockApiNode', (req) => app.call(req.action, req.payload, { token: req.token, code: req.code, name: req.name, dev: req.dev }));
    await page.addInitScript(() => { window.__mockApi = (req) => window.__mockApiNode(req); });
    // 진짜 doGet처럼 주소의 ?s=코드 / ?v=화면을 보고 BOOT를 채워요 (첫 화면에서 코드를 넣어 들어갈 때).
    await page.route('https://app.test/**', (route) => {
      const q = new URL(route.request().url()).searchParams;
      const s = q.get('s'), v = q.get('v');
      const boot = JSON.stringify({ view: s ? 'student' : (v === 'stu' ? 'login' : (v || view)), code: s || code || '', url: 'https://app.test/exec' });
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace("'__BOOT__'", boot) });
    });
    await page.goto('https://app.test/exec', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    return page;
  }
  const shot = async (page, name, full) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full }); };

  // ── 교실 패드 ──
  const pad = await open('pad', '', { width: 1180, height: 820 });
  await shot(pad, '01-pad-lock');
  if (await pad.$('.lock .gauge')) throw new Error('교실 패드 잠금 화면에는 저금통이 없어야 해요');
  if (!(await pad.$('.lock .logo'))) throw new Error('교실 패드 잠금 화면에 로고가 있어야 해요');
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
  // 👥 반 전체: 전원 주기 +2, 전원 빼기 −1 (선택은 그대로 두어요)
  const before = app.ok('studentState', {}, who(30)).unstamped;
  await pad.click('[data-act="padAllExtra"]');
  await pad.click('.modal [data-group="amt"][data-v="2"]');
  await shot(pad, '03a-pad-all-extra');
  await pad.click('[data-act="padExtraOk"]');
  await pad.waitForTimeout(2900); // 🎉 효과가 지나갈 때까지
  await pad.click('[data-act="padAllMinus"]');
  await shot(pad, '03b-pad-all-minus');
  await pad.click('[data-act="padMinusOk"]');
  await pad.waitForSelector('#cfYes');
  await shot(pad, '03c-pad-all-minus-confirm');
  await pad.click('#cfYes');
  await pad.waitForTimeout(900);
  if (app.ok('studentState', {}, who(30)).unstamped !== before + 1) throw new Error('전원 주기 +2, 전원 빼기 −1이 모두 저장돼야 해요');
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
  // 1번 학생: 개인 QR로 왔어요. 코드는 들어가 있고 이름만 넣어요.
  const s1 = await open('student', codes[1], phone);
  await s1.waitForSelector('#stuName');
  if ((await s1.inputValue('#stuCode')) !== codes[1]) throw new Error('QR로 오면 코드가 미리 들어가 있어야 해요');
  if (await s1.$('.teachers')) throw new Error('QR 로그인 화면에는 선생님 버튼이 없어야 해요');
  await shot(s1, '09-student-qr-login');
  await s1.fill('#stuName', NAMES[0]);
  await s1.click('#stuGo');
  await s1.waitForSelector('#rulesBody');
  await shot(s1, '10-student-rules');
  await s1.evaluate(() => { const b = document.querySelector('#rulesBody'); b.scrollTop = b.scrollHeight; b.dispatchEvent(new Event('scroll')); });
  await s1.click('#rulesOk');
  await s1.waitForTimeout(600);
  await shot(s1, '11-student-main');
  await shot(s1, '12-student-main-full', true);
  // 폰에서 조금 내려도 제목이 천막과 겹치지 않아요 (천막이 함께 올라가요)
  await s1.evaluate(() => window.scrollTo(0, 60));
  await shot(s1, '11b-student-scrolled');
  await s1.evaluate(() => window.scrollTo(0, 0));
  await s1.click('.cpn[data-c="bung"]');
  await s1.waitForSelector('.cells');
  await shot(s1, '13-student-coupon-bung');
  // 서버가 2초 늦게 대답해도, 누르면 바로 스티커가 붙어요. 빨리 두 번 눌러도 둘 다 저장돼요.
  await s1.evaluate(() => { const real = window.__mockApi; window.__mockApi = (req) => new Promise((r) => setTimeout(r, req.action === 'stamp' ? 2000 : 0)).then(() => real(req)); });
  const filledBefore = await s1.$$eval('.cells .cell-s.fill', (els) => els.length);
  await s1.click('button[data-act="stuStamp1"]');
  await s1.click('button[data-act="stuStamp1"]');
  await s1.waitForTimeout(200);
  if ((await s1.$$eval('.cells .cell-s.fill', (els) => els.length)) !== filledBefore + 2) throw new Error('찍기를 누르면 바로 스티커가 붙어야 해요');
  await shot(s1, '14-student-coupon-stamped');
  await s1.waitForTimeout(4500); // 서버 저장 기다리기
  if (app.ok('studentState', {}, who(1)).coupons.bung.filled !== filledBefore + 2) throw new Error('빨리 두 번 누른 찍기가 모두 저장돼야 해요');
  if ((await s1.$$eval('.cells .cell-s.fill', (els) => els.length)) !== filledBefore + 2) throw new Error('저장 뒤에도 화면이 그대로여야 해요');
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

  // 2번 학생: QR 없이 첫 화면에서 이름과 코드 4자리를 넣어 들어와요. 틀리면 안내가 떠요.
  const s2 = await open('home', '', phone);
  await s2.waitForSelector('#stuName');
  await shot(s2, '16a-home-login');
  await shot(s2, '16a2-home-login-full', true);
  await s2.fill('#stuName', NAMES[1]);
  await s2.fill('#stuCode', codes[3]); // 다른 친구 코드
  await s2.press('#stuCode', 'Enter');
  await s2.waitForSelector('#stuErr:not([hidden])');
  await shot(s2, '16b-student-wrong-code');
  await s2.fill('#stuCode', codes[2]);
  await s2.press('#stuCode', 'Enter');
  await s2.waitForSelector('[data-act="stuTicket"]');
  await s2.waitForTimeout(600);
  await s2.click('[data-act="stuTicket"]');
  await s2.waitForTimeout(500);
  await shot(s2, '17-student-ticket');
  await s2.click('[data-act="closeModal"]');
  // 로그아웃 전에는 첫 화면 주소를 열어도 바로 내 화면이 나와요. 로그아웃하면 첫 화면으로 돌아가요.
  await s2.goto('https://app.test/exec', { waitUntil: 'load' });
  await s2.waitForSelector('[data-act="stuLogout"]', { timeout: 5000 });
  await s2.click('[data-act="stuLogout"]');
  await s2.click('#cfYes');
  await s2.waitForSelector('text=로그아웃했어요');
  await s2.click('text=첫 화면으로');
  await s2.waitForSelector('#stuName', { timeout: 5000 });
  // 예전에 코드만으로 들어온 기기: 코드는 남아 있고 이름만 한 번 더 넣어요.
  await s2.evaluate((c) => { localStorage.setItem('wss:me', c); localStorage.removeItem('wss:meName'); }, codes[2]);
  await s2.goto('https://app.test/exec', { waitUntil: 'load' });
  await s2.waitForSelector('#stuName');
  if ((await s2.inputValue('#stuCode')) !== codes[2]) throw new Error('예전 기기는 코드가 미리 들어가 있어야 해요');
  // 학생 공용 주소(?v=stu): 선생님 버튼 없이 로그인만 보여요.
  const sp = await open('home', '', phone);
  await sp.goto('https://app.test/exec?v=stu', { waitUntil: 'load' });
  await sp.waitForSelector('#stuName');
  if (await sp.$('.teachers')) throw new Error('학생 공용 주소에는 선생님 버튼이 없어야 해요');
  await shot(sp, '16c-student-shared-login');
  await sp.fill('#stuName', NAMES[4]);
  await sp.fill('#stuCode', codes[5]);
  await sp.click('#stuGo');
  await sp.waitForSelector('#rulesBody');
  // 3번 학생: 호빵 쿠폰을 모두 찍어 다 채우고 맛을 골라 교환권 받기 (야채는 품절)
  app.ok('adjust', { no: 3, amount: 50, reason: '확인용', actionId: aid() }, { token: admin });
  app.ok('rulesRead', { actionId: aid() }, who(3));
  const s3 = await open('student', codes[3], phone, 3); // 이미 로그인해 둔 기기
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
  const after = app.ok('studentState', {}, who(3));
  if (after.tickets.length !== 1 || after.tickets[0].flavor !== '고구마' || after.coupons.hop.filled !== 0) throw new Error('맛 고르기 결과가 이상해요');

  // ── 담임 관리 ──
  const adm = await open('admin', '', { width: 1280, height: 900 });
  await adm.fill('#admPin', '0000');
  await adm.click('[data-act="admLogin"]');
  await adm.waitForSelector('.atabs');
  // 담임 관리는 창을 다시 열어도(새로 고침) 로그아웃 전까지 PIN을 다시 묻지 않아요.
  if (!(await adm.evaluate(() => localStorage.getItem('wss:admin')))) throw new Error('담임 로그인이 창을 닫아도 남도록 localStorage에 있어야 해요');
  await adm.reload({ waitUntil: 'load' });
  await adm.waitForSelector('.atabs', { timeout: 5000 });
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
  // A4 한 장에 16명 (실제 웹앱 주소 길이로 QR을 만들어요)
  await print.evaluate((names) => {
    const kids = names.slice(0, 16).map((name, i) => {
      const code = String(1000 + (4821 + i * 577) % 9000);
      return { no: i + 1, name, code, link: 'https://script.google.com/macros/s/' + 'X'.repeat(74) + '/exec?s=' + code };
    });
    const card = (s) => Adm.qrCard(s, '2학년 3반');
    document.body.innerHTML = '<div id="printRoot" style="display:block"><div class="sheet"><div class="qrsheet">' + kids.map(card).join('') + '</div></div></div>';
  }, NAMES);
  await shot(print, '31-print-qr', true);
  // 그림 모음
  await print.evaluate(() => {
    const cell = (h, cap) => '<div style="display:inline-block;width:180px;margin:6px;text-align:center;font:14px sans-serif"><div style="width:170px;margin:auto">' + h + '</div>' + cap + '</div>';
    let h = '';
    for (let i = 1; i <= 5; i++) h += cell(Art.bakeStage(i), '붕어빵 ' + i);
    for (let i = 1; i <= 5; i++) h += cell(Art.steamStage(i), '호빵 ' + i);
    h += cell(Art.logo(), '로고') + cell(Art.stickerBung(), '붕어빵 스티커') + cell(Art.stickerHop(), '호빵 스티커') + cell(Art.stickerBurnt('bung'), '탄 스티커') + cell(Art.piggy(), '저금통') + cell(Art.batter(), '반죽') + cell(Art.bag(), '종이봉투');
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
