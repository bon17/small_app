// 서버 규칙 테스트:  node --test winter-snack-stamp/tests
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, aid } = require('./gas-mock');

const ROSTER = [
  { no: 1, name: '김하늘' }, { no: 2, name: '이바다' }, { no: 3, name: '박구름' }, { no: 4, name: '최별' }, { no: 5, name: '정눈' },
];

function setupClass(opts = {}) {
  const app = loadApp(opts);
  const admin = app.ok('adminLogin', { pin: '0000' }).token;
  const teacher = app.ok('padLogin', { pin: '1234' }).token;
  let view = app.ok('saveRoster', { rows: ROSTER }, { token: admin });
  if (opts.settings) view = app.ok('saveSettings', { settings: Object.assign({}, view.settings, opts.settings) }, { token: admin });
  const codes = {};
  view.students.forEach((s) => { codes[s.no] = s.code; });
  const ctx = {
    app, admin, teacher, codes,
    start(subject = '수학', period = 3) {
      const v = app.ok('startLesson', { subject, period, actionId: aid() }, { token: teacher });
      return v.lesson.id;
    },
    award(lesson, tool, students, extra = {}) {
      return app.ok('award', Object.assign({ lesson, tool, students, actionId: aid() }, extra), { token: teacher });
    },
    penalty(lesson, students, amount, extra = {}) {
      return app.ok('penalty', Object.assign({ lesson, students, amount, reason: '방해', actionId: aid() }, extra), { token: teacher });
    },
    end(lesson) { return app.ok('endLesson', { lesson, actionId: aid() }, { token: teacher }); },
    me(no) { return app.ok('studentState', {}, { code: codes[no] }); },
    student(no, action, payload = {}) { return app.ok(action, Object.assign({ actionId: aid() }, payload), { code: codes[no] }); },
    studentCall(no, action, payload = {}) { return app.call(action, Object.assign({ actionId: aid() }, payload), { code: codes[no] }); },
    adminView() { return app.ok('adminState', {}, { token: admin }); },
    stock(items) { return app.ok('setStock', { items }, { token: admin }); },
  };
  return ctx;
}

