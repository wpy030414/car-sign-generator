/**
 * 4K 高清 PNG 导出。
 *
 * 流程：克隆渲染出的 SVG → 把用到的字体以 base64 data URI 注入 SVG 内联 <style>
 *      → 序列化 → Blob → Image → 按目标宽度绘制到高分 Canvas → toBlob PNG → 下载。
 *
 * 为什么必须内联字体：canvas 栅格化 SVG（经 new Image()）运行在隔离文档里，
 * **无法访问页面的 document.fonts**；任何外链字体要么加载失败（豆腐块/回退字形），
 * 要么跨域污染画布导致 toBlob 抛 SecurityError。故字体必须作为 data: URI 内嵌进 SVG。
 *
 * 全程使用 data:/blob: 同源 URL，不污染画布。
 */

import { EMBOSS } from './emboss';
import { buildExportFontCss } from './fonts';
import type { FontRef, PlateType } from '@/types/standard';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 导出分辨率档位：长边像素。 */
export const EXPORT_SIZES = {
  '2K': 2560,
  '4K': 3840,
  '8K': 7680,
} as const;
export type ExportSize = keyof typeof EXPORT_SIZES;

export interface ExportOptions {
  /** 长边目标像素，默认 4K(3840) */
  longEdge?: number;
  /** 文件名（不含扩展名） */
  filename?: string;
  /** 背景色（默认透明；号牌本身有底色，通常无需） */
  background?: string;
}

/**
 * WebKit 对单个 SVG filter 的离屏表面有尺寸上限（约 4096px）。8K 导出时，
 * 整层字符/冲压边框的 filter 表面宽度 7680px 超限，WebKit 会直接丢弃该图层 ——
 * 表现就是「背景和安装孔都在，字没了」。
 *
 * 根治方式不是拆滤镜语义，而是**分块应用同一份滤镜**：
 * 把被滤镜的图层移入 <defs>，再按 tile 用 <use> 引用它；每个 tile 用
 * userSpaceOnUse 的 filter 区域（tile + 羽化边距）单独光栅化，最后用 clipPath
 * 无缝拼回。滤镜的高度场/光照仍是整层内容，字符与边框的浮雕都完整保留。
 *
 * 水平分块会切开字形，所以水平边距取「最大字符宽/2 + 羽化」；
 * 当前 8K 号牌高度都在 4096px 以内，因此只需按列分块。
 */
const WEBKIT_FILTER_MAX_DIMENSION = 4000;

function isWebKit(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}

function tileOversizedFilters(
  root: SVGSVGElement,
  type: PlateType,
  width: number,
  height: number,
): void {
  if (!isWebKit() || Math.max(width, height) <= WEBKIT_FILTER_MAX_DIMENSION) return;

  const { width: wMm, height: hMm } = type.size;
  const scale = width / wMm;
  const maxRegionMm = WEBKIT_FILTER_MAX_DIMENSION / scale;

  const classes = Object.values(type.charClasses);
  const maxGlyphW = Math.max(...classes.map((cls) => cls.width), 0);
  const maxGlyphH = Math.max(...classes.map((cls) => cls.height), 0);
  const featherMm = Math.max(3 * EMBOSS.blurSigmaMm, EMBOSS.castOffsetMm + 3 * EMBOSS.castBlurMm);
  const marginX = maxGlyphW / 2 + featherMm;
  const marginY = maxGlyphH / 2 + featherMm;

  // 当前号牌在 8K 下高度都 < 4096px；只有更高/方形的号牌才需要按行分块
  const rows =
    hMm * scale <= WEBKIT_FILTER_MAX_DIMENSION
      ? 1
      : Math.max(1, Math.ceil(hMm / Math.max(1, maxRegionMm - 2 * marginY)));
  const marginYActual = rows === 1 ? 0 : marginY;
  const cols = Math.max(1, Math.ceil(wMm / Math.max(1, maxRegionMm - 2 * marginX)));

  const tileW = wMm / cols;
  const tileH = hMm / rows;
  const regionW = tileW + 2 * marginX;
  const regionH = tileH + 2 * marginYActual;

  const filteredGroups = [...root.querySelectorAll<SVGGElement>('g[filter]')].filter(
    (group) =>
      group.querySelector('text') !== null ||
      group.querySelector('rect[data-plate-border]') !== null,
  );
  if (filteredGroups.length === 0) return;

  let defs = root.querySelector<SVGDefsElement>('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    root.insertBefore(defs, root.firstChild);
  }

  // 每个 tile 的裁剪区域（userSpaceOnUse），所有滤镜图层共用
  const clipIds: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = `emboss-clip-${row}-${col}`;
      const clip = document.createElementNS(SVG_NS, 'clipPath');
      clip.setAttribute('id', id);
      clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const rect = document.createElementNS(SVG_NS, 'rect');
      const x = col * tileW;
      const y = row * tileH;
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(col === cols - 1 ? wMm - x : tileW));
      rect.setAttribute('height', String(row === rows - 1 ? hMm - y : tileH));
      clip.appendChild(rect);
      defs.appendChild(clip);
      clipIds.push(id);
    }
  }

  const tileFilters = new Map<string, string[]>();
  let contentCounter = 0;

  for (const group of filteredGroups) {
    const filterAttr = group.getAttribute('filter');
    const match = filterAttr?.match(/url\(#([^)]+)\)/);
    if (!filterAttr || !match) continue;
    const baseId = match[1];

    let filterIds = tileFilters.get(baseId);
    if (!filterIds) {
      const source = root.querySelector<SVGFilterElement>(`[id="${baseId}"]`);
      if (!source) continue;
      filterIds = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const id = `${baseId}-tile-${row}-${col}`;
          const filter = source.cloneNode(true) as SVGFilterElement;
          filter.setAttribute('id', id);
          filter.setAttribute('filterUnits', 'userSpaceOnUse');
          filter.setAttribute('x', String(col * tileW - marginX));
          filter.setAttribute('y', String(row * tileH - marginYActual));
          filter.setAttribute('width', String(regionW));
          filter.setAttribute('height', String(regionH));
          defs.appendChild(filter);
          filterIds.push(id);
        }
      }
      tileFilters.set(baseId, filterIds);
    }

    const contentId = `emboss-content-${contentCounter++}`;
    group.removeAttribute('filter');
    group.setAttribute('id', contentId);

    const parent = group.parentNode;
    if (!parent) continue;

    for (let index = 0; index < rows * cols; index++) {
      const wrapper = document.createElementNS(SVG_NS, 'g');
      wrapper.setAttribute('clip-path', `url(#${clipIds[index]})`);
      const filtered = document.createElementNS(SVG_NS, 'g');
      filtered.setAttribute('filter', `url(#${filterIds[index]})`);
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', `#${contentId}`);
      filtered.appendChild(use);
      wrapper.appendChild(filtered);
      parent.insertBefore(wrapper, group);
    }

    // 原图层只作为 <use> 的定义源，不再直接绘制
    defs.appendChild(group);
  }
}

