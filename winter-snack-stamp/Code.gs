/**
 * 🏮 우리 반 겨울 간식 포장마차 — 서버 (Google Apps Script)
 *
 * 구글시트의 [확장 프로그램 → Apps Script]에서 이 파일 내용을 Code.gs에 붙여 넣어요.
 * 모든 일은 '기록' 탭에 한 줄씩 쌓이고, 현재 상태는 기록을 처음부터 다시 계산해서 만들어요.
 * 그래서 취소는 줄을 지우지 않고 '취소' 칸에 Y만 표시해요.
 */

const TZ = 'Asia/Seoul';
const SHEET = { students: '학생', log: '기록', settings: '설정', stock: '재고' };
const LOG_HEAD = ['ID', '시각', '종류', '번호', '값', '세부', '취소', '묶음'];
const STUDENT_HEAD = ['번호', '이름', '개인 코드'];
const STOCK_HEAD = ['쿠폰', '맛', '입고 수량'];
const SETTINGS_HEAD = ['이름', '값'];

const T = {
  START: '수업시작', END: '수업끝', AWARD: '스탬프', PENALTY: '빼기', RECOVER: '되찾기', GOLDEN: '황금',
  STAMP: '찍기', FLAVOR: '맛선택', EXCHANGE: '교환', PRINT: '출력', DONATE: '기부', REWARD: '보상완료',
  PRAISE: '친구칭찬', LUCKY: '행운', ADJUST: '조정', RULES: '규칙읽음',
};
const COUPON_LABEL = { bung: '붕어빵', hop: '호빵' };
const TOOL_LABEL = { star: '⭐ 열심히', raise: '🙋 적극 참여', mvp: '👑 MVP', extra: '＋ 더 주기', ready: '🔔 수업 준비' };
const PRAISE_TOOLS = { star: true, raise: true, mvp: true };
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_TRIES = 5; // 한 기기에서 틀린 학생 코드를 이만큼 넣으면 10분 동안 막아요

function defaultSettings_() {
  return {
    className: '우리 반',
    teacherPin: '1234',
    adminPin: '0000',
    cells: { bung: 30, hop: 45 },
    mvpStamps: 2,
    flavors: { bung: ['슈크림', '팥'], hop: ['피자', '단팥', '야채', '고구마'] },
    golden: { step: 10, perStep: 1, max: 7, amount: 3 },
    luckyPct: 5,
    piggyTiers: [
      { at: 200, reward: '🏃 종례 스킵권' },
      { at: 400, reward: '🎉 역사 시간 1시간 간식 파티' },
    ],
    subjects: ['국어', '영어', '수학', '과학', '사회', '역사', '도덕', '기술·가정', '정보', '음악', '미술', '체육', '진로', '창체'],
    periods: [
      { n: 1, start: '09:00', end: '09:45' }, { n: 2, start: '09:55', end: '10:40' },
      { n: 3, start: '10:50', end: '11:35' }, { n: 4, start: '11:45', end: '12:30' },
      { n: 5, start: '13:30', end: '14:15' }, { n: 6, start: '14:25', end: '15:10' },
      { n: 7, start: '15:20', end: '16:05' },
    ],
    startDate: '',
    endDate: '',
    ticketValidDays: 7,
    lessonMinutes: 60,
    recoverBulk: false,
    praiseMinChars: 15,
  };
}

/* ───────────────────────── 웹앱 ───────────────────────── */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const view = p.s ? 'student' : (p.v === 'admin' ? 'admin' : (p.v === 'pad' ? 'pad' : 'home'));
  const url = serviceUrl_();
  rememberUrl_(url);
  const boot = { view: view, code: String(p.s || ''), url: url };
  // Apps Script는 HTML 파일을 읽을 때 /* 주석 */을 지워요. 그래서 자리 표시는 주석이 아니라 글자('__BOOT__')로 해요.
  const html = HtmlService.createHtmlOutputFromFile('Index').getContent()
    .replace("'__BOOT__'", JSON.stringify(boot).replace(/</g, '\\u003c'));
  return HtmlService.createHtmlOutput(html)
    .setTitle('우리 반 겨울 간식 포장마차')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏮 겨울간식 스탬프')
    .addItem('🔗 웹앱 주소 보기', 'showUrls')
    .addItem('처음 설정하기 (시트 만들기)', 'setup')
    .addToUi();
}

/** 시트 탭과 기본 설정을 만들어요. 여러 번 눌러도 이미 있는 내용은 그대로 둬요. */
function setup() {
  sheet_(SHEET.students, STUDENT_HEAD);
  const log = sheet_(SHEET.log, LOG_HEAD);
  log.getRange('A:H').setNumberFormat('@');
  const set = sheet_(SHEET.settings, SETTINGS_HEAD);
  const have = {};
  set.getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) have[r[0]] = true; });
  const defs = defaultSettings_();
  const add = Object.keys(defs).filter(function (k) { return !have[k]; }).map(function (k) { return [k, JSON.stringify(defs[k])]; });
  if (add.length) set.getRange(set.getLastRow() + 1, 1, add.length, 2).setNumberFormat('@').setValues(add);
  const stock = sheet_(SHEET.stock, STOCK_HEAD);
  if (stock.getLastRow() < 2) {
    const rows = [];
    Object.keys(defs.flavors).forEach(function (c) { defs.flavors[c].forEach(function (f) { rows.push([COUPON_LABEL[c], f, 0]); }); });
    stock.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  return '설정 완료';
}

/* ───────────────────────── API ───────────────────────── */

/** 화면에서 부르는 하나뿐인 입구예요. { ok, data } 또는 { ok:false, code, msg }를 돌려줘요. */
function api(req) {
  try {
    req = req || {};
    const h = HANDLERS[req.action];
    if (!h) throw err_('BAD', '알 수 없는 요청이에요.');
    return { ok: true, data: h(req, req.payload || {}) };
  } catch (e) {
    const m = String((e && e.message) || e);
    const hit = /^([A-Z_]+): ?([\s\S]*)$/.exec(m);
    return hit ? { ok: false, code: hit[1], msg: hit[2] } : { ok: false, code: 'ERROR', msg: m };
  }
}