test('명단을 저장하면 개인 코드가 생기고, 학생은 자기 코드로만 들어와요', () => {
  const c = setupClass();
  assert.equal(Object.keys(c.codes).length, 5);
  assert.match(c.codes[1], /^[a-z2-9]{8}$/);
  assert.equal(c.me(1).me.name, '김하늘');
  const bad = c.app.call('studentState', {}, { code: 'nope' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'CODE');
  // 다시 저장해도 같은 학생의 코드는 그대로예요.
  const again = c.app.ok('saveRoster', { rows: ROSTER.concat([{ no: 6, name: '한솔' }]) }, { token: c.admin });
  assert.equal(again.students.find((s) => s.no === 1).code, c.codes[1]);
  assert.equal(again.students.length, 6);
});

test('PIN을 틀리면 막고, 5번 틀리면 잠가요', () => {
  const app = loadApp();
  for (let i = 0; i < 5; i++) assert.equal(app.call('padLogin', { pin: '9999' }).code, 'PIN');
  assert.equal(app.call('padLogin', { pin: '1234' }).code, 'LOCKED');
  assert.equal(app.call('padState', {}, { token: 'fake' }).code, 'AUTH');
});

test('⭐ 열심히와 🙋 적극 참여는 같은 수업에서 학생마다 한 번씩만, 따로 받을 수 있어요', () => {
  const c = setupClass();
  const L = c.start();
  let r = c.award(L, 'star', [1, 2]);
  assert.deepEqual(r.applied, [1, 2]);
  r = c.award(L, 'star', [1, 2, 3]);
  assert.deepEqual(r.skipped, [1, 2]);
  assert.deepEqual(r.applied, [3]);
  c.award(L, 'raise', [1]);
  assert.equal(c.me(1).unstamped, 2);
  assert.equal(r.view.marks[3].star, 1);
});

test('👑 MVP는 수업마다 1명만, 🔔 수업 준비는 전원에게 한 번만', () => {
  const c = setupClass();
  const L = c.start();
  assert.equal(c.app.call('award', { lesson: L, tool: 'mvp', students: [1, 2], actionId: aid() }, { token: c.teacher }).code, 'BAD');
  c.award(L, 'mvp', [2]);
  assert.equal(c.app.call('award', { lesson: L, tool: 'mvp', students: [3], actionId: aid() }, { token: c.teacher }).code, 'DONE');
  assert.equal(c.me(2).unstamped, 2);
  c.award(L, 'ready', []);
  assert.equal(c.me(5).unstamped, 1);
  assert.equal(c.app.call('award', { lesson: L, tool: 'ready', students: [], actionId: aid() }, { token: c.teacher }).code, 'DONE');
  c.award(L, 'extra', [4], { amount: 3, reason: '발표' });
  assert.equal(c.me(4).unstamped, 4);
});

test('빼기는 반죽 → 최근에 찍은 쿠폰 순서로 빠지고, 모자라면 마이너스가 돼요', () => {
  const c = setupClass();
  const L = c.start();
  c.award(L, 'extra', [1], { amount: 10 });
  c.student(1, 'stamp', { coupon: 'hop', n: 3 });
  c.student(1, 'stamp', { coupon: 'bung', n: 5 });
  let me = c.me(1);
  assert.equal(me.unstamped, 2);
  c.penalty(L, [1], 4);
  me = c.me(1);
  assert.equal(me.unstamped, 0);
  assert.equal(me.coupons.bung.filled, 3, '가장 최근에 찍은 붕어빵 쿠폰에서 먼저 빠져요');
  assert.equal(me.coupons.hop.filled, 3);
  c.penalty(L, [1], 8);
  me = c.me(1);
  assert.equal(me.coupons.bung.filled, 0);
  assert.equal(me.coupons.hop.filled, 0);
  assert.equal(me.unstamped, -2);
  c.award(L, 'star', [1]);
  assert.equal(c.me(1).unstamped, -1, '다음에 받는 스탬프로 갚아요');
});

test('다 채운 쿠폰은 빼앗기지 않고, 맛을 고르면 교환권이 나와요 (선착순 재고)', () => {
  const c = setupClass({ settings: { cells: { bung: 5, hop: 45 } } });
  const L = c.start();
  c.award(L, 'extra', [1, 2], { amount: 6 });
  c.student(1, 'stamp', { coupon: 'bung', n: 9 });
  let me = c.me(1);
  assert.equal(me.coupons.bung.filled, 5, '칸 수보다 많이 찍지 않아요');
  assert.equal(me.unstamped, 1);
  assert.equal(c.studentCall(1, 'stamp', { coupon: 'bung', n: 1 }).code, 'FULL');
  c.penalty(L, [1], 3);
  me = c.me(1);
  assert.equal(me.coupons.bung.filled, 5);
  assert.equal(me.unstamped, -2);
  assert.equal(c.studentCall(1, 'chooseFlavor', { coupon: 'bung', flavor: '팥' }).code, 'SOLDOUT');
  c.stock([{ coupon: 'bung', flavor: '팥', stocked: 1 }, { coupon: 'bung', flavor: '슈크림', stocked: 5 }]);
  me = c.student(1, 'chooseFlavor', { coupon: 'bung', flavor: '팥' });
  assert.equal(me.tickets[0].no, '붕-001');
  assert.equal(me.coupons.bung.filled, 0, '새 쿠폰이 시작돼요');
  c.student(2, 'stamp', { coupon: 'bung', n: 5 });
  assert.equal(c.me(2).flavors.bung.find((f) => f.name === '팥').left, 0);
  assert.equal(c.studentCall(2, 'chooseFlavor', { coupon: 'bung', flavor: '팥' }).code, 'SOLDOUT');
  me = c.student(2, 'chooseFlavor', { coupon: 'bung', flavor: '슈크림' });
  assert.equal(me.tickets[0].no, '붕-002');
  const v = c.app.ok('exchange', { ticket: '붕-001', actionId: aid() }, { token: c.admin });
  assert.equal(v.tickets.find((t) => t.no === '붕-001').exchanged, true);
  assert.equal(v.stock.find((s) => s.flavor === '팥').exchanged, 1);
});

test('되찾기 찬스: 개인 빼기 뒤 다음 수업에서 칭찬받으면 1개, 전체 빼기는 없음', () => {
  const c = setupClass();
  let L = c.start('국어', 1);
  c.award(L, 'extra', [1, 2], { amount: 5 });
  c.penalty(L, [1], 3);
  c.penalty(L, [2], 2, { bulk: true });
  let r = c.award(L, 'star', [1, 2]);
  assert.deepEqual(r.recovered, [], '같은 수업에서는 되찾기가 안 돼요');
  c.end(L);
  L = c.start('영어', 2);
  r = c.award(L, 'star', [1, 2]);
  assert.deepEqual(r.recovered, [1]);
  r = c.award(L, 'raise', [1]);
  assert.deepEqual(r.recovered, [], '빼기 1번당 한 번만 돌려받아요');
  assert.equal(c.me(1).unstamped, 5 - 3 + 1 + 1 + 1 + 1);
});

test('황금 붕어빵: 기부한 만큼만 확률이 생기고, 수업에서 칭찬을 처음 받을 때 한 번만 뽑아요', () => {
  const c = setupClass();
  c.app.setRandom(() => 0);
  let L = c.start();
  let r = c.award(L, 'star', [1]);
  assert.deepEqual(r.golden, [], '기부가 0개면 0%예요');
  c.award(L, 'extra', [1], { amount: 20 });
  c.student(1, 'donate', { n: 15 });
  c.end(L);
  L = c.start();
  r = c.award(L, 'star', [1]);
  assert.equal(r.golden.length, 1);
  assert.equal(r.golden[0].amount, 3);
  r = c.award(L, 'raise', [1]);
  assert.deepEqual(r.golden, [], '같은 수업의 두 번째 칭찬은 뽑지 않아요');
  c.award(L, 'extra', [2], { amount: 5 });
  assert.deepEqual(c.award(L, 'star', [2]).golden, [], '＋ 더 주기는 칭찬이 아니에요');
  assert.equal(c.me(1).goldenLevel, 1);
});

test('되돌리기는 그 동작에서 생긴 황금·되찾기까지 함께 취소해요', () => {
  const c = setupClass();
  c.app.setRandom(() => 0);
  let L = c.start();
  c.award(L, 'extra', [1], { amount: 20 });
  c.award(L, 'extra', [1], { amount: 10 });
  c.student(1, 'donate', { n: 20 });
  c.penalty(L, [1], 2);
  c.end(L);
  L = c.start();
  const act = aid();
  const r = c.app.ok('award', { lesson: L, tool: 'star', students: [1], actionId: act }, { token: c.teacher });
  assert.equal(r.golden.length, 1);
  assert.deepEqual(r.recovered, [1]);
  assert.equal(c.me(1).unstamped, 30 - 20 - 2 + 1 + 3 + 1);
  c.app.ok('undo', { target: act }, { token: c.teacher });
  assert.equal(c.me(1).unstamped, 8);
  // 같은 actionId로 다시 보내도 두 번 들어가지 않아요.
  c.app.ok('award', { lesson: L, tool: 'star', students: [1], actionId: act }, { token: c.teacher });
  assert.equal(c.me(1).unstamped, 8);
});

test('같은 동작을 두 번 보내도 한 번만 저장돼요', () => {
  const c = setupClass();
  const L = c.start();
  const act = aid();
  c.app.ok('award', { lesson: L, tool: 'extra', amount: 2, students: [3], actionId: act }, { token: c.teacher });
  c.app.ok('award', { lesson: L, tool: 'extra', amount: 2, students: [3], actionId: act }, { token: c.teacher });
  assert.equal(c.me(3).unstamped, 2);
});

test('저금통은 아직 안 찍은 반죽으로만 기부하고, 단계와 보상 완료를 보여 줘요', () => {
  const c = setupClass({ settings: { piggyTiers: [{ at: 5, reward: '종례 스킵권' }, { at: 10, reward: '간식 파티' }] } });
  const L = c.start();
  c.award(L, 'extra', [1, 2], { amount: 4 });
  assert.equal(c.studentCall(1, 'donate', { n: 5 }).code, 'NOT_ENOUGH');
  c.student(1, 'donate', { n: 4 });
  const me = c.student(2, 'donate', { n: 2 });
  assert.equal(me.piggy.total, 6);
  assert.equal(me.piggy.tiers[0].reached, true);
  assert.equal(me.piggy.next.at, 10);
  const v = c.app.ok('rewardDone', { at: 5, actionId: aid() }, { token: c.admin });
  assert.equal(v.piggy.tiers[0].done, true);
  assert.equal(v.students.find((s) => s.no === 1).donated, 4);
});

test('친구 칭찬: 15글자 규칙, 같은 친구는 한 바퀴 뒤에, 행운 스탬프와 삭제', () => {
  const c = setupClass();
  const len = c.app.sandbox.praiseLen_;
  assert.equal(len('ㅋㅋㅋ 좋좋좋좋 abc 123!! 😀'), 7);
  assert.equal(len('좋좋'), 2);
  assert.equal(len('너는 정말 친절하고 착한 친구야 고마워'), 16);
  assert.equal(c.studentCall(1, 'sendPraise', { to: 2, text: 'ㅋㅋㅋㅋㅋㅋㅋㅋ 최고최고' }).code, 'SHORT');
  const text = '발표할 때 목소리가 크고 또박또박해서 좋았어';
  c.app.setRandom(() => 0);
  let me = c.student(1, 'sendPraise', { to: 2, text });
  assert.equal(me.lucky, true);
  assert.equal(me.unstamped, 1);
  assert.equal(c.studentCall(1, 'sendPraise', { to: 2, text }).code, 'ROUND');
  c.app.setRandom(() => 0.99);
  [3, 4].forEach((to) => c.student(1, 'sendPraise', { to, text }));
  me = c.student(1, 'sendPraise', { to: 5, text });
  assert.equal(me.praiseRound.sent, 0, '모두에게 보내면 리셋돼요');
  me = c.student(1, 'sendPraise', { to: 2, text });
  assert.equal(me.praiseRound.sent, 1);
  assert.equal(c.me(2).praisesReceived[0].from, '김하늘');
  const first = c.adminView().praises.find((p) => p.lucky);
  c.app.ok('deletePraise', { id: first.id }, { token: c.admin });
  me = c.me(1);
  assert.equal(me.unstamped, 0, '지우면 그 칭찬으로 받은 행운 스탬프도 취소돼요');
  assert.equal(c.me(2).praisesReceived.length, 1);
});

test('규칙을 읽으면 표시되고, 규칙이 바뀌면 다시 읽어야 해요', () => {
  const c = setupClass();
  assert.equal(c.me(1).rulesRead, false);
  assert.equal(c.student(1, 'rulesRead').rulesRead, true);
  const v = c.adminView();
  c.app.ok('saveSettings', { settings: Object.assign({}, v.settings, { cells: { bung: 25, hop: 45 } }) }, { token: c.admin });
  assert.equal(c.me(1).rulesRead, false);
});

test('수업 마치기 요약과 60분 뒤 자동 잠금', () => {
  const c = setupClass();
  const L = c.start('과학', 4);
  c.app.setRandom(() => 0.99);
  c.award(L, 'star', [1, 2, 3]);
  c.award(L, 'mvp', [2]);
  c.penalty(L, [4], 2);
  const s = c.end(L).summary;
  assert.equal(s.star, 3);
  assert.equal(s.mvp, '이바다');
  assert.equal(s.minus, 2);
  assert.equal(c.app.call('award', { lesson: L, tool: 'raise', students: [1], actionId: aid() }, { token: c.teacher }).code, 'LESSON');
  const L2 = c.start('과학', 5);
  // 수업 시작 시각을 2시간 전으로 바꾸면 잠겨요.
  const sheet = c.app.ss.getSheetByName('기록');
  sheet.grid.forEach((row) => { if (row[2] === '수업시작' && String(row[5]).includes(L2)) row[1] = '2000-01-01 09:00:00'; });
  assert.equal(c.app.call('award', { lesson: L2, tool: 'star', students: [1], actionId: aid() }, { token: c.teacher }).code, 'LESSON');
  assert.equal(c.app.ok('padState', {}, { token: c.teacher }).lesson, null);
});

test('담임 화면: 현황, 교환권 출력 표시, 직접 더하기·빼기, 기록 취소', () => {
  const c = setupClass({ settings: { cells: { bung: 5, hop: 45 } } });
  c.stock([{ coupon: 'bung', flavor: '슈크림', stocked: 3 }]);
  const L = c.start();
  c.award(L, 'extra', [1], { amount: 5 });
  c.student(1, 'stamp', { coupon: 'bung', n: 5 });
  c.student(1, 'chooseFlavor', { coupon: 'bung', flavor: '슈크림' });
  let v = c.app.ok('markPrinted', { tickets: ['붕-001'], reprint: false, actionId: aid() }, { token: c.admin });
  assert.equal(v.tickets[0].printed, 1);
  v = c.app.ok('adjust', { no: 2, amount: 4, reason: '봉사', actionId: aid() }, { token: c.admin });
  assert.equal(v.students.find((s) => s.no === 2).unstamped, 4);
  const row = v.log.find((r) => r.type === '조정');
  v = c.app.ok('cancelEvent', { id: row.id }, { token: c.admin });
  assert.equal(v.students.find((s) => s.no === 2).unstamped, 0);
  assert.ok(v.log.find((r) => r.id === row.id).cancelled);
  assert.equal(v.prep.waiting['붕어빵 슈크림'], 1);
  assert.ok(v.projection);
});
