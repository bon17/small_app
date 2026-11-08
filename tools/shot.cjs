#!/usr/bin/env node
// 앱의 첫 화면을 찍어 shots/<id>.jpg 로 저장합니다.
//
//   node tools/shot.cjs                 사진이 아직 없는 앱만 찍기
//   node tools/shot.cjs --all           전부 다시 찍기
//   node tools/shot.cjs <id> [<id> …]   지정한 앱만 다시 찍기
//
// 필요한 것: Playwright
//   npm i -D playwright && npx playwright install chromium
//
// 앱을 열기만 하고 아무것도 누르지 않아요. 열었을 때 처음 보이는 화면이 사진이 됩니다.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'shots');

// apps.js 는 브라우저용(window.APPS = …)이라서 가짜 window 안에서 실행해 목록만 꺼냅니다.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'apps.js'), 'utf8'), sandbox);
const apps = sandbox.window.APPS || [];

const args = process.argv.slice(2);
const all = args.includes('--all');
const ids = args.filter((a) => !a.startsWith('--'));
const fileOf = (a) => path.join(root, a.shot || path.join('shots', a.id + '.jpg'));

const targets = apps.filter((a) => {
  if (ids.length) return ids.includes(a.id);
  return all || !fs.existsSync(fileOf(a));
});

(async () => {
  if (!targets.length) { console.log('찍을 앱이 없어요. (모두 사진이 있어요. 다시 찍으려면 --all)'); return; }
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  let failed = 0;
  for (const a of targets) {
    // 가로 1280 화면으로 열고, 0.75배로 줄여 960×600 사진으로 저장 (카드에 쓰기 충분하고 가벼워요)
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.75,
      locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    });
    const page = await ctx.newPage();
    const blocked = new Set();
    page.on('requestfailed', (r) => { try { blocked.add(new URL(r.url()).host); } catch (e) { /* 무시 */ } });
    try {
      await page.goto(a.url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1200); // 시작 애니메이션이 끝나길 잠깐 기다림
      // 개인정보(사람 이름 등)가 보이는 앱은 apps.js 의 hide 선택자에 해당하는 부분을 흐리게 가려서 찍음
      if (a.hide) await page.addStyleTag({ content: a.hide + '{filter:blur(9px)!important}' });
      const file = fileOf(a);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log('찍음  ' + a.id.padEnd(18) + kb + 'KB' + (blocked.size ? '   (못 불러온 주소: ' + [...blocked].join(', ') + ')' : ''));
    } catch (e) {
      failed++;
      console.log('실패  ' + a.id.padEnd(18) + String(e.message).split('\n')[0]);
    }
    await ctx.close();
  }
  await browser.close();
  if (failed) process.exitCode = 1;
})();