const HANDLERS = {
  hello: function () { return { className: readSettings_().className }; },

  /* 교실 패드 (교과 선생님) */
  padPublic: function () {
    // 잠금 화면에 보이는 것만 (학급 이름, 저금통, 오늘의 MVP)
    const v = padView_(load_());
    return { className: v.className, piggy: v.piggy, todayMvp: v.todayMvp };
  },
  padLogin: function (req, p) { return { token: login_('teacher', p.pin) }; },
  padState: function (req) { auth_(req.token, 'teacher'); return padView_(load_()); },
  startLesson: function (req, p) {
    auth_(req.token, 'teacher');
    return withLock_(function () {
      const db = load_();
      if (!db.done[p.actionId]) {
        const cfg = db.settings;
        const subject = String(p.subject || '').slice(0, 20);
        if (!subject) throw err_('BAD', '과목을 골라 주세요.');
        const st = compute_(db);
        const act = activeLesson_(st, cfg);
        const rows = [];
        if (act) rows.push(row_(T.END, '', '', { lesson: act.id, auto: true }, p.actionId));
        const id = 'L' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + rand_(3);
        rows.push(row_(T.START, '', '', { lesson: id, period: Number(p.period) || 0, subject: subject, date: today_() }, p.actionId));
        append_(rows);
      }
      return padView_(load_());
    });
  },
  award: function (req, p) { auth_(req.token, 'teacher'); return withLock_(function () { return award_(p); }); },
  penalty: function (req, p) { auth_(req.token, 'teacher'); return withLock_(function () { return penalty_(p); }); },
  undo: function (req, p) {
    auth_(req.token, 'teacher');
    return withLock_(function () {
      cancelRows_(function (r) { return r.action === p.target && r.type !== T.START && r.type !== T.END; });
      return padView_(load_());
    });
  },
  endLesson: function (req, p) {
    auth_(req.token, 'teacher');
    return withLock_(function () {
      const db = load_();
      const st = compute_(db);
      const L = st.lessons[p.lesson];
      if (!L) throw err_('LESSON', '수업을 찾을 수 없어요.');
      if (!L.ended && !db.done[p.actionId]) append_([row_(T.END, '', '', { lesson: L.id }, p.actionId)]);
      return { summary: lessonSummary_(compute_(load_()), p.lesson), view: padView_(load_()) };
    });
  },

  /* 담임 관리 */
  adminLogin: function (req, p) { return { token: login_('admin', p.pin) }; },
  adminState: function (req) { auth_(req.token, 'admin'); return adminView_(load_()); },
  saveRoster: function (req, p) { auth_(req.token, 'admin'); return withLock_(function () { saveRoster_(p.rows || []); return adminView_(load_()); }); },
  saveSettings: function (req, p) { auth_(req.token, 'admin'); return withLock_(function () { saveSettings_(p.settings || {}); return adminView_(load_()); }); },
  setStock: function (req, p) { auth_(req.token, 'admin'); return withLock_(function () { saveStock_(p.items || []); return adminView_(load_()); }); },
  exchange: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      const t = compute_(db).tickets[p.ticket];
      if (!t) throw err_('BAD', '교환권을 찾을 수 없어요.');
      if (!t.exchanged && !db.done[p.actionId]) append_([row_(T.EXCHANGE, t.student, '', { ticket: t.no }, p.actionId)]);
      return adminView_(load_());
    });
  },
  markPrinted: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      const list = (p.tickets || []).map(String).filter(function (n) { return compute_(db).tickets[n]; });
      if (list.length && !db.done[p.actionId]) append_([row_(T.PRINT, '', list.length, { tickets: list, reprint: !!p.reprint }, p.actionId)]);
      return adminView_(load_());
    });
  },
  rewardDone: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      if (!db.done[p.actionId]) append_([row_(T.REWARD, '', Number(p.at) || 0, { at: Number(p.at) || 0 }, p.actionId)]);
      return adminView_(load_());
    });
  },
  deletePraise: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      const target = db.log.filter(function (r) { return r.id === p.id && r.type === T.PRAISE; })[0];
      if (target) cancelRows_(function (r) { return r.id === target.id || (target.action && r.action === target.action && r.type === T.LUCKY); });
      return adminView_(load_());
    });
  },
  cancelEvent: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      const target = db.log.filter(function (r) { return r.id === p.id; })[0];
      if (!target) throw err_('BAD', '기록을 찾을 수 없어요.');
      if (target.type === T.START || target.type === T.END || target.type === T.RULES) throw err_('BAD', '이 기록은 취소할 수 없어요.');
      cancelRows_(function (r) {
        if (r.id === target.id) return true;
        // 칭찬 스탬프를 취소하면 같은 순간에 같이 생긴 황금 붕어빵·되찾기도 함께 취소해요.
        return target.type === T.AWARD && target.action && r.action === target.action && r.no === target.no && (r.type === T.GOLDEN || r.type === T.RECOVER);
      });
      return adminView_(load_());
    });
  },
  adjust: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const db = load_();
      const no = Number(p.no);
      const amount = Math.round(Number(p.amount));
      if (!studentByNo_(db, no)) throw err_('BAD', '학생을 골라 주세요.');
      if (!amount || Math.abs(amount) > 100) throw err_('BAD', '개수를 1~100 사이로 넣어 주세요.');
      if (!db.done[p.actionId]) append_([row_(T.ADJUST, no, amount, { reason: String(p.reason || '').slice(0, 40) }, p.actionId)]);
      return adminView_(load_());
    });
  },
  regenCode: function (req, p) {
    auth_(req.token, 'admin');
    return withLock_(function () {
      const sh = sheet_(SHEET.students, STUDENT_HEAD);
      const vals = sh.getDataRange().getValues();
      const used = {};
      vals.forEach(function (r) { used[String(r[2])] = true; });
      for (let i = 1; i < vals.length; i++) if (Number(vals[i][0]) === Number(p.no)) sh.getRange(i + 1, 3).setValue(newCode_(used));
      return adminView_(load_());
    });
  },

  /* 학생 (개인 링크) */
  studentState: function (req) { const db = load_(); return studentView_(db, me_(db, req)); },
  stamp: function (req, p) {
    return withLock_(function () {
      const db = load_();
      const me = me_(db, req);
      if (!db.done[p.actionId]) {
        const cfg = db.settings;
        const s = compute_(db).students[me.no];
        const c = p.coupon === 'hop' ? 'hop' : 'bung';
        const cells = cfg.cells[c];
        const cp = s.coupons[c];
        if (cp.filled >= cells) throw err_('FULL', '쿠폰을 다 채웠어요. 먼저 맛을 골라 주세요.');
        let n = Math.floor(Number(p.n) || 0);
        if (n < 1) throw err_('BAD', '찍을 개수를 확인해 주세요.');
        n = Math.min(n, cells - cp.filled);
        if (s.unstamped < n) throw err_('NOT_ENOUGH', '반죽이 모자라요.');
        append_([row_(T.STAMP, me.no, n, { coupon: c }, p.actionId)]);
      }
      return studentView_(load_(), me);
    });
  },
  chooseFlavor: function (req, p) {
    return withLock_(function () {
      const db = load_();
      const me = me_(db, req);
      if (!db.done[p.actionId]) {
        const cfg = db.settings;
        const st = compute_(db);
        const c = p.coupon === 'hop' ? 'hop' : 'bung';
        if (st.students[me.no].coupons[c].filled < cfg.cells[c]) throw err_('BAD', '쿠폰을 아직 다 채우지 않았어요.');
        const flavor = String(p.flavor || '');
        if (cfg.flavors[c].indexOf(flavor) < 0) throw err_('BAD', '맛을 다시 골라 주세요.');
        const left = st.stock[c + '|' + flavor] ? st.stock[c + '|' + flavor].left : 0;
        if (left <= 0) throw err_('SOLDOUT', flavor + ' 맛이 방금 다 떨어졌어요. 다른 맛을 골라 주세요.');
        const ticket = (c === 'bung' ? '붕-' : '호-') + ('00' + (maxTicketSeq_(db.log, c) + 1)).slice(-3);
        append_([row_(T.FLAVOR, me.no, '', { coupon: c, flavor: flavor, ticket: ticket }, p.actionId)]);
      }
      return studentView_(load_(), me);
    });
  },
  donate: function (req, p) {
    return withLock_(function () {
      const db = load_();
      const me = me_(db, req);
      if (!db.done[p.actionId]) {
        const n = Math.floor(Number(p.n) || 0);
        const s = compute_(db).students[me.no];
        if (n < 1) throw err_('BAD', '기부할 개수를 확인해 주세요.');
        if (s.unstamped < n) throw err_('NOT_ENOUGH', '아직 안 찍은 반죽만 기부할 수 있어요.');
        append_([row_(T.DONATE, me.no, n, {}, p.actionId)]);
      }
      return studentView_(load_(), me);
    });
  },
  sendPraise: function (req, p) {
    return withLock_(function () {
      const db = load_();
      const me = me_(db, req);
      let lucky = false;
      if (!db.done[p.actionId]) {
        const cfg = db.settings;
        const st = compute_(db);
        const to = Number(p.to);
        if (to === me.no || !studentByNo_(db, to)) throw err_('BAD', '칭찬할 친구를 골라 주세요.');
        if (st.students[me.no].round[to]) throw err_('ROUND', '이번 바퀴에서는 이미 칭찬한 친구예요. 다른 친구를 골라 주세요.');
        const text = String(p.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (praiseLen_(text) < cfg.praiseMinChars) throw err_('SHORT', cfg.praiseMinChars + '글자 이상 써 주세요.');
        const praise = row_(T.PRAISE, me.no, '', { to: to, text: text }, p.actionId);
        const rows = [praise];
        if (Math.random() * 100 < Number(cfg.luckyPct)) { rows.push(row_(T.LUCKY, me.no, 1, { praise: praise[0] }, p.actionId)); lucky = true; }
        append_(rows);
      } else {
        lucky = db.log.some(function (r) { return r.action === p.actionId && r.type === T.LUCKY && !r.cancelled; });
      }
      const view = studentView_(load_(), me);
      view.lucky = lucky;
      return view;
    });
  },
  rulesRead: function (req, p) {
    return withLock_(function () {
      const db = load_();
      const me = me_(db, req);
      const version = rulesVersion_(db.settings);
      if (compute_(db).students[me.no].rulesVersion !== version) append_([row_(T.RULES, me.no, '', { version: version }, p.actionId)]);
      return studentView_(load_(), me);
    });
  },
};

