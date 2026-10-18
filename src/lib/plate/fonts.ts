/**
 * 字体加载与内联。
 *
 * 屏幕渲染：fetch 字体字节 → `FontFace` → `document.fonts.add`。
 *   走 `FontFace(ArrayBuffer)` 而不是注入 `@font-face`，是为了在下载过程中
 *   拿到字节级进度（`Response.body` 流），供预览显示加载进度条；
 *   同时把 ArrayBuffer 缓存下来，导出时直接转 base64，避免二次下载。
 *
 * 导出渲染：canvas 栅格化 SVG 时无法访问页面 document.fonts，且外链字体会污染画布，
 *   因此导出前必须把字体以 base64 data URI 内联进 SVG 的 <style>。
 */

import type { FontRef } from '@/types/standard';

// public/ 下的字体，构建后原样复制到站点根，运行时以根路径引用。
// BASE_URL 兼容部署在子路径的情况。
const base = import.meta.env.BASE_URL;
const f = (p: string) => `${base}${p}`;

/** 中国号牌专用字体（训练员提供）：等宽字距、字宽约 0.5，数字/字母/汉字同一套。 */
const cnPlate: FontRef = {
  family: 'CN-Plate',
  src: f('fonts/CN-Plate.woff2'),
  format: 'woff2',
};

/**
 * 新能源号牌专用拉丁字形（GA 36-2018 新能源字体，训练员提供）。
 *
 * 该字体只覆盖部分数字/字母（1–9、A–H/L/M/N 等），`1` 为带衬线的防伪字形。
 * 缺失字形（0、I/O 以外的部分字母）按 CSS font-family 栈回退到 `cnPlate`，
 * 布局度量也沿 `FontRef.fallback` 取同一字体的 ink，保证字形与拟合一致。
 */
const cnELatin: FontRef = {
  family: 'CN-NE-Latin',
  src: f('fonts/CN-NE-Latin.woff2'),
  format: 'woff2',
  fallback: cnPlate,
};

export const FONTS = {
  cn: cnPlate,
  latin: cnPlate,
  han: cnPlate,
  cnELatin,
  fe: {
    family: 'EU-Plate',
    src: f('fonts/EU-Plate.woff2'),
    format: 'woff2',
  } satisfies FontRef,
  roadgeek: {
    family: 'US-Plate',
    src: f('fonts/US-Plate.woff2'),
    format: 'woff2',
  } satisfies FontRef,
  noto: {
    family: 'JP-Plate',
    weight: 700,
    src: f('fonts/JP-Plate.woff2'),
    format: 'woff2',
  } satisfies FontRef,
} as const;

const FORMAT_CSS: Record<string, string> = {
  woff2: 'woff2',
  truetype: 'truetype',
  opentype: 'opentype',
};

/** 加载进度（跨本次 request 的所有字体聚合）。 */
export interface FontLoadProgress {
  /** 0..1。未知字节总长时按「已完成字体数 + 当前字体估算占比」计算。 */
  ratio: number;
  loadedFonts: number;
  totalFonts: number;
  /** 当前字体拿不到 Content-Length（或响应被压缩），只能显示不确定进度。 */
  indeterminate: boolean;
}

type ProgressListener = (loaded: number, total: number) => void;

interface BufferTask {
  promise: Promise<ArrayBuffer>;
  loaded: number;
  total: number;
  listeners: Set<ProgressListener>;
}

/** family → 字体字节下载任务（同一字体只下载一次）。 */
const bufferTasks = new Map<string, BufferTask>();
/** family → 字体已注册到 document.fonts 的任务（同一字体只注册一次）。 */
const familyLoadTasks = new Map<string, Promise<void>>();
/** 已成功注册的 family。 */
const loadedFamilies = new Set<string>();
/** family → base64 data URI 缓存（导出用）。 */
const dataUrlCache = new Map<string, string>();

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

/** 所有字体是否都已在页面注册（用于首帧直接渲染，避免闪一下加载态）。 */
export function areFontsLoaded(input: FontRef[]): boolean {
  return expandFonts(input).every((font) => loadedFamilies.has(font.family));
}

function cssFor(font: FontRef, srcOverride?: string): string {
  const weight = font.weight ? `font-weight:${font.weight};` : '';
  const fmt = font.format ? ` format('${FORMAT_CSS[font.format] ?? font.format}')` : '';
  return `@font-face{font-family:'${font.family}';src:url('${srcOverride ?? font.src}')${fmt};${weight}font-display:block;}`;
}

/** 创建并启动一个字体字节下载任务。 */
function startBufferTask(font: FontRef): BufferTask {
  const existing = bufferTasks.get(font.family);
  if (existing) return existing;

  const listeners = new Set<ProgressListener>();
  const task: BufferTask = {
    // 占位，下面立即替换为真实 promise
    promise: Promise.resolve(new ArrayBuffer(0)),
    loaded: 0,
    total: 0,
    listeners,
  };
  const emit = (loaded: number, total: number) => {
    task.loaded = loaded;
    task.total = total;
    for (const listener of listeners) listener(loaded, total);
  };

  task.promise = (async () => {
    try {
      const res = await fetch(font.src);
      if (!res.ok) throw new Error(`字体加载失败: ${font.src} (${res.status})`);
      // 压缩响应（gzip/br）的 Content-Length 是压缩后大小，与流中的字节数不一致，
      // 此时不报总长，UI 退化为不确定进度。
      const encoding = res.headers.get('content-encoding');
      const total =
        encoding && encoding !== 'identity' ? 0 : Number(res.headers.get('content-length')) || 0;

      if (!res.body) {
        const buffer = await res.arrayBuffer();
        emit(buffer.byteLength, buffer.byteLength);
        return buffer;
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      emit(0, total);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        emit(loaded, total);
      }
      const bytes = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      emit(loaded, loaded);
      return bytes.buffer;
    } catch (error) {
      bufferTasks.delete(font.family);
      throw error;
    }
  })();
  bufferTasks.set(font.family, task);
  return task;
}

