import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 400 } });
await p.goto('http://localhost:5177/?region=CN&type=cn-small-car', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);

const svgStr = await p.evaluate(async () => {
  const fonts = await import('/src/lib/plate/fonts.ts');
  const reg = await import('/src/lib/standards/index.ts');
  const svg = document.querySelector('svg[data-plate-svg]');
  const type = reg.getPlateType('cn-small-car');
  const used = reg.fontsOfType(type);
  // replicate export clone logic
  const clone = svg.cloneNode(true);
  const css = await fonts.buildExportFontCss(used);
  const style = document.createElementNS('http://www.w3.org/2000/svg','style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute('width','880'); clone.setAttribute('height','280');
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.removeAttribute('class'); clone.removeAttribute('style');
  return new XMLSerializer().serializeToString(clone);
});
// strip the base64 payloads for readability, keep structure
const stripped = svgStr.replace(/base64,[^']+/g, 'base64,<...>');
writeFileSync('/tmp/export-cn.svg', stripped);
console.log('--- serialized export SVG (base64 stripped) ---');
console.log(stripped.slice(0, 2000));
await b.close();