/* ───────────────────────── 패드: 스탬프 주기·빼기 ───────────────────────── */

function award_(p) {
  const db = load_();
  const cfg = db.settings;
  const result = { applied: [], skipped: [], golden: [], recovered: [] };
  if (db.done[p.actionId]) {
    db.log.forEach(function (r) {
      if (r.action !== p.actionId || r.cancelled) return;
      if (r.type === T.AWARD) result.applied.push(r.no);
      if (r.type === T.GOLDEN) result.golden.push({ no: r.no, name: nameOf_(db, r.no), amount: r.amount });
      if (r.type === T.RECOVER) result.recovered.push(r.no);
    });
    result.view = padView_(db);
    return result;
  }
  const st = compute_(db);
  const L = lessonFor_(st, cfg, p.lesson);
  const tool = p.tool;
  if (!TOOL_LABEL[tool]) throw err_('BAD', '도구를 다시 골라 주세요.');
  let targets = (p.students || []).map(Number).filter(function (no) { return st.students[no]; });
  let amount = 1;
  if (tool === 'ready') {
    if (L.ready) throw err_('DONE', '이번 수업의 수업 준비 스탬프는 이미 줬어요.');
    targets = db.students.map(function (s) { return s.no; });
  } else if (tool === 'mvp') {
    if (L.mvp) throw err_('DONE', '이번 수업의 MVP는 이미 ' + nameOf_(db, L.mvp) + '예요.');
    if (targets.length !== 1) throw err_('BAD', 'MVP는 1명만 골라 주세요.');
    amount = Number(cfg.mvpStamps) || 2;
  } else if (tool === 'extra') {
    amount = Math.floor(Number(p.amount) || 0);
    if (amount < 1 || amount > 20) throw err_('BAD', '개수를 1~20 사이로 골라 주세요.');
  }
  if (!targets.length) throw err_('BAD', '학생을 먼저 골라 주세요.');
  const rows = [];
  targets.forEach(function (no) {
    const s = st.students[no];
    const mk = s.marks[L.id] || {};
    if ((tool === 'star' || tool === 'raise') && mk[tool]) { result.skipped.push(no); return; }
    rows.push(row_(T.AWARD, no, amount, { lesson: L.id, tool: tool, reason: String(p.reason || '').slice(0, 30) }, p.actionId));
    result.applied.push(no);
    if (!PRAISE_TOOLS[tool]) return;
    // 그 수업에서 칭찬을 처음 받을 때만 황금 붕어빵을 뽑아요. 확률은 기부한 개수로만 정해져요.
    if (!mk.praised) {
      const pct = goldenPct_(cfg, s.donated);
      if (pct > 0 && Math.random() * 100 < pct) {
        rows.push(row_(T.GOLDEN, no, cfg.golden.amount, { lesson: L.id, pct: pct }, p.actionId));
        result.golden.push({ no: no, name: s.name, amount: cfg.golden.amount });
      }
    }
    // 되찾기 찬스: 빼기를 당한 다음 날부터, 칭찬 1번에 빼기 1건씩 1개를 돌려받아요.
    const pen = s.penalties.filter(function (x) { return x.recoverable && !x.recovered && x.date < L.date; })[0];
    if (pen) {
      pen.recovered = true;
      rows.push(row_(T.RECOVER, no, 1, { lesson: L.id, penalty: pen.id }, p.actionId));
      result.recovered.push(no);
    }
  });
  if (rows.length) append_(rows);
  result.view = padView_(load_());
  return result;
}

function penalty_(p) {
  const db = load_();
  if (!db.done[p.actionId]) {
    const cfg = db.settings;
    const st = compute_(db);
    const L = lessonFor_(st, cfg, p.lesson);
    const amount = Math.floor(Number(p.amount) || 0);
    if (amount < 1 || amount > 20) throw err_('BAD', '개수를 1~20 사이로 골라 주세요.');
    const targets = (p.students || []).map(Number).filter(function (no) { return st.students[no]; });
    if (!targets.length) throw err_('BAD', '학생을 먼저 골라 주세요.');
    const bulk = !!p.bulk;
    const reason = bulk ? '전체' : String(p.reason || '기타').slice(0, 30);
    append_(targets.map(function (no) { return row_(T.PENALTY, no, amount, { lesson: L.id, reason: reason, bulk: bulk }, p.actionId); }));
  }
  return { view: padView_(load_()) };
}

function lessonFor_(st, cfg, id) {
  const L = activeLesson_(st, cfg);
  if (!L || L.id !== id) throw err_('LESSON', '수업이 끝났거나 잠겼어요. 수업을 다시 시작해 주세요.');
  return L;
}

/* ───────────────────────── 상태 계산 ───────────────────────── */

function blankStudent_(s) {
  return {
    no: s.no, name: s.name, code: s.code,
    unstamped: 0, received: 0, lost: 0, recovered: 0, donated: 0, golden: 0, lucky: 0,
    coupons: { bung: { filled: 0, last: -1, burnt: 0, burntAt: '' }, hop: { filled: 0, last: -1, burnt: 0, burntAt: '' } },
    tickets: [], penalties: [], marks: {}, sent: [], round: {}, rulesVersion: '', history: [], lastLoss: '',
  };
}

