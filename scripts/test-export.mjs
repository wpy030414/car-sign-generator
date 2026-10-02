import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('/tmp/plate-export', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });

const CASES = [
  { name: 'cn-small', url: 'http://localhost:5177/?region=CN&type=cn-small-car' },
  { name: 'eu-de', url: 'http://localhost:5177/?region=EU&type=eu-de' },
  { name: 'us-standard', url: 'http://localhost:5177/?region=US&type=us-standard' },
  { name: 'jp-private-mid', url: 'http://localhost:5177/?region=JP&type=jp-private-mid' },
];

// Capture console errors + page errors
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text()); });
p.on('pageerror', e => console.log('PAGE ERR:', e.message));

for (const c of CASES) {
  await p.goto(c.url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);

  // Call the export path directly in-page (same code the button uses)
  const result = await p.evaluate(async () => {
    const mod = await import('/src/lib/plate/export.ts');
    const reg = await import('/src/lib/standards/index.ts');
    const svg = document.querySelector('svg[data-plate-svg]');
    if (!svg) return { error: 'no svg' };
    const typeId = svg.getAttribute('data-plate-svg');
    const type = reg.getPlateType(typeId);
    const fonts = reg.fontsOfType(type);
    try {
      const t0 = performance.now();
      const blob = await mod.exportPlatePng(svg, type, fonts, { longEdge: 3840 });
      const dt = performance.now() - t0;
      // read blob -> base64 to verify it's a real PNG and check size
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin=''; for (let i=0;i<buf.length;i++) bin+=String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const isPng = buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4e && buf[3]===0x47;
      // decode PNG dims from IHDR
      const w = (buf[16]<<24)|(buf[17]<<16)|(buf[18]<<8)|buf[19];
      const h = (buf[20]<<24)|(buf[21]<<16)|(buf[22]<<8)|buf[23];
      return { ok:true, isPng, bytes: buf.length, w, h, ms: Math.round(dt), b64len: b64.length, b64head: b64.slice(0,40) };
    } catch(e) { return { error: String(e && e.message || e) }; }
  });

  console.log(`\n=== ${c.name} export ===`);
  console.log(JSON.stringify(result));
  if (result.ok) {
    // save the PNG by re-exporting and writing file
    const saved = await p.evaluate(async () => {
      const mod = await import('/src/lib/plate/export.ts');
      const reg = await import('/src/lib/standards/index.ts');
      const svg = document.querySelector('svg[data-plate-svg]');
      const type = reg.getPlateType(svg.getAttribute('data-plate-svg'));
      const blob = await mod.exportPlatePng(svg, type, reg.fontsOfType(type), { longEdge: 3840 });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin=''; for (let i=0;i<buf.length;i++) bin+=String.fromCharCode(buf[i]);
      return btoa(bin);
    });
    writeFileSync(`/tmp/plate-export/${c.name}-4k.png`, Buffer.from(saved, 'base64'));
  }
}
await b.close();
console.log('\nsaved to /tmp/plate-export');
