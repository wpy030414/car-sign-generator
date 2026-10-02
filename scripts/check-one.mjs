import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3] ?? '/tmp/plate-shots/one.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 3 });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
const plate = p.locator('svg[data-plate-svg]').first();
await plate.screenshot({ path: out });
const geo = await p.evaluate(() => {
  const svg = document.querySelector('svg[data-plate-svg]');
  const circ = svg.querySelector('circle');
  const texts = [...svg.querySelectorAll('text')].map(t => ({ ch: t.textContent, x: +(t.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1] ?? 0) }));
  return { dotCx: circ ? +circ.getAttribute('cx') : null, texts };
});
console.log(JSON.stringify(geo));
await b.close();