function compute_(db) {
  const cfg = db.settings;
  const students = {};
  db.students.forEach(function (s) { students[s.no] = blankStudent_(s); });
  const lessons = {};
  const lessonList = [];
  const tickets = {};
  const ticketList = [];
  const praises = [];
  const piggy = { total: 0, done: {} };

  function mark(s, lesson) { return s.marks[lesson] || (s.marks[lesson] = {}); }
  function gain(s, n) { s.unstamped += n; }
  function hist(s, e, text, amount) { s.history.push({ ts: e.ts, text: text, amount: amount }); }
  function subjectOf(d) { const L = lessons[d.lesson]; return L ? L.subject + ' · ' : ''; }

  db.log.forEach(function (e, i) {
    if (e.cancelled) return;
    const d = e.detail || {};
    const s = e.no === '' ? null : students[e.no];
    const L = d.lesson ? lessons[d.lesson] : null;
    switch (e.type) {
      case T.START:
        lessons[d.lesson] = { id: d.lesson, idx: lessonList.length, period: d.period, subject: d.subject, date: d.date || String(e.ts).slice(0, 10), ts: e.ts, ended: false, endTs: '', ready: false, mvp: null };
        lessonList.push(lessons[d.lesson]);
        break;
      case T.END:
        if (L) { L.ended = true; L.endTs = e.ts; }
        break;
      case T.AWARD: {
        if (!s) break;
        gain(s, e.amount); s.received += e.amount;
        const mk = mark(s, d.lesson);
        mk[d.tool] = (mk[d.tool] || 0) + e.amount;
        if (PRAISE_TOOLS[d.tool]) mk.praised = true;
        if (L && d.tool === 'ready') L.ready = true;
        if (L && d.tool === 'mvp') L.mvp = e.no;
        hist(s, e, subjectOf(d) + TOOL_LABEL[d.tool] + (d.reason ? ' (' + d.reason + ')' : ''), e.amount);
        break;
      }
      case T.GOLDEN:
        if (!s) break;
        gain(s, e.amount); s.received += e.amount; s.golden += e.amount;
        mark(s, d.lesson).golden = e.amount;
        hist(s, e, subjectOf(d) + '✨ 황금 붕어빵!', e.amount);
        break;
      case T.RECOVER:
        if (!s) break;
        gain(s, e.amount); s.recovered += e.amount;
        s.penalties.forEach(function (x) { if (x.id === d.penalty) x.recovered = true; });
        mark(s, d.lesson).recover = true;
        hist(s, e, subjectOf(d) + '🔄 되찾기 찬스', e.amount);
        break;
      case T.PENALTY:
        if (!s) break;
        loseStamps_(s, e.amount, cfg, e.ts); s.lost += e.amount;
        s.penalties.push({ id: e.id, lesson: d.lesson, date: L ? L.date : String(e.ts).slice(0, 10), recoverable: !d.bulk || !!cfg.recoverBulk, recovered: false });
        mark(s, d.lesson).minus = (mark(s, d.lesson).minus || 0) + e.amount;
        hist(s, e, subjectOf(d) + '➖ 빼기 (' + (d.reason || '기타') + ')', -e.amount);
        break;
      case T.ADJUST:
        if (!s) break;
        if (e.amount > 0) { gain(s, e.amount); s.received += e.amount; } else { loseStamps_(s, -e.amount, cfg, e.ts); s.lost += -e.amount; }
        hist(s, e, '담임 선생님 ' + (e.amount > 0 ? '더하기' : '빼기') + (d.reason ? ' (' + d.reason + ')' : ''), e.amount);
        break;
      case T.STAMP: {
        if (!s) break;
        const c = d.coupon === 'hop' ? 'hop' : 'bung';
        s.unstamped -= e.amount; s.coupons[c].filled += e.amount; s.coupons[c].last = i;
        break;
      }
      case T.FLAVOR: {
        if (!s) break;
        const c = d.coupon === 'hop' ? 'hop' : 'bung';
        s.coupons[c].filled = Math.max(0, s.coupons[c].filled - cfg.cells[c]);
        const t = { no: d.ticket, student: e.no, name: s.name, coupon: c, flavor: d.flavor, ts: e.ts, date: String(e.ts).slice(0, 10), exchanged: false, exchangedTs: '', printed: 0, reprinted: 0 };
        tickets[t.no] = t; ticketList.push(t); s.tickets.push(t);
        hist(s, e, '🎫 ' + d.flavor + ' ' + COUPON_LABEL[c] + ' 교환권 (' + d.ticket + ')', 0);
        break;
      }
      case T.EXCHANGE:
        if (tickets[d.ticket]) { tickets[d.ticket].exchanged = true; tickets[d.ticket].exchangedTs = e.ts; }
        break;
      case T.PRINT:
        (d.tickets || []).forEach(function (no) { if (tickets[no]) { tickets[no].printed++; if (d.reprint) tickets[no].reprinted++; } });
        break;
      case T.DONATE:
        if (!s) break;
        s.unstamped -= e.amount; s.donated += e.amount; piggy.total += e.amount;
        hist(s, e, '🐷 저금통에 기부', -e.amount);
        break;
      case T.REWARD:
        piggy.done[Number(d.at)] = e.ts;
        break;
      case T.PRAISE:
        if (!s) break;
        praises.push({ id: e.id, from: e.no, to: Number(d.to), text: d.text, ts: e.ts, lucky: false });
        s.sent.push(Number(d.to));
        break;
      case T.LUCKY:
        if (!s) break;
        gain(s, e.amount); s.received += e.amount; s.lucky += e.amount;
        praises.forEach(function (x) { if (x.id === d.praise) x.lucky = true; });
        hist(s, e, '🍀 행운 스탬프', e.amount);
        break;
      case T.RULES:
        if (s) s.rulesVersion = d.version;
        break;
    }
  });

  // 친구 칭찬 바퀴: 반 친구 모두에게 한 번씩 보내면 처음부터 다시 보낼 수 있어요.
  const roster = db.students.map(function (x) { return x.no; });
  Object.keys(students).forEach(function (k) {
    const s = students[k];
    const mates = roster.filter(function (no) { return no !== s.no; });
    let round = {};
    s.sent.forEach(function (to) {
      round[to] = true;
      if (mates.every(function (no) { return round[no]; })) round = {};
    });
    s.round = round;
  });

  // 재고: 입고 수량 − (교환을 기다리는 예약 + 교환 완료)
  const stock = {};
  Object.keys(cfg.flavors).forEach(function (c) {
    cfg.flavors[c].forEach(function (f) { stock[c + '|' + f] = { coupon: c, flavor: f, stocked: db.stock[c + '|' + f] || 0, reserved: 0, exchanged: 0, left: 0 }; });
  });
  ticketList.forEach(function (t) {
    const k = t.coupon + '|' + t.flavor;
    if (!stock[k]) stock[k] = { coupon: t.coupon, flavor: t.flavor, stocked: db.stock[k] || 0, reserved: 0, exchanged: 0, left: 0 };
    if (t.exchanged) stock[k].exchanged++; else stock[k].reserved++;
  });
  Object.keys(stock).forEach(function (k) { const x = stock[k]; x.left = x.stocked - x.reserved - x.exchanged; });

  return { students: students, lessons: lessons, lessonList: lessonList, tickets: tickets, ticketList: ticketList, praises: praises, piggy: piggy, stock: stock };
}

/** 빠지는 순서: 아직 안 찍은 반죽 → 쿠폰에 붙인 스티커(가장 최근에 찍은 쿠폰부터) → 그래도 없으면 마이너스. 다 채운 쿠폰은 지켜요. */
function loseStamps_(s, k, cfg, ts) {
  let r = k;
  const take = Math.min(Math.max(s.unstamped, 0), r);
  s.unstamped -= take; r -= take;
  while (r > 0) {
    const open = ['bung', 'hop'].filter(function (c) { return s.coupons[c].filled > 0 && s.coupons[c].filled < cfg.cells[c]; })
      .sort(function (a, b) { return s.coupons[b].last - s.coupons[a].last; });
    if (!open.length) break;
    const cp = s.coupons[open[0]];
    const t = Math.min(cp.filled, r);
    cp.filled -= t; cp.burnt += t; cp.burntAt = ts; r -= t;
  }
  s.unstamped -= r;
  s.lastLoss = ts;
}

/** 되찾기 찬스: ready = 오늘 칭찬받으면 돌려받을 수 있는 빼기 수, waiting = 내일부터 열리는 빼기 수 */
function recoverState_(s, today) {
  const open = s.penalties.filter(function (x) { return x.recoverable && !x.recovered; });
  return {
    ready: open.filter(function (x) { return x.date < today; }).length,
    waiting: open.filter(function (x) { return x.date >= today; }).length,
  };
}

