// node render.js <front.html> <out.png> <width_px>
const { chromium } = require('playwright');
(async () => {
  const [html, out, w] = process.argv.slice(2);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1024, height: 1536 }, deviceScaleFactor: Number(w) / 1024 });
  await page.goto('file://' + require('path').resolve(html));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  await b.close();
})();
