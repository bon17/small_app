// 교과 선생님 안내 카드뉴스를 PNG(와 PDF)로 찍어요.
//   node tools/cardnews/render.js [출력 폴더] [--count=N] [--pdf=파일.pdf]
//   - 출력 폴더 기본: poster/cardnews
//   - --count=N: 앞에서 N장만 찍고 쪽 번호를 "i / N"으로 바꿔요 (예: 마지막 장 빼고 6장)
//   - --pdf=파일: 찍은 카드를 한 쪽에 한 장씩 PDF로도 묶어요 (쪽 크기 = 카드 비율, 150dpi)
// cards.html 옆에 Jua.ttf가 있어야 해요(README.md). 카드 하나 = <section class="card"> 하나 = 1080×1350.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

(async () => {
  const here = __dirname;
  const args = process.argv.slice(2);
  const opt = (k) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
  const outArg = args.find((x) => !x.startsWith('--'));
  const out = path.resolve(outArg || path.join(here, '..', '..', 'poster', 'cardnews'));
  const count = Number(opt('count')) || 0;
  const pdf = opt('pdf') ? path.resolve(opt('pdf')) : '';
  if (!fs.existsSync(path.join(here, 'Jua.ttf'))) { console.error('Jua.ttf가 없어요. README.md를 보고 받아 주세요.'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(here, 'cards.html'));
  await page.evaluate(() => document.fonts.ready);
  if (count) {
    await page.evaluate((n) => {
      document.querySelectorAll('section.card').forEach((c, i) => {
        if (i >= n) c.remove();
        else { const pg = c.querySelector('.pg'); if (pg) pg.textContent = (i + 1) + ' / ' + n; }
      });
    }, count);
  }
  await page.waitForTimeout(400);
  const cards = await page.$$('section.card');
  const files = [];
  for (let i = 0; i < cards.length; i++) {
    const file = path.join(out, 'card-' + (i + 1) + '.png');
    await cards[i].screenshot({ path: file });
    files.push(file);
    console.log(file);
  }
  await browser.close();
  if (pdf) {
    // Pillow로 묶어요: 한 쪽에 카드 한 장, 150dpi (1080×1350 → 18.3×22.9cm)
    execFileSync('python3', ['-I', '-c',
      'import sys\nfrom PIL import Image\nims=[Image.open(f).convert("RGB") for f in sys.argv[2:]]\n' +
      'ims[0].save(sys.argv[1],"PDF",resolution=150,save_all=True,append_images=ims[1:],quality=95)',
      pdf, ...files], { stdio: 'inherit' });
    console.log(pdf);
  }
})();