function activeLesson_(st, cfg) {
  const now = new Date().getTime();
  for (let i = st.lessonList.length - 1; i >= 0; i--) {
    const L = st.lessonList[i];
    if (L.ended) continue;
    if (now - parseTs_(L.ts).getTime() < Number(cfg.lessonMinutes || 60) * 60000) return L;
  }
  return null;
}

function goldenPct_(cfg, donated) {
  const g = cfg.golden;
  return Math.max(0, Math.min(Number(g.max), Math.floor(donated / Number(g.step)) * Number(g.perStep)));
}

function goldenLevel_(cfg, donated) {
  const g = cfg.golden;
  return Math.max(0, Math.min(Math.floor(Number(g.max) / Number(g.perStep)), Math.floor(donated / Number(g.step))));
}

/** 칭찬 글자 수: 완성된 한글·영어·숫자만 세요. 같은 글자가 3번 이상 이어지면 1글자로 세요. */
function praiseLen_(text) {
  let n = 0, prev = '', run = 0;
  Array.from(String(text || '')).forEach(function (ch) {
    if (!/[가-힣A-Za-z0-9]/.test(ch)) { prev = ''; run = 0; return; }
    if (ch === prev) { run++; if (run === 2) n++; else if (run === 3) n--; }
    else { prev = ch; run = 1; n++; }
  });
  return n;
}

function rulesVersion_(cfg) {
  return hash_(JSON.stringify([cfg.cells, cfg.mvpStamps, cfg.flavors, cfg.piggyTiers, cfg.praiseMinChars, cfg.golden.amount]));
}

function maxTicketSeq_(log, c) {
  const prefix = c === 'bung' ? '붕-' : '호-';
  let max = 0;
  log.forEach(function (r) {
    if (r.type !== T.FLAVOR || !r.detail || !r.detail.ticket) return;
    const t = String(r.detail.ticket);
    if (t.indexOf(prefix) === 0) max = Math.max(max, Number(t.slice(prefix.length)) || 0);
  });
  return max;
}

/* ───────────────────────── 화면별 데이터 ───────────────────────── */

function piggyView_(cfg, st) {
  const tiers = (cfg.piggyTiers || []).map(function (t) {
    return { at: Number(t.at), reward: t.reward, reached: st.piggy.total >= Number(t.at), done: !!st.piggy.done[Number(t.at)] };
  });
  const next = tiers.filter(function (t) { return !t.reached; })[0] || null;
  return { total: st.piggy.total, tiers: tiers, next: next };
}

function padView_(db) {
  const cfg = db.settings;
  const st = compute_(db);
  const L = activeLesson_(st, cfg);
  const marks = {};
  if (L) Object.keys(st.students).forEach(function (no) { marks[no] = st.students[no].marks[L.id] || {}; });
  const today = today_();
  const mvps = st.lessonList.filter(function (x) { return x.date === today && x.mvp; })
    .map(function (x) { return { name: nameOf_(db, x.mvp), subject: x.subject, period: x.period }; });
  return {
    className: cfg.className,
    students: db.students.map(function (s) { return { no: s.no, name: s.name }; }),
    lesson: L ? { id: L.id, period: L.period, subject: L.subject, ts: L.ts, ready: L.ready, mvp: L.mvp, endsAt: parseTs_(L.ts).getTime() + Number(cfg.lessonMinutes) * 60000 } : null,
    marks: marks,
    recoverable: db.students.filter(function (s) { return recoverState_(st.students[s.no], today).ready > 0; }).map(function (s) { return s.no; }),
    piggy: piggyView_(cfg, st),
    todayMvp: mvps,
    subjects: cfg.subjects,
    periods: cfg.periods,
    mvpStamps: cfg.mvpStamps,
    goldenAmount: cfg.golden.amount,
    serverNow: new Date().getTime(),
  };
}

function lessonSummary_(st, id) {
  const L = st.lessons[id];
  const out = { subject: L ? L.subject : '', period: L ? L.period : 0, star: 0, raise: 0, mvp: '', extra: 0, ready: L ? L.ready : false, minus: 0, minusStudents: 0, golden: [], total: 0 };
  Object.keys(st.students).forEach(function (no) {
    const s = st.students[no];
    const m = s.marks[id];
    if (!m) return;
    if (m.star) out.star++;
    if (m.raise) out.raise++;
    if (m.mvp) out.mvp = s.name;
    if (m.extra) out.extra += m.extra;
    if (m.minus) { out.minus += m.minus; out.minusStudents++; }
    if (m.golden) out.golden.push(s.name);
    out.total += (m.star || 0) + (m.raise || 0) + (m.mvp || 0) + (m.extra || 0) + (m.ready || 0) + (m.golden || 0);
  });
  return out;
}

function studentView_(db, me) {
  const cfg = db.settings;
  const st = compute_(db);
  const s = st.students[me.no];
  const validUntil = ticketValidUntil_(cfg);
  const flavors = {};
  Object.keys(cfg.flavors).forEach(function (c) {
    flavors[c] = cfg.flavors[c].map(function (f) {
      const x = st.stock[c + '|' + f];
      return { name: f, left: x ? Math.max(0, x.left) : 0 };
    });
  });
  const names = {};
  db.students.forEach(function (x) { names[x.no] = x.name; });
  const mates = db.students.filter(function (x) { return x.no !== me.no; });
  const version = rulesVersion_(cfg);
  return {
    me: { no: me.no, name: me.name },
    soldOutAll: soldOutAll_(st),
    className: cfg.className,
    unstamped: s.unstamped,
    coupons: {
      bung: { filled: s.coupons.bung.filled, cells: cfg.cells.bung, burnt: s.coupons.bung.burnt, burntAt: s.coupons.bung.burntAt },
      hop: { filled: s.coupons.hop.filled, cells: cfg.cells.hop, burnt: s.coupons.hop.burnt, burntAt: s.coupons.hop.burntAt },
    },
    tickets: s.tickets.map(function (t) { return ticketOut_(t, validUntil); }),
    donated: s.donated,
    goldenLevel: goldenLevel_(cfg, s.donated),
    piggy: piggyView_(cfg, st),
    flavors: flavors,
    classmates: mates.map(function (x) { return { no: x.no, name: x.name, sent: !!s.round[x.no] }; }),
    praiseRound: { sent: Object.keys(s.round).length, total: mates.length },
    praisesReceived: st.praises.filter(function (x) { return x.to === me.no; }).reverse()
      .map(function (x) { return { id: x.id, from: names[x.from] || '친구', text: x.text, ts: x.ts }; }),
    praisesSent: st.praises.filter(function (x) { return x.from === me.no; }).reverse()
      .map(function (x) { return { to: names[x.to] || '친구', text: x.text, ts: x.ts }; }),
    history: s.history.slice(-20).reverse(),
    rules: {
      cells: cfg.cells, mvpStamps: cfg.mvpStamps, flavors: cfg.flavors, piggyTiers: cfg.piggyTiers,
      praiseMinChars: cfg.praiseMinChars, goldenAmount: cfg.golden.amount, startDate: cfg.startDate, endDate: cfg.endDate,
      validUntil: validUntil,
    },
    rulesVersion: version,
    rulesRead: s.rulesVersion === version,
    received: s.received,
    lost: s.lost,
    recover: recoverState_(s, today_()),
    today: today_(),
    validUntil: validUntil,
  };
}

/** 사 온 간식이 있는데 모든 맛이 다 떨어졌으면 true (이벤트가 일찍 끝날 수 있다는 안내용) */
function soldOutAll_(st) {
  const list = Object.keys(st.stock).map(function (k) { return st.stock[k]; });
  return list.some(function (x) { return x.stocked > 0; }) && list.every(function (x) { return x.left <= 0; });
}

