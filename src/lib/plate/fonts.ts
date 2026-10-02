/**
 * 字体加载与内联。
 *
 * 屏幕渲染：通过动态注入 @font-face（src 指向 Vite 资源 URL）+ document.fonts 加载。
 * 导出渲染：canvas 栅格化 SVG 时无法访问页面 document.fonts，且外链字体会污染画布，
 *          因此导出前必须把字体以 base64 data URI 内联进 SVG 的 <style>。
 */

import type { FontRef } from '@/types/standard';

// public/ 下的字体，构建后原样复制到站点根，运行时以根路径引用。
// BASE_URL 兼容部署在子路径的情况。
const base = import.meta.env.BASE_URL;
const f = (p: string) => `${base}${p}`;
const latinUrl = f('fonts/Latin.ttf');
const hanUrl = f('fonts/SourceHanSansCN.woff2');
const feUrl = f('fonts/FE-Mittelschrift.ttf');
const overpassUrl = f('fonts/Overpass-Bold.woff2');
const notoUrl = f('fonts/NotoSansJP-Bold-subset.woff2');

export const FONTS = {
  latin: { family: 'ChePaiZiTi', src: latinUrl, format: 'truetype' } satisfies FontRef,
  han: { family: 'Source Han Sans CN VF', src: hanUrl, format: 'woff2' } satisfies FontRef,
  fe: { family: 'GL-Nummernschild-Mtl', src: feUrl, format: 'truetype' } satisfies FontRef,
  overpass: { family: 'Overpass', weight: 700, src: overpassUrl, format: 'woff2' } satisfies FontRef,
  noto: { family: 'Noto Sans JP', weight: 700, src: notoUrl, format: 'woff2' } satisfies FontRef,
} as const;

const FORMAT_CSS: Record<string, string> = {
  woff2: 'woff2',
  truetype: 'truetype',
  opentype: 'opentype',
};

/** 已注入的 @font-face family 集合，避免重复注入。 */
const injected = new Set<string>();
/** family → base64 data URI 缓存（导出用）。 */
const dataUrlCache = new Map<string, string>();
/** family → FontRef 缓存。 */
const fontRefCache = new Map<string, FontRef>();

function cssFor(font: FontRef, srcOverride?: string): string {
  const weight = font.weight ? `font-weight:${font.weight};` : '';
  const fmt = font.format ? ` format('${FORMAT_CSS[font.format] ?? font.format}')` : '';
  return `@font-face{font-family:'${font.family}';src:url('${srcOverride ?? font.src}')${fmt};${weight}font-display:block;}`;
}

/**
 * 确保字体已在页面加载（屏幕渲染用）。幂等。
 */
export async function ensureFontsLoaded(fonts: FontRef[]): Promise<void> {
  for (const font of fonts) {
    fontRefCache.set(font.family, font);
    if (!injected.has(font.family)) {
      const style = document.createElement('style');
      style.dataset.font = font.family;
      style.textContent = cssFor(font);
      document.head.appendChild(style);
      injected.add(font.family);
    }
  }
  await document.fonts.ready;
  // 逐个确保实际可用（触发加载）
  await Promise.all(
    fonts.map((f) => {
      const weight = f.weight ? String(f.weight) : 'normal';
      return document.fonts.load(`${weight} 100px "${f.family}"`).catch(() => undefined);
    }),
  );
  await document.fonts.ready;
}

/** 拉取字体文件并转 base64 data URI（带缓存）。 */
async function toDataUrl(font: FontRef): Promise<string> {
  const cached = dataUrlCache.get(font.family);
  if (cached) return cached;
  const res = await fetch(font.src);
  if (!res.ok) throw new Error(`字体加载失败: ${font.src} (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const mime = font.format === 'woff2' ? 'font/woff2' : font.format === 'opentype' ? 'font/otf' : 'font/ttf';
  const dataUrl = `data:${mime};base64,${btoa(binary)}`;
  dataUrlCache.set(font.family, dataUrl);
  return dataUrl;
}

/**
 * 生成导出用 @font-face CSS：所有字体以 base64 data URI 内联。
 * canvas 栅格化 SVG 的唯一可靠字体来源。
 */
export async function buildExportFontCss(fonts: FontRef[]): Promise<string> {
  const unique = new Map<string, FontRef>();
  for (const f of fonts) unique.set(f.family, f);
  const parts = await Promise.all(
    [...unique.values()].map(async (f) => cssFor(f, await toDataUrl(f))),
  );
  return parts.join('\n');
}

/** 预热所有字体的 base64 缓存（可在应用启动后空闲时调用，加速首次导出）。 */
export async function warmFontCache(fonts: FontRef[]): Promise<void> {
  await Promise.all(fonts.map((f) => toDataUrl(f).catch(() => undefined)));
}
