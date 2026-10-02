/**
 * 视觉验证脚本：用 Playwright 加载各国家/类型号牌，逐个截图 + 抓渲染后 SVG 几何。
 * 仅用于开发期验证，不进构建产物。
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5177/';
const OUT = '/tmp/plate-shots';
mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: 'cn-small', q: 'region=CN&type=cn-small-car&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%2200001%22%7D' },
  { name: 'cn-ne-small', q: 'region=CN&type=cn-ne-small&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%22D00001%22%7D' },
  { name: 'cn-ne-large', q: 'region=CN&type=cn-ne-large&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%2200001D%22%7D' },
  { name: 'cn-police', q: 'region=CN&type=cn-police&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%220001%22%7D' },
  { name: 'cn-coach', q: 'region=CN&type=cn-coach&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%220001%22%7D' },
  { name: 'cn-embassy', q: 'region=CN&type=cn-embassy&values=%7B%22serial1%22%3A%22001%22%2C%22serial2%22%3A%22001%22%7D' },
  { name: 'cn-moto', q: 'region=CN&type=cn-moto&values=%7B%22province%22%3A%22%E4%BA%AC%22%2C%22letter%22%3A%22A%22%2C%22serial%22%3A%2200001%22%7D' },
  { name: 'eu-de', q: 'region=EU&type=eu-de&values=%7B%22code%22%3A%22M%20AB%201234%22%2C%22country%22%3A%22D%22%7D' },
  { name: 'us-standard', q: 'region=US&type=us-standard&values=%7B%22code%22%3A%22ABC-1234%22%7D' },
  { name: 'jp-private-mid', q: 'region=JP&type=jp-private-mid&values=%7B%22place%22%3A%22%E5%93%81%E5%B7%9D%22%2C%22classNum%22%3A%22500%22%2C%22kana%22%3A%22%E3%81%95%22%2C%22serial%22%3A%2212-34%22%7D' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });

for (const c of CASES) {
  await page.goto(`${BASE}?${c.q}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  const plate = page.locator('svg[data-plate-svg]').first();
  const count = await plate.count();
  if (count === 0) {
    console.log(`\n=== ${c.name} === NO PLATE SVG`);
    continue;
  }

  // 元素截图（可靠）
  await plate.screenshot({ path: `${OUT}/${c.name}.png` });

  const geo = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-plate-svg]');
    const texts = [...svg.querySelectorAll('text')].map((t) => ({
      ch: t.textContent,
      ff: t.getAttribute('font-family'),
      fill: t.getAttribute('fill'),
    }));
    return { vb: svg.getAttribute('viewBox'), n: texts.length, chars: texts.map((t) => t.ch).join('') };
  });
  console.log(`\n=== ${c.name} === vb=${geo.vb} chars="${geo.chars}"`);
}

await browser.close();
console.log('\nshots →', OUT);
