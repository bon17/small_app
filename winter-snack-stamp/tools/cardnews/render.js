// 교과 선생님 안내 카드뉴스를 PNG로 찍어요.
//   node tools/cardnews/render.js [출력 폴더]   (기본: poster/cardnews)
// cards.html 옆에 Jua.ttf가 있어야 해요(README.md). 카드 하나 = <section class="card"> 하나 = 1080×1350.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const here = __dirname;
  const out = path.resolve(process.argv[2] || path.join(here, '..', '..', 'poster', 'cardnews'));
  if (!fs.existsSync(path.join(here, 'Jua.ttf'))) { console.error('Jua.ttf가 없어요. README.md를 보고 받아 주세요.'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(here, 'cards.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const cards = await page.$$('section.card');
  for (let i = 0; i < cards.length; i++) {
    const file = path.join(out, 'card-' + (i + 1) + '.png');
    await cards[i].screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