function ticketOut_(t, validUntil) {
  return { no: t.no, student: t.student, name: t.name, coupon: t.coupon, flavor: t.flavor, date: t.date, exchanged: t.exchanged, exchangedTs: t.exchangedTs, printed: t.printed, reprinted: t.reprinted, validUntil: validUntil };
}

function ticketValidUntil_(cfg) {
  if (!cfg.endDate) return '';
  const d = parseTs_(cfg.endDate + ' 00:00:00');
  d.setDate(d.getDate() + Number(cfg.ticketValidDays || 0));
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function adminView_(db) {
  const cfg = db.settings;
  const st = compute_(db);
  const url = serviceUrl_();
  const version = rulesVersion_(cfg);
  const validUntil = ticketValidUntil_(cfg);
  const students = db.students.map(function (x) {
    const s = st.students[x.no];
    return {
      no: x.no, name: x.name, code: x.code, link: url ? url + '?s=' + x.code : '',
      unstamped: s.unstamped, bung: s.coupons.bung.filled, hop: s.coupons.hop.filled,
      ticketsWaiting: s.tickets.filter(function (t) { return !t.exchanged; }).length,
      ticketsDone: s.tickets.filter(function (t) { return t.exchanged; }).length,
      donated: s.donated, received: s.received, lost: s.lost, recovered: s.recovered, golden: s.golden, lucky: s.lucky,
      goldenPct: goldenPct_(cfg, s.donated), rulesRead: s.rulesVersion === version,
    };
  });
  const names = {};
  db.students.forEach(function (x) { names[x.no] = x.name; });
  const stock = Object.keys(st.stock).map(function (k) { return st.stock[k]; });
  const waiting = {};
  st.ticketList.forEach(function (t) { if (!t.exchanged) { const k = COUPON_LABEL[t.coupon] + ' ' + t.flavor; waiting[k] = (waiting[k] || 0) + 1; } });
  const nearly = { bung: 0, hop: 0 };
  students.forEach(function (s) {
    if (s.bung >= cfg.cells.bung * 0.8) nearly.bung++;
    if (s.hop >= cfg.cells.hop * 0.8) nearly.hop++;
  });
  const recentLog = db.log.slice(-400).reverse().map(function (r) {
    return { id: r.id, ts: r.ts, type: r.type, no: r.no, name: r.no === '' ? '' : (names[r.no] || ''), amount: r.amount, text: logText_(r, st), cancelled: r.cancelled };
  });
  return {
    className: cfg.className,
    settings: cfg,
    url: url,
    students: students,
    tickets: st.ticketList.map(function (t) { return ticketOut_(t, validUntil); }).reverse(),
    stock: stock,
    praises: st.praises.slice().reverse().map(function (x) { return { id: x.id, from: names[x.from] || '', to: names[x.to] || '', text: x.text, ts: x.ts, lucky: x.lucky }; }),
    log: recentLog,
    piggy: piggyView_(cfg, st),
    prep: { waiting: waiting, nearly: nearly },
    soldOutAll: soldOutAll_(st),
    lessons: lessonStats_(st),
    projection: projection_(cfg, st, db),
    rulesVersion: version,
    validUntil: validUntil,
    today: today_(),
  };
}

function logText_(r, st) {
  const d = r.detail || {};
  const L = d.lesson ? st.lessons[d.lesson] : null;
  const where = L ? L.period + '교시 ' + L.subject + ' · ' : '';
  switch (r.type) {
    case T.START: return (d.period ? d.period + '교시 ' : '') + d.subject + ' 수업 시작';
    case T.END: return '수업 마침' + (d.auto ? ' (다음 수업 시작으로 자동)' : '');
    case T.AWARD: return where + (TOOL_LABEL[d.tool] || d.tool) + ' +' + r.amount + (d.reason ? ' (' + d.reason + ')' : '');
    case T.PENALTY: return where + '빼기 −' + r.amount + ' (' + (d.reason || '') + ')';
    case T.RECOVER: return where + '되찾기 +1';
    case T.GOLDEN: return where + '황금 붕어빵 +' + r.amount + ' (확률 ' + d.pct + '%)';
    case T.STAMP: return COUPON_LABEL[d.coupon] + ' 쿠폰에 ' + r.amount + '개 찍음';
    case T.FLAVOR: return d.flavor + ' ' + COUPON_LABEL[d.coupon] + ' 선택 → ' + d.ticket;
    case T.EXCHANGE: return d.ticket + ' 교환 완료';
    case T.PRINT: return (d.reprint ? '다시 출력 ' : '출력 ') + (d.tickets || []).join(', ');
    case T.DONATE: return '저금통 기부 ' + r.amount + '개';
    case T.REWARD: return '저금통 ' + d.at + '개 보상 완료';
    case T.PRAISE: return '친구 칭찬 → ' + ((st.students[d.to] || {}).name || '') + ': ' + d.text;
    case T.LUCKY: return '행운 스탬프 +1';
    case T.ADJUST: return '직접 ' + (r.amount > 0 ? '+' : '') + r.amount + (d.reason ? ' (' + d.reason + ')' : '');
    case T.RULES: return '규칙 읽음';
  }
  return r.type;
}

function lessonStats_(st) {
  const out = { total: 0, ready: 0, week: { total: 0, ready: 0 }, bySubject: {}, byWeekday: {} };
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  st.lessonList.forEach(function (L) {
    out.total++;
    if (L.ready) out.ready++;
    const d = parseTs_(L.date + ' 00:00:00');
    if (d >= monday) { out.week.total++; if (L.ready) out.week.ready++; }
    const sub = out.bySubject[L.subject] || (out.bySubject[L.subject] = { total: 0, ready: 0 });
    sub.total++; if (L.ready) sub.ready++;
    const wd = days[d.getDay()];
    const w = out.byWeekday[wd] || (out.byWeekday[wd] = { total: 0, ready: 0 });
    w.total++; if (L.ready) w.ready++;
  });
  return out;
}

/** 1주차 점검: 지금까지 받은 속도로 활동이 끝날 때 몇 개를 받을지 어림해요. */
function projection_(cfg, st, db) {
  const first = cfg.startDate || (st.lessonList[0] ? st.lessonList[0].date : '');
  if (!first) return null;
  const start = parseTs_(first + ' 00:00:00');
  const end = cfg.endDate ? parseTs_(cfg.endDate + ' 00:00:00') : new Date(start.getTime() + 27 * 86400000);
  const today = parseTs_(today_() + ' 00:00:00');
  const elapsed = Math.max(1, Math.round((Math.min(today, end) - start) / 86400000) + 1);
  const total = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const list = db.students.map(function (x) { return st.students[x.no].received; });
  if (!list.length) return null;
  const rate = total / elapsed;
  const max = Math.round(Math.max.apply(null, list) * rate);
  const avg = Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length * rate);
  return { elapsedDays: elapsed, totalDays: total, max: max, avg: avg, cells: cfg.cells };
}

/* ───────────────────────── 저장 ───────────────────────── */

function saveRoster_(rows) {
  const clean = [];
  const seen = {};
  rows.forEach(function (r) {
    const no = Math.floor(Number(r.no));
    const name = String(r.name || '').trim().slice(0, 20);
    if (!no || !name || seen[no]) return;
    seen[no] = true;
    clean.push({ no: no, name: name });
  });
  if (!clean.length) throw err_('BAD', '명단이 비어 있어요.');
  clean.sort(function (a, b) { return a.no - b.no; });
  const old = readStudents_();
  const byKey = {}, byNo = {};
  old.forEach(function (s) { byKey[s.no + '|' + s.name] = s.code; byNo[s.no] = s.code; });
  const sh = sheet_(SHEET.students, STUDENT_HEAD);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  // 같은 학생은 코드를 그대로 둬요. 예전 영어 섞인 코드는 이때 숫자 4자리로 바뀌어요.
  const used = {};
  const keep = function (c) { c = String(c || ''); if (!isCode_(c) || used[c]) return ''; used[c] = true; return c; };
  const values = clean.map(function (s) { return [s.no, s.name, keep(byKey[s.no + '|' + s.name] || byNo[s.no])]; });
  values.forEach(function (v) { if (!v[2]) v[2] = newCode_(used); });
  sh.getRange(2, 1, values.length, 3).setValues(values);
}