/**
 * 断言 SVG 内无外部引用（会污染画布或加载失败）。
 * 所有 url(...) 必须是 data:；不得有跨域 <image>。
 */
function assertNoExternalRefs(root: SVGSVGElement): void {
  const xml = new XMLSerializer().serializeToString(root);
  // 检查 url(...) 中非 data: 的 http(s)/绝对路径引用
  const urlRefs = xml.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g) ?? [];
  for (const ref of urlRefs) {
    const inner = ref
      .slice(4, -1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (inner.startsWith('#')) continue; // 内部片段引用（渐变等）OK
    if (!inner.startsWith('data:')) {
      throw new Error(`导出中止：SVG 含外部引用 ${inner}（会污染画布）`);
    }
  }
  // 检查 <image href>
  const images = root.querySelectorAll('image');
  images.forEach((img) => {
    const href =
      img.getAttribute('href') ?? img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
    if (href && !href.startsWith('data:')) {
      throw new Error(`导出中止：<image> 引用外部资源 ${href}`);
    }
  });
}

/**
 * 从当前渲染的 SVG 元素导出 PNG。
 *
 * @param svgEl   已渲染的号牌 <svg>（PlateSvg 输出）
 * @param type    号牌类型（提供 mm 尺寸与字体）
 * @param fonts   该类型用到的字体引用
 */
export async function exportPlatePng(
  svgEl: SVGSVGElement,
  type: PlateType,
  fonts: FontRef[],
  opts: ExportOptions = {},
): Promise<Blob> {
  const longEdge = opts.longEdge ?? EXPORT_SIZES['4K'];

  // 1. 确保页面字体已就绪（屏幕度量依赖，虽导出用内联字体，但布局已定）
  await document.fonts.ready;

  // 2. 计算目标像素尺寸（栅格化与滤镜降级都需要）
  const { width: wMm, height: hMm } = type.size;
  const scale = longEdge / Math.max(wMm, hMm);
  const W = Math.round(wMm * scale);
  const H = Math.round(hMm * scale);

  // 3. 克隆 SVG，注入 base64 字体；WebKit 大尺寸导出时拆分过大的滤镜
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const fontCss = await buildExportFontCss(fonts);
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = fontCss;
  clone.insertBefore(style, clone.firstChild);
  tileOversizedFilters(clone, type, W, H);

  // 4. 写入目标像素尺寸（栅格化需要 intrinsic size）
  clone.setAttribute('width', String(W));
  clone.setAttribute('height', String(H));
  clone.setAttribute('xmlns', SVG_NS);
  clone.removeAttribute('class');
  clone.removeAttribute('style');

  // 5. 安全断言：无外部引用
  assertNoExternalRefs(clone);

  // 6. 序列化 → Blob → object URL
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    // 7. 栅格化
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG 栅格化失败'));
      img.src = url;
    });

    // 8. 绘制到高分 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D 上下文');
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(img, 0, 0, W, H);

    // 9. 导出 PNG Blob
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('canvas 导出失败（可能被污染或为空）');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 触发浏览器下载。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，确保下载已启动
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 一站式：导出并下载。 */
export async function exportAndDownload(
  svgEl: SVGSVGElement,
  type: PlateType,
  fonts: FontRef[],
  opts: ExportOptions = {},
): Promise<void> {
  const blob = await exportPlatePng(svgEl, type, fonts, opts);
  const name = opts.filename ?? `${type.id}`;
  const longEdge = opts.longEdge ?? EXPORT_SIZES['4K'];
  downloadBlob(blob, `${name}-${longEdge}px`);
}
