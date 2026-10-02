/**
 * 号牌字符放置引擎 —— mm 精确布局。
 *
 * 两种拟合方式（见 CharClass.fit）：
 *
 * - **uniform（等比）**：字形按自然宽高比等比缩放，使 ink 高度 = 标准规定高度，
 *   并在其 advance 单元格内水平居中。用于「本身即按标准设计」的字体
 *   （中国 ChePaiZiTi、欧盟 FE-Schrift 克隆）。实测证据：
 *   FE-Schrift 数字 ink 宽高比 356/600 = 0.593，与标准 44.5/75 = 0.593 **完全一致**；
 *   ChePaiZiTi 数字 ink 比例 0.565，与 GA 36-2018 表3 数字 30/70 = 0.429 不一致，
 *   故中国改用 fill 模式（见下）。
 *
 * - **fill（各向异性）**：字形 ink 被拉伸到精确的 width × height。用于替代字体
 *   （美国 Overpass 替代 Highway Gothic、日本 Noto 替代 TRM gothic），
 *   以及中国号牌（标准规定的数字 30×70 比例 0.429 明显窄于字体自然比例，
 *   说明标准给出的是「压缩后的 ink 尺寸」，需各向异性拟合）。
 *
 * 度量数据来自 `fontMetrics.ts`（构建期由 fontTools 从字体文件精确测量），
 * 无需运行时 canvas 测量，布局是纯函数、确定性、可在 Node 下单测。
 */

import { FONT_METRICS, type GlyphMetrics } from './fontMetrics';
import type {
  CharClass,
  CharacterRun,
  FontRef,
  FreeRun,
  Mm,
  PlacedGlyph,
  PlateType,
  Run,
  Slot,
} from '@/types/standard';

/** FontRef.family → FONT_METRICS 键的映射。 */
const METRICS_BY_FAMILY: Record<string, keyof typeof FONT_METRICS> = {
  ChePaiZiTi: 'Latin',
  'Source Han Sans CN VF': 'HanCN',
  'GL-Nummernschild-Mtl': 'FE',
  Overpass: 'Overpass',
  'Noto Sans JP': 'NotoJP',
};

export interface FontMetricsEntry {
  upem: number;
  glyphs: Record<string, GlyphMetrics>;
}

export function metricsFor(font: FontRef): FontMetricsEntry {
  const key = METRICS_BY_FAMILY[font.family];
  if (!key) throw new Error(`未知字体 family: ${font.family}（需在 METRICS_BY_FAMILY 注册）`);
  return FONT_METRICS[key];
}

/** 取某字符的 ink 度量；缺字形时退化为 advance-only（无 ink）。 */
export function glyphOf(font: FontRef, char: string): GlyphMetrics {
  const m = metricsFor(font);
  return m.glyphs[char] ?? { adv: m.glyphs[' ']?.adv ?? 0.5 };
}

/**
 * 解析一个 Slot 应当绘制的字符。
 * 优先 literal，其次从字段值按 charIndex 取。
 * 返回 null 表示该槽位留空（字段值不够长）。
 */
export function slotChar(slot: Slot, values: Record<string, string>): string | null {
  if (slot.literal !== undefined) return slot.literal;
  if (slot.field === undefined) return null;
  const v = values[slot.field] ?? '';
  const ch = v[slot.charIndex ?? 0];
  return ch === undefined || ch === '' ? null : ch;
}

/** 字符单元格的水平步进（pitch）：优先 advance，其次 width。 */
export function pitchOf(cls: CharClass): Mm {
  return cls.advance ?? cls.width;
}

/**
 * 布局一个线性字符序列 → 绝对单元格坐标（mm）。
 *
 * 步进规则：单元格宽度 = pitchOf(cls)，相邻单元格之间再加 run.gap。
 *
 * @param run     序列定义
 * @param type    所属号牌类型（提供 charClasses 与画布宽度用于居中）
 * @param values  用户字段值
 * @returns       每个槽位的单元格；char 为 null 的槽位返回 null（留空）
 */
export function layoutRun(
  run: CharacterRun,
  type: PlateType,
  values: Record<string, string>,
): (PlacedGlyph | null)[] {
  const xs: Mm[] = [];
  const gaps: Mm[] = []; // 每个字符之后的间距
  let cursor = run.origin.x;
  for (let i = 0; i < run.slots.length; i++) {
    const slot = run.slots[i];
    const cls = type.charClasses[slot.classId];
    if (!cls) throw new Error(`未知的 charClass: ${slot.classId}（号牌类型 ${type.id}）`);
    xs.push(cursor);
    const gapAfter = cls.gapAfter ?? run.gap;
    gaps.push(gapAfter);
    cursor += pitchOf(cls) + gapAfter;
  }
  // 最后一个字符之后不应有间距（用于精确居中）
  const trailingGap = gaps.length ? gaps[gaps.length - 1] : 0;
  if (run.align === 'center') {
    // 整个序列宽度（去掉末尾多余 gap），相对号牌中线居中
    const totalW = cursor - trailingGap - run.origin.x;
    const dx = (type.size.width - totalW) / 2 - run.origin.x;
    for (let i = 0; i < xs.length; i++) xs[i] += dx;
  }

  return run.slots.map((slot, i) => {
    const char = slotChar(slot, values);
    if (char === null) return null;
    const cls = type.charClasses[slot.classId];
    const pitch = pitchOf(cls);
    return {
      char,
      cls,
      cell: { x: xs[i], y: run.origin.y, w: pitch, h: cls.height },
    };
  });
}