function saveSettings_(input) {
  const cur = readSettings_();
  const defs = defaultSettings_();
  const next = {};
  Object.keys(defs).forEach(function (k) { next[k] = input.hasOwnProperty(k) ? input[k] : cur[k]; });
  next.className = String(next.className || '우리 반').slice(0, 20);
  ['teacherPin', 'adminPin'].forEach(function (k) {
    next[k] = String(next[k] || '').replace(/\D/g, '').slice(0, 8);
    if (next[k].length < 4) throw err_('BAD', '비밀번호는 숫자 4자리 이상이에요.');
  });
  ['bung', 'hop'].forEach(function (c) {
    const n = Math.floor(Number(next.cells && next.cells[c]));
    if (!(n >= 5 && n <= 100)) throw err_('BAD', '쿠폰 칸 수는 5~100 사이로 넣어 주세요.');
    next.cells = Object.assign({}, next.cells, (function () { const o = {}; o[c] = n; return o; })());
    const fl = (next.flavors && next.flavors[c] || []).map(function (f) { return String(f).trim().slice(0, 10); }).filter(Boolean);
    if (!fl.length) throw err_('BAD', COUPON_LABEL[c] + ' 맛을 하나 이상 넣어 주세요.');
    next.flavors = Object.assign({}, next.flavors, (function () { const o = {}; o[c] = fl; return o; })());
  });
  next.mvpStamps = clampInt_(next.mvpStamps, 1, 10);
  next.luckyPct = Math.max(0, Math.min(100, Number(next.luckyPct) || 0));
  next.golden = {
    step: clampInt_(next.golden.step, 1, 1000), perStep: Math.max(0, Math.min(100, Number(next.golden.perStep) || 0)),
    max: Math.max(0, Math.min(100, Number(next.golden.max) || 0)), amount: clampInt_(next.golden.amount, 1, 20),
  };
  next.piggyTiers = (next.piggyTiers || []).map(function (t) { return { at: clampInt_(t.at, 1, 100000), reward: String(t.reward || '').slice(0, 40) }; })
    .filter(function (t) { return t.reward; }).sort(function (a, b) { return a.at - b.at; });
  next.subjects = (next.subjects || []).map(function (x) { return String(x).trim().slice(0, 12); }).filter(Boolean);
  if (!next.subjects.length) throw err_('BAD', '과목을 하나 이상 넣어 주세요.');
  next.periods = (next.periods || []).map(function (p, i) {
    return { n: clampInt_(p.n || i + 1, 1, 12), start: /^\d{2}:\d{2}$/.test(p.start) ? p.start : '', end: /^\d{2}:\d{2}$/.test(p.end) ? p.end : '' };
  }).filter(function (p) { return p.start && p.end; });
  ['startDate', 'endDate'].forEach(function (k) { next[k] = /^\d{4}-\d{2}-\d{2}$/.test(next[k]) ? next[k] : ''; });
  next.ticketValidDays = clampInt_(next.ticketValidDays, 0, 365);
  next.lessonMinutes = clampInt_(next.lessonMinutes, 10, 240);
  next.recoverBulk = !!next.recoverBulk;
  next.praiseMinChars = clampInt_(next.praiseMinChars, 1, 100);
  const sh = sheet_(SHEET.settings, SETTINGS_HEAD);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  const values = Object.keys(next).map(function (k) { return [k, JSON.stringify(next[k])]; });
  sh.getRange(2, 1, values.length, 2).setNumberFormat('@').setValues(values);
  // 새 맛이 생기면 재고 탭에도 줄을 만들어요.
  const stock = readStockRows_();
  const add = [];
  ['bung', 'hop'].forEach(function (c) {
    next.flavors[c].forEach(function (f) { if (!stock.some(function (r) { return r.coupon === c && r.flavor === f; })) add.push([COUPON_LABEL[c], f, 0]); });
  });
  if (add.length) { const st = sheet_(SHEET.stock, STOCK_HEAD); st.getRange(st.getLastRow() + 1, 1, add.length, 3).setValues(add); }
}

function saveStock_(items) {
  const rows = items.map(function (x) {
    const c = x.coupon === 'hop' ? 'hop' : 'bung';
    return [COUPON_LABEL[c], String(x.flavor || '').trim().slice(0, 10), clampInt_(x.stocked, 0, 10000)];
  }).filter(function (r) { return r[1]; });
  const sh = sheet_(SHEET.stock, STOCK_HEAD);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

/* ───────────────────────── 시트 읽기·쓰기 ───────────────────────── */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, head) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    if (head) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  }
  return sh;
}

function rowsOf_(name, head) {
  const sh = sheet_(name, head);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, head.length).getValues();
}

function readSettings_() {
  const cfg = defaultSettings_();
  rowsOf_(SHEET.settings, SETTINGS_HEAD).forEach(function (r) {
    const k = String(r[0] || '').trim();
    if (!k || !cfg.hasOwnProperty(k)) return;
    try { cfg[k] = JSON.parse(r[1]); } catch (e) { cfg[k] = r[1]; }
  });
  return cfg;
}

function readStudents_() {
  const sh = sheet_(SHEET.students, STUDENT_HEAD);
  const vals = rowsOf_(SHEET.students, STUDENT_HEAD);
  const out = [];
  const used = {};
  vals.forEach(function (r) { used[String(r[2] || '').trim()] = true; });
  vals.forEach(function (r, i) {
    const no = Math.floor(Number(r[0]));
    const name = String(r[1] || '').trim();
    if (!no || !name) return;
    let code = String(r[2] || '').trim();
    if (!code) { code = newCode_(used); sh.getRange(i + 2, 3).setValue(code); }
    out.push({ no: no, name: name, code: code });
  });
  out.sort(function (a, b) { return a.no - b.no; });
  return out;
}

function readStockRows_() {
  return rowsOf_(SHEET.stock, STOCK_HEAD).map(function (r) {
    return { coupon: String(r[0]).indexOf('호') >= 0 ? 'hop' : 'bung', flavor: String(r[1] || '').trim(), stocked: Math.max(0, Math.floor(Number(r[2]) || 0)) };
  }).filter(function (r) { return r.flavor; });
}

function readLog_() {
  return rowsOf_(SHEET.log, LOG_HEAD).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    let detail = {};
    if (r[5]) { try { detail = JSON.parse(r[5]); } catch (e) { detail = {}; } }
    return {
      id: String(r[0]), ts: tsString_(r[1]), type: String(r[2]), no: r[3] === '' ? '' : Number(r[3]),
      amount: Number(r[4]) || 0, detail: detail, cancelled: String(r[6]).trim() !== '', action: String(r[7] || ''),
    };
  });
}

function load_() {
  const settings = readSettings_();
  const students = readStudents_();
  const stock = {};
  readStockRows_().forEach(function (r) { stock[r.coupon + '|' + r.flavor] = (stock[r.coupon + '|' + r.flavor] || 0) + r.stocked; });
  const log = readLog_();
  const done = {};
  log.forEach(function (r) { if (r.action) done[r.action] = true; });
  return { settings: settings, students: students, stock: stock, log: log, done: done };
}

