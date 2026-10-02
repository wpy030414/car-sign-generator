import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 400 } });
const cases = [
  ['cn-small-car','CN','/tmp/plate-export/v4k-cn.png'],
  ['eu-de','EU','/tmp/plate-export/v4k-eu.png'],
  ['jp-private-mid','JP','/tmp/plate-export/v4k-jp.png'],
];
for (const [tid,region,out] of cases) {
  await p.goto(`http://localhost:5177/?region=${region}&type=${tid}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  const b64 = await p.evaluate(async (tid) => {
    const mod = await import('/src/lib/plate/export.ts');
    const reg = await import('/src/lib/standards/index.ts');
    const svg = document.querySelector('svg[data-plate-svg]');
    const type = reg.getPlateType(tid);
    const blob = await mod.exportPlatePng(svg, type, reg.fontsOfType(type), { longEdge: 3840 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin=''; for(let i=0;i<buf.length;i++) bin+=String.fromCharCode(buf[i]);
    return btoa(bin);
  }, tid);
  writeFileSync(out, Buffer.from(b64,'base64'));
  console.log(out, Buffer.from(b64,'base64').length, 'bytes');
}
await b.close();
