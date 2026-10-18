/**
 * 美国机动车号牌标准（通用物理基线）。
 *
 * 数据来源：
 * - 1956 AMA / 各州统一协议：6×12 in（152.4×304.8mm）通用尺寸
 * - FHWA Series E Modified（Highway Gothic）字形比例
 * - 实测 DC 2013 样牌（160px/in 等比）标定字符度量
 *
 * 字体：**Roadgeek 2014 Series E(M)**（MIT）—— 按 FHWA《Standard Alphabets for
 *   Traffic Control Devices》公开的公有领域字形数据复刻，与美国号牌实际使用的
 *   Highway Gothic / Series E Modified 同源，而非近似替代。
 *
 * 关键：全比例 FHWA Series E(M) 对 12in 牌过宽（3in cap 时 ABC1234 需 18in），
 *   实际牌面模具是**压缩切工**，故用 `fill`（各向异性）模式压到实测 ink 尺寸
 *   （字宽≈31.2mm @ cap 76.2mm）。
 *
 * 注：美国号牌各州图形/配色差异极大，本实现取**通用物理标准**
 *   （尺寸、字体、安装孔）+ 白底黑字基线，不含州别图案。
 */

import { FONTS } from '@/lib/plate/fonts';
import { usStateTypes } from './us-states';
import type { PlateType, Standard } from '@/types/standard';

export const US_COLORS = {
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ── 几何常量（in → mm，1in = 25.4mm）──────────────────────────
const IN = 25.4;
const PLATE = { w: 304.8, h: 152.4, radius: 13.0 }; // 12×6 in，实测圆角 R≈0.512in
/** 字符 cap 高 3in（76.2mm）为通行默认；DC 样牌实测 2.675in（67.9mm）。 */
const CAP = 76.2;
const STROKE = 10.7; // 0.140 × cap
const GLYPH_W = 31.2; // 实测平均 ink 宽 0.410 × cap（压缩模具）
const PITCH = 43.7; // 0.574 × cap，中心到中心
const GAP = PITCH - GLYPH_W; // ≈12.5mm，字符间空隙
/** 安装孔：水平中心距 7in（177.8mm，唯一权威值）；孔径/垂直位为通行约定。 */
const HOLE_SPACING = 177.8;
const HOLE_D = 7.0;
const HOLE_Y = 19.0; // 距顶边

const roadgeek = FONTS.roadgeek;

/** FHWA Series E(M) 字符类（fill 模式压缩到实测 ink 尺寸）。 */
function usClass(id: string, color: string, height = CAP, width = GLYPH_W) {
  return {
    id,
    height,
    width,
    advance: width,
    fit: 'fill' as const,
    stroke: STROKE,
    fill: { kind: 'solid' as const, color },
    font: roadgeek,
  };
}

const CITATION =
  '1956 AMA 统一协议（6×12in）+ FHWA Series E Modified；字体 Roadgeek 2014 EM（MIT）';

function usType(opts: {
  id: string;
  label: string;
  bg?: string;
  fg?: string;
  codeDefault: string;
  placeholder: string;
  help: string;
  sample: string;
  maxLength?: number;
  pattern: RegExp;
}): PlateType {
  const bg = opts.bg ?? US_COLORS.white;
  const fg = opts.fg ?? US_COLORS.black;
  return {
    id: opts.id,
    label: opts.label,
    citation: CITATION,
    size: { width: PLATE.w, height: PLATE.h },
    body: { fill: { kind: 'solid', color: bg }, radius: PLATE.radius },
    // 浮雕边框：内缩 6.4mm、线宽 1.8mm（约定值，非强制）；设为 0 即平印
    border: { width: 1.8, fill: { kind: 'solid', color: fg } },
    charClasses: {
      letter: usClass('letter', fg),
      digit: usClass('digit', fg),
      other: usClass('other', fg),
    },
    runs: [
      {
        kind: 'free',
        primary: true,
        // 序列整体居中（各州边距不一，居中更通用）；左右各留 12mm 边距
        origin: { x: 12, y: (PLATE.h - CAP) / 2 },
        gap: GAP,
        field: 'code',
        auto: { digit: 'digit', letter: 'letter', other: 'other' },
        align: 'center',
        width: PLATE.w - 2 * 12, // 对齐框宽 = 牌宽 - 左右边距
        shrinkToFit: true, // 6–8 位字符自适应压缩
      },
    ],
    decorations: [
      {
        kind: 'screws',
        positions: [
          { x: (PLATE.w - HOLE_SPACING) / 2, y: HOLE_Y },
          { x: (PLATE.w + HOLE_SPACING) / 2, y: HOLE_Y },
        ],
        r: HOLE_D / 2,
        height: HOLE_D, // 圆孔 φ7
        fill: '#E8E8E8',
        stroke: '#999999',
      },
    ],
    fields: [
      {
        key: 'code',
        label: '注册号',
        maxLength: opts.maxLength ?? 7,
        charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
        placeholder: opts.placeholder,
        help: opts.help,
      },
    ],
    defaults: { code: opts.codeDefault },
    sample: opts.sample,
    pattern: opts.pattern,
  };
}

const types: PlateType[] = [
  usType({
    id: 'us-standard',
    label: '标准（白底黑字）',
    codeDefault: 'ABC-1234',
    placeholder: 'ABC-1234',
    help: '通用 6–7 位字母数字，可含连字符',
    sample: 'ABC-1234',
    maxLength: 8,
    pattern: /^[A-Z0-9-]{1,8}$/,
  }),
  usType({
    id: 'us-6',
    label: '6 位（ABC123）',
    codeDefault: 'ABC123',
    placeholder: 'ABC123',
    help: '3 字母 + 3 数字',
    sample: 'ABC123',
    maxLength: 6,
    pattern: /^[A-Z]{3}[0-9]{3}$/,
  }),
  usType({
    id: 'us-blue',
    label: '蓝底白字',
    bg: '#1B3A8C',
    fg: '#FFFFFF',
    codeDefault: 'ABC-1234',
    placeholder: 'ABC-1234',
    help: '常见州别配色之一',
    sample: 'ABC-1234',
    maxLength: 8,
    pattern: /^[A-Z0-9-]{1,8}$/,
  }),
  usType({
    id: 'us-green',
    label: '绿底白字',
    bg: '#1E5B3A',
    fg: '#FFFFFF',
    codeDefault: 'ABC-1234',
    placeholder: 'ABC-1234',
    help: '常见州别配色之一',
    sample: 'ABC-1234',
    maxLength: 8,
    pattern: /^[A-Z0-9-]{1,8}$/,
  }),
  usType({
    id: 'us-yellow',
    label: '黄底黑字',
    bg: '#F5C518',
    fg: '#111111',
    codeDefault: 'ABC-1234',
    placeholder: 'ABC-1234',
    help: '常见州别配色之一（如出租车/工程车）',
    sample: 'ABC-1234',
    maxLength: 8,
    pattern: /^[A-Z0-9-]{1,8}$/,
  }),
];

export const usStandard: Standard = {
  region: 'US',
  name: '美国',
  citation: '1956 AMA 6×12in 统一协议 + FHWA Series E Modified',
  types: [...usStateTypes, ...types],
};

export const US_GEOM = {
  PLATE,
  CAP,
  STROKE,
  GLYPH_W,
  PITCH,
  GAP,
  HOLE_SPACING,
  HOLE_D,
  HOLE_Y,
  IN,
};