function row_(type, no, amount, detail, action) {
  return [rand_(10), now_(), type, no === '' || no == null ? '' : String(no), amount === '' || amount == null ? '' : String(amount),
    detail ? JSON.stringify(detail) : '', '', String(action || '')];
}

function append_(rows) {
  if (!rows.length) return;
  const sh = sheet_(SHEET.log, LOG_HEAD);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_HEAD.length).setNumberFormat('@').setValues(rows);
}

function cancelRows_(pred) {
  const sh = sheet_(SHEET.log, LOG_HEAD);
  const log = readLog_();
  log.forEach(function (r, i) {
    if (!r.cancelled && pred(r)) sh.getRange(i + 2, 7).setValue('Y');
  });
}

/* ───────────────────────── 인증·잠금 ───────────────────────── */

function login_(role, pin) {
  const cache = CacheService.getScriptCache();
  const key = 'fail:' + role;
  const fails = Number(cache.get(key) || 0);
  if (fails >= 5) throw err_('LOCKED', '비밀번호를 여러 번 틀렸어요. 5분 뒤에 다시 해 보세요.');
  const cfg = readSettings_();
  const right = role === 'admin' ? cfg.adminPin : cfg.teacherPin;
  if (String(pin || '') !== String(right)) {
    cache.put(key, String(fails + 1), 300);
    throw err_('PIN', '비밀번호가 달라요.' + (fails + 1 >= 3 ? ' (' + (5 - fails - 1) + '번 더 틀리면 5분 동안 잠겨요)' : ''));
  }
  cache.remove(key);
  const token = Utilities.getUuid();
  cache.put('tok:' + token, role, 21600);
  return token;
}

function auth_(token, role) {
  const got = token ? CacheService.getScriptCache().get('tok:' + token) : null;
  if (!got || (got !== role && !(role === 'teacher' && got === 'admin'))) throw err_('AUTH', '다시 로그인해 주세요.');
}

/**
 * 학생 코드(숫자 4자리)로 학생을 찾아요. 남의 코드를 이것저것 넣어 맞히지 못하게,
 * 한 기기(dev)에서 틀린 코드를 CODE_TRIES번 넣으면 10분 동안 막아요.
 */
function me_(db, req) {
  const code = String((req && req.code) || '').trim();
  const cache = CacheService.getScriptCache();
  const key = 'badcode:' + String((req && req.dev) || '-').slice(0, 40);
  const fails = Number(cache.get(key) || 0);
  if (fails >= CODE_TRIES) throw err_('LOCKED', '틀린 코드를 여러 번 넣어서 10분 동안 막혔어요. 담임 선생님께 받은 내 코드를 확인해 주세요.');
  const me = db.students.filter(function (s) { return s.code === code; })[0];
  if (!me) {
    cache.put(key, String(fails + 1), 600);
    throw err_('CODE', '코드가 맞지 않아요. 담임 선생님께 받은 내 코드(숫자 4자리)나 QR로 들어와 주세요.');
  }
  return me;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw err_('BUSY', '지금 다른 저장이 많아요. 잠시 뒤에 다시 눌러 주세요.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ───────────────────────── 작은 도구 ───────────────────────── */

function err_(code, msg) { return new Error(code + ': ' + msg); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
/**
 * 웹앱 주소(…/exec). 시트 메뉴처럼 웹앱 밖에서 부르면 구글이 선생님만 열 수 있는 …/dev 주소를 줄 때가 있어요.
 * 그래서 웹앱이 열릴 때 본 /exec 주소를 저장해 두고(rememberUrl_), /exec가 아니면 저장한 주소를 써요.
 */
function serviceUrl_() {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  if (/\/exec$/.test(url)) return url;
  try { return PropertiesService.getScriptProperties().getProperty('webAppUrl') || url; } catch (e) { return url; }
}
function rememberUrl_(url) {
  if (!/\/exec$/.test(url)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('webAppUrl') !== url) props.setProperty('webAppUrl', url);
  } catch (e) {}
}

/** 시트 메뉴 "🔗 웹앱 주소 보기": 교실 패드·담임 관리·첫 화면 주소를 보여 줘요. */
function showUrls() {
  const url = serviceUrl_();
  const h = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  const row = function (label, link) {
    return '<p><b>' + label + '</b><br><input readonly value="' + h(link) + '" onclick="this.select()"> <a href="' + h(link) + '" target="_blank">열기</a></p>';
  };
  const ok = /\/exec$/.test(url);
  const body = ok
    ? row('🏫 교실 패드 (교과 선생님)', url + '?v=pad') + row('📒 담임 관리', url + '?v=admin') + row('🏮 첫 화면', url) +
      '<p class="hint">주소 칸을 누르면 전체가 골라져요. Ctrl+C로 복사해요.<br>학생 개인 링크·QR은 담임 관리 → 명단·QR에 있어요.</p>'
    : '<p>아직 웹앱 주소를 몰라요.</p><p class="hint">배포한 웹앱 주소(…/exec)를 브라우저에서 한 번 열고 나서 다시 눌러 주세요.<br>' +
      '배포 전이라면 Apps Script 편집기에서 <b>배포 → 새 배포 → 웹 앱</b>을 먼저 해요.</p>';
  const html = '<style>body{font-family:sans-serif;font-size:14px;color:#4A2E1E;margin:4px}p{margin:0 0 14px;line-height:1.5}' +
    'input{width:80%;padding:6px;font-size:13px;border:1px solid #DCC8AA;border-radius:6px}.hint{color:#7A5A45;font-size:13px}</style>' + body;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(ok ? 330 : 170), '🔗 웹앱 주소');
}
function studentByNo_(db, no) { return db.students.filter(function (s) { return s.no === Number(no); })[0] || null; }
function nameOf_(db, no) { const s = studentByNo_(db, no); return s ? s.name : ''; }
function clampInt_(v, lo, hi) { const n = Math.floor(Number(v)); return isNaN(n) ? lo : Math.max(lo, Math.min(hi, n)); }

/** 기록 ID·개인 코드용 무작위 글자. 황금·행운 뽑기(Math.random)와 따로 써요. */
function rand_(n) {
  let s = '';
  while (s.length < n) {
    const hex = Utilities.getUuid().replace(/-/g, '');
    for (let i = 0; i + 1 < hex.length && s.length < n; i += 2) {
      if (i === 12) continue; // UUID의 버전 자리는 늘 같은 값이라 건너뛰어요.
      s += CODE_CHARS.charAt(parseInt(hex.substr(i, 2), 16) % CODE_CHARS.length);
    }
  }
  return s;
}

/**
 * 학생 개인 코드: 1000~9999 숫자 4자리. 앞자리가 0이 아니어야 시트가 숫자로 바꿔 저장해도 그대로예요.
 * used(이미 쓰는 코드 모음)와 겹치지 않게 만들고, 만든 코드도 used에 넣어요.
 */
function newCode_(used) {
  used = used || {};
  for (let i = 0; i < 500; i++) {
    const code = String(1000 + parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 9000);
    if (!used[code]) { used[code] = true; return code; }
  }
  throw err_('BAD', '코드를 만들 수 없어요. 다시 눌러 주세요.');
}
function isCode_(c) { return /^[1-9]\d{3}$/.test(String(c || '')); }

function hash_(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** 시트에 Date로 바뀐 칸이 있어도 'yyyy-MM-dd HH:mm:ss' 글자로 맞춰요. */
function tsString_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  return String(v || '');
}

/** 'yyyy-MM-dd HH:mm:ss'를 서울 시간 기준 Date로 읽어요. (appsscript.json의 timeZone이 Asia/Seoul이어야 해요) */
function parseTs_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s || ''));
  if (!m) return new Date(0);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
}