/**
 * 布局一个自由文本序列：把字段整体展开为字符，逐字符按 auto 分类选 charClass。
 * 空格字符按 `auto.other` 类处理（其 advance 提供词间隔）。
 *
 * 对齐在「对齐框」内进行：框左缘 = origin.x，框宽 = width（缺省 = 号牌宽 - origin.x）。
 */
export function layoutFreeRun(
  run: FreeRun,
  type: PlateType,
  values: Record<string, string>,
): (PlacedGlyph | null)[] {
  const text = values[run.field] ?? '';
  const out: (PlacedGlyph | null)[] = [];
  const placements: { char: string; cls: CharClass }[] = [];

  for (const ch of text) {
    const clsId = /[0-9]/.test(ch)
      ? run.auto.digit
      : /[A-Za-z]/.test(ch)
        ? run.auto.letter
        : run.auto.other;
    const cls = type.charClasses[clsId];
    if (!cls) throw new Error(`未知的 charClass: ${clsId}（号牌类型 ${type.id}）`);
    placements.push({ char: ch, cls });
  }

  const pitches = placements.map((p) => pitchOf(p.cls));
  const totalW =
    pitches.reduce((a, b) => a + b, 0) + run.gap * Math.max(0, pitches.length - 1);

  // 对齐框
  const boxLeft = run.origin.x;
  const boxW = run.width ?? type.size.width - boxLeft;
  let cursor = boxLeft;
  if (run.align === 'center') {
    cursor = boxLeft + Math.max(0, (boxW - totalW) / 2);
  } else if (run.align === 'right') {
    cursor = boxLeft + Math.max(0, boxW - totalW);
  }

  for (let i = 0; i < placements.length; i++) {
    const { char, cls } = placements[i];
    const pitch = pitches[i];
    out.push({ char, cls, cell: { x: cursor, y: run.origin.y, w: pitch, h: cls.height } });
    cursor += pitch + run.gap;
  }
  return out;
}

/** 布局任意序列（run 或 free），供渲染组件统一调用。 */
export function layoutAny(
  run: Run,
  type: PlateType,
  values: Record<string, string>,
): (PlacedGlyph | null)[] {
  return run.kind === 'run'
    ? layoutRun(run, type, values)
    : layoutFreeRun(run, type, values);
}

/**
 * 计算把一个字形精确拟合到 mm 单元格所需的 SVG transform 与 font-size。
 *
 * 坐标系差异：SVG y 轴向下，字体 ink 度量 y 轴向上（基线为原点），故 y 需翻转。
 *
 * 以 fontSize = 1（em）为基准推导：
 *   ink 宽 = (x1-x0) em，ink 高 = (y1-y0) em。
 * 目标 ink 尺寸由 fit 模式决定：
 *   - fill:    (cell.w_ink, cls.height)，其中 cell.w_ink = cls.width（标准 ink 宽）
 *   - uniform: (自然宽 × s, cls.height)，s = cls.height / inkH（保持比例）
 *
 * @returns transform 字符串 + font-size（mm）
 */
export function glyphTransform(
  char: string,
  cls: CharClass,
  cell: { x: Mm; y: Mm; w: Mm; h: Mm },
): { transform: string; fontSize: Mm } {
  const g = glyphOf(cls.font, char);
  const hasInk =
    g.x0 !== undefined && g.y0 !== undefined && g.x1 !== undefined && g.y1 !== undefined;

  // 以 1em = 1mm 为基准绘制，再用 scale 拉到目标 ink 尺寸。
  const fontSize = 1;
  const off = cls.baselineOffset ?? 0;

  if (!hasInk) {
    // 无 ink 字形（空格等）：放在单元格左下基线位置
    return {
      transform: `translate(${r(cell.x)} ${r(cell.y + cell.h + off)})`,
      fontSize,
    };
  }

  const inkW = g.x1! - g.x0!; // em
  const inkH = g.y1! - g.y0!; // em

  let targetW: number;
  let targetH: number;
  if ((cls.fit ?? 'fill') === 'uniform') {
    targetH = cls.height;
    targetW = inkW * (targetH / inkH); // 保持自然比例
  } else {
    targetH = cls.height;
    targetW = cls.width; // 标准规定的 ink 宽
  }

  const sx = targetW / inkW;
  const sy = targetH / inkH;

  // uniform 模式：在 pitch 单元格内水平居中
  let left = cell.x;
  if ((cls.fit ?? 'fill') === 'uniform') {
    left = cell.x + (cell.w - targetW) / 2;
  }

  // ink 左边缘 x0（em）经 sx 缩放后应落到 left
  const tx = left - g.x0! * sx;
  // ink 上边缘：字体中为 y1（向上为正），SVG 中为 -y1；经 sy 缩放后应落到 cell.y
  const ty = cell.y + g.y1! * sy;

  return {
    transform: `translate(${r(tx)} ${r(ty + off)}) scale(${r(sx)} ${r(sy)})`,
    fontSize,
  };
}

/** 保留 4 位小数，避免 SVG 属性过长。 */
export function r(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * 分隔点「·」的 x 坐标：前一个单元格右边缘与后一个单元格左边缘的中点。
 * 中国号牌发牌机关代号与序号之间的圆点用此定位（矢量绘制，不用字体字形）。
 */
export function dotCenterX(prevCellRight: Mm, nextCellLeft: Mm): Mm {
  return (prevCellRight + nextCellLeft) / 2;
}
