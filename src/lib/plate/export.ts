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
 * 断言 SVG 内无外部引用（会污染画布或加载失败）。
 * 所有 url(...) 必须是 data:；不得有跨域 <image>。
 */
function assertNoExternalRefs(root: SVGSVGElement): void {
  const xml = new XMLSerializer().serializeToString(root);
  // 检查 url(...) 中非 data: 的 http(s)/绝对路径引用
  const urlRefs = xml.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g) ?? [];
  for (const ref of urlRefs) {
    const inner = ref.slice(4, -1).trim().replace(/^['"]|['"]$/g, '');
    if (inner.startsWith('#')) continue; // 内部片段引用（渐变等）OK
    if (!inner.startsWith('data:')) {
      throw new Error(`导出中止：SVG 含外部引用 ${inner}（会污染画布）`);
    }
  }
  // 检查 <image href>
  const images = root.querySelectorAll('image');
  images.forEach((img) => {
    const href = img.getAttribute('href') ?? img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
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

  // 2. 克隆 SVG，注入 base64 字体
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const fontCss = await buildExportFontCss(fonts);
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = fontCss;
  clone.insertBefore(style, clone.firstChild);

  // 3. 写入目标像素尺寸（栅格化需要 intrinsic size）
  const { width: wMm, height: hMm } = type.size;
  const scale = longEdge / Math.max(wMm, hMm);
  const W = Math.round(wMm * scale);
  const H = Math.round(hMm * scale);
  clone.setAttribute('width', String(W));
  clone.setAttribute('height', String(H));
  clone.setAttribute('xmlns', SVG_NS);
  clone.removeAttribute('class');
  clone.removeAttribute('style');

  // 4. 安全断言：无外部引用
  assertNoExternalRefs(clone);

  // 5. 序列化 → Blob → object URL
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    // 6. 栅格化
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG 栅格化失败'));
      img.src = url;
    });

    // 7. 绘制到高分 Canvas
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

    // 8. 导出 PNG Blob
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