function subscribe(task: BufferTask, listener: ProgressListener): () => void {
  task.listeners.add(listener);
  listener(task.loaded, task.total);
  return () => task.listeners.delete(listener);
}

function createFontFace(font: FontRef, buffer: ArrayBuffer): FontFace {
  const descriptors: FontFaceDescriptors = {
    weight: font.weight ? String(font.weight) : 'normal',
    style: 'normal',
    display: 'block',
  };
  try {
    // 现代浏览器都支持从 ArrayBuffer 构造；避免再发一次请求
    return new FontFace(font.family, buffer, descriptors);
  } catch {
    const fmt = font.format ? ` format('${FORMAT_CSS[font.format] ?? font.format}')` : '';
    return new FontFace(font.family, `url('${font.src}')${fmt}`, descriptors);
  }
}

function loadFamily(font: FontRef): Promise<void> {
  const existing = familyLoadTasks.get(font.family);
  if (existing) return existing;

  const task = (async () => {
    const buffer = await startBufferTask(font).promise;
    if (loadedFamilies.has(font.family)) return;
    const face = createFontFace(font, buffer);
    await face.load();
    document.fonts.add(face);
    loadedFamilies.add(font.family);
  })();

  familyLoadTasks.set(font.family, task);
  // 失败后允许重试：下一次 ensureFontsLoaded 会重新创建任务
  task.catch(() => {
    if (familyLoadTasks.get(font.family) === task) familyLoadTasks.delete(font.family);
  });
  return task;
}

/**
 * 确保字体已在页面加载（屏幕渲染用）。幂等、并发安全。
 *
 * @param onProgress 可选的进度回调；节流到整数百分比，避免高频重渲染。
 */
export async function ensureFontsLoaded(
  input: FontRef[],
  onProgress?: (progress: FontLoadProgress) => void,
): Promise<void> {
  const fonts = expandFonts(input);
  const totalFonts = fonts.length;

  if (totalFonts === 0) {
    onProgress?.({ ratio: 1, loadedFonts: 0, totalFonts: 0, indeterminate: false });
    return;
  }

  const tasks = new Map<string, BufferTask>();
  const unsubscribers: (() => void)[] = [];
  let lastPercent = -1;

  const report = () => {
    let sum = 0;
    let loadedFonts = 0;
    let indeterminate = false;

    for (const font of fonts) {
      if (loadedFamilies.has(font.family)) {
        sum += 1;
        loadedFonts += 1;
        continue;
      }
      const task = tasks.get(font.family) ?? bufferTasks.get(font.family);
      if (!task) continue;
      if (task.total > 0) {
        const fraction = Math.min(1, task.loaded / task.total);
        sum += fraction;
        if (fraction >= 1) loadedFonts += 1;
      } else {
        indeterminate = true;
        // 未知总长时给一个保守的「进行中」占比，进度条不会一直停在 0
        if (task.loaded > 0) sum += 0.5;
      }
    }

    const ratio = Math.min(1, sum / totalFonts);
    const percent = Math.round(ratio * 100);
    // 100% 每次都要报（可能随后还要等 FontFace.load），其余按整数百分比节流
    if (percent === lastPercent && percent !== 100) return;
    lastPercent = percent;
    onProgress?.({ ratio, loadedFonts, totalFonts, indeterminate });
  };

  for (const font of fonts) {
    if (loadedFamilies.has(font.family)) continue;
    const task = startBufferTask(font);
    tasks.set(font.family, task);
    unsubscribers.push(subscribe(task, () => report()));
  }
  report();

  try {
    await Promise.all(
      fonts.map((font) => (loadedFamilies.has(font.family) ? Promise.resolve() : loadFamily(font))),
    );
  } finally {
    for (const unsubscribe of unsubscribers) unsubscribe();
  }

  onProgress?.({ ratio: 1, loadedFonts: totalFonts, totalFonts, indeterminate: false });
}

/** 拉取字体字节（带缓存），导出内联时复用屏幕加载的下载结果。 */
async function getFontBuffer(font: FontRef): Promise<ArrayBuffer> {
  return startBufferTask(font).promise;
}

/** 字体 buffer → base64 data URI（带缓存）。 */
async function toDataUrl(font: FontRef): Promise<string> {
  const cached = dataUrlCache.get(font.family);
  if (cached) return cached;

  const buffer = await getFontBuffer(font);
  const bytes = new Uint8Array(buffer);
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
    expandFonts(input).map(async (font) => cssFor(font, await toDataUrl(font))),
  );
  return parts.join('\n');
}
