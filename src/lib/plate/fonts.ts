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
const cnUrl = f('fonts/CN.ttf');
const punctUrl = f('fonts/Latin.ttf');

const feUrl = f('fonts/FE-Mittelschrift.ttf');
const roadgeekUrl = f('fonts/Roadgeek-2014-EM.ttf');
const notoUrl = f('fonts/NotoSansJP-Bold-subset.woff2');
const fzUrl = f('fonts/FZ-NumberPlate.otf');

/** 中国号牌专用字体（训练员提供）：等宽字距、字宽约 0.5，数字/字母/汉字同一套。 */
const cnPlate: FontRef = {
  family: 'ChinaVehicleLicensePlateFont',
  src: cnUrl,
  format: 'truetype',
};

/**
 * 新能源号牌专用拉丁字形（GA 36-2018 新能源字体，训练员提供）。
 *
 * 该字体只覆盖部分数字/字母（1–9、A–H/L/M/N 等），`1` 为带衬线的防伪字形。
 * 缺失字形（0、I/O 以外的部分字母）按 CSS font-family 栈回退到 `cnPlate`，
 * 布局度量也沿 `FontRef.fallback` 取同一字体的 ink，保证字形与拟合一致。
 */
const cnELatin: FontRef = {
  family: 'CN-E-Latin',
  src: f('fonts/CN-E-Latin.otf'),
  format: 'opentype',
  fallback: cnPlate,
};

export const FONTS = {
  cn: cnPlate,
  latin: cnPlate,
  han: cnPlate,
  cnELatin,
  // 标点专用（连字符/句点/空格）：新号牌字体不含这些字形
  punct: { family: 'ChePaiZiTi-Punct', src: punctUrl, format: 'truetype' } satisfies FontRef,
  fe: { family: 'GL-Nummernschild-Mtl', src: feUrl, format: 'truetype' } satisfies FontRef,
  roadgeek: {
    family: 'Roadgeek 2014 Series EM',
    src: roadgeekUrl,
    format: 'truetype',
  } satisfies FontRef,
  noto: { family: 'Noto Sans JP', weight: 700, src: notoUrl, format: 'woff2' } satisfies FontRef,
  // 日本号牌字形（FZ ナンバープレートゴシック）：数字/字母/部分假名
  fzJP: { family: 'FZ-Carnumber', src: fzUrl, format: 'opentype' } satisfies FontRef,
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

/** 展开 `FontRef.fallback` 链并去重（family 级）。 */
export function expandFonts(fonts: FontRef[]): FontRef[] {
  const out = new Map<string, FontRef>();
  const walk = (font: FontRef) => {
    if (out.has(font.family)) return;
    out.set(font.family, font);
    if (font.fallback) walk(font.fallback);
  };
  for (const font of fonts) walk(font);
  return [...out.values()];
}

function cssFor(font: FontRef, srcOverride?: string): string {
  const weight = font.weight ? `font-weight:${font.weight};` : '';
  const fmt = font.format ? ` format('${FORMAT_CSS[font.format] ?? font.format}')` : '';
  return `@font-face{font-family:'${font.family}';src:url('${srcOverride ?? font.src}')${fmt};${weight}font-display:block;}`;
}

/**
 * 确保字体已在页面加载（屏幕渲染用）。幂等。
 */
export async function ensureFontsLoaded(input: FontRef[]): Promise<void> {
  const fonts = expandFonts(input);
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
      // 传样本文本：只覆盖部分字符的字体（CN-E-Latin）若用默认空格可能根本不加载
      return document.fonts
        .load(`${weight} 100px "${f.family}"`, '0123456789ABC 京')
        .catch(() => undefined);
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
  const mime =
    font.format === 'woff2' ? 'font/woff2' : font.format === 'opentype' ? 'font/otf' : 'font/ttf';
  const dataUrl = `data:${mime};base64,${btoa(binary)}`;
  dataUrlCache.set(font.family, dataUrl);
  return dataUrl;
}

/**
 * 生成导出用 @font-face CSS：所有字体以 base64 data URI 内联。
 * canvas 栅格化 SVG 的唯一可靠字体来源。
 */
export async function buildExportFontCss(input: FontRef[]): Promise<string> {
  const parts = await Promise.all(
    expandFonts(input).map(async (f) => cssFor(f, await toDataUrl(f))),
  );
  return parts.join('\n');
}

/** 预热所有字体的 base64 缓存（可在应用启动后空闲时调用，加速首次导出）。 */
export async function warmFontCache(input: FontRef[]): Promise<void> {
  await Promise.all(expandFonts(input).map((f) => toDataUrl(f).catch(() => undefined)));
}
