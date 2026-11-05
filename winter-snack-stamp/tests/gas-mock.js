// Code.gs를 Node에서 그대로 돌리려고 SpreadsheetApp 등 Apps Script 서비스를 흉내 내요.
// 테스트 전용이에요. 실제 앱에는 들어가지 않아요.
'use strict';
process.env.TZ = 'Asia/Seoul';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

class Range {
  constructor(sheet, row, col, rows, cols) { Object.assign(this, { sheet, row, col, rows, cols }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      const line = [];
      for (let c = 0; c < this.cols; c++) {
        const v = (this.sheet.grid[this.row - 1 + r] || [])[this.col - 1 + c];
        line.push(v === undefined ? '' : v);
      }
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.rows || values.some((l) => l.length !== this.cols)) throw new Error('mock: setValues size mismatch');
    values.forEach((line, r) => line.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  clearContent() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.sheet.set(this.row + r, this.col + c, '');
    this.sheet.trim();
    return this;
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.grid = []; }
  set(row, col, v) {
    while (this.grid.length < row) this.grid.push([]);
    const line = this.grid[row - 1];
    while (line.length < col) line.push('');
    line[col - 1] = v;
  }
  trim() {
    while (this.grid.length && this.grid[this.grid.length - 1].every((v) => v === '' || v === undefined)) this.grid.pop();
  }
  getLastRow() { this.trim(); return this.grid.length; }
  getLastColumn() { return Math.max(0, ...this.grid.map((l) => l.length)); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = /^([A-Z]+):([A-Z]+)$/.exec(a);
      const c1 = colIndex(m[1]);
      return new Range(this, 1, c1, Math.max(1, this.grid.length), colIndex(m[2]) - c1 + 1);
    }
    return new Range(this, a, b, c || 1, d || 1);
  }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  setFrozenRows() { return this; }
}

class Spreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { this.sheets[n] = new Sheet(n); return this.sheets[n]; }
}

function pad(n, w = 2) { return String(n).padStart(w, '0'); }
function formatDate(d, tz, fmt) {
  return fmt.replace('yyyy', d.getFullYear()).replace('yy', pad(d.getFullYear() % 100)).replace('MM', pad(d.getMonth() + 1))
    .replace('dd', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
}

/** 새 시트와 함께 Code.gs를 불러와요. random을 바꿔 끼우면 황금·행운 뽑기를 정할 수 있어요. */
function loadApp(opts = {}) {
  const ss = new Spreadsheet();
  const cache = new Map();
  const rnd = { next: opts.random || (() => 0.99) };
  const MathMock = Object.create(Math);
  MathMock.random = () => rnd.next();
  const sandbox = {
    console,
    Math: MathMock,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }) },
    Utilities: { formatDate, getUuid: () => crypto.randomUUID() },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)), remove: (k) => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
    HtmlService: {
      createHtmlOutputFromFile: (name) => ({ getContent: () => fs.readFileSync(path.join(ROOT, name + '.html'), 'utf8') }),
      createHtmlOutput: (html) => {
        const o = { html, getContent: () => html, setTitle: () => o, addMetaTag: () => o };
        return o;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
  sandbox.setup();
  const app = {
    ss, sandbox, rnd,
    call(action, payload = {}, extra = {}) {
      const res = sandbox.api(Object.assign({ action, payload }, extra));
      return JSON.parse(JSON.stringify(res));
    },
    ok(action, payload, extra) {
      const res = app.call(action, payload, extra);
      if (!res.ok) throw new Error(action + ' failed: ' + res.code + ' ' + res.msg);
      return res.data;
    },
    log() { return sandbox.readLog_(); },
    setRandom(fn) { rnd.next = fn; },
    /** 수업 날짜를 며칠 전으로 바꿔요 (다음 날부터 열리는 되찾기 찬스 확인용). */
    backdateLesson(lessonId, days) {
      const d = new Date(Date.now() - days * 86400000);
      const date = formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
      ss.getSheetByName('기록').grid.forEach((row) => {
        if (row[2] !== '수업시작' || !String(row[5]).includes(lessonId)) return;
        const detail = JSON.parse(row[5]);
        detail.date = date;
        row[5] = JSON.stringify(detail);
        row[1] = date + String(row[1]).slice(10);
      });
    },
  };
  return app;
}

let seq = 0;
function aid() { seq += 1; return 'act' + seq + '_' + Math.random().toString(36).slice(2, 7); }

module.exports = { loadApp, aid };
