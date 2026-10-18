/**
 * 中国机动车号牌标准 —— GA 36-2018《中华人民共和国机动车号牌》。
 *
 * 数据来源：GA 36-2018 标准正文（扫描件逐图实测；原件不入库）。
 *
 * - 表1：号牌种类、外廓尺寸、颜色（17 类 + 临时入境系列）
 *   汽车类 440×140（大型汽车后号牌/挂车 440×220；新能源 480×140）
 *   摩托车类 220×140；低速车 300×165
 * - 第 5 章「式样」各图给出字符单元格与间距的**权威毫米标注**，本文所有
 *   `width / height / gapAfter` 均直接取自这些标注，而非凭观感估计：
 *   图1 小型汽车（京A·F0236）：字高 90，单元格 45，间隔 12，分隔点直径 10
 *   图2 使馆（224·578使）：同上，点在第三位后
 *   图4/图5 警用：点在省简称后
 *   图6 大型汽车后号牌/挂车（440×220）：上行 京·A（80×60，间隔 25+10+25），
 *        下行 5 位序号（65×110，间隔 15）
 *   图7/图8 新能源（480×140）：省 45×90，代号与序号 43×90，间隔 9，组间 49
 *   图9 普通/轻便/教练摩托车（220×140）：上行 京·A（50×50，点区 10+10+10），
 *        下行 5 位序号（30×60，间隔 10）；行距 10，上下留白 10
 *   图19 低速车（300×165）：上行 京·M（45 高），下行 5 位（90 高）
 *
 * 字符颜色：表1「颜色」列；新能源按「小型 渐变绿底黑字 / 大型 黄绿底黑字」。
 * 序号字符集：表3 明确「序号中不使用英文字母 O 和 I」。
 */

import { FONTS } from '@/lib/plate/fonts';
import type {
  CharClass,
  Fill,
  FontRef,
  GlyphFit,
  PlateType,
  Run,
  Standard,
} from '@/types/standard';

// ── 颜色（表1）────────────────────────────────────────────────
export const CN_COLORS = {
  blue: '#1E4DB7', // 蓝底（PANTONE 294C 近似）
  yellow: '#F6C500', // 黄底（PANTONE Yellow 012C 近似）
  green: '#4CAF50', // 新能源渐变绿（下缘）
  greenTop: '#F7FBF2', // 新能源渐变绿（上缘，近白）
  yellowGreen: '#C9D93B', // 大型新能源上缘（黄绿）
  black: '#111111',
  white: '#FFFFFF',
  red: '#E60012', // 警/使/领/应急 用红字
  tempBlue: '#BCD9F0', // 临时行驶车「天（酞）蓝底纹」近似
  neOrange: '#E99F34', // 大型新能源 左幅橙
  neGreen: '#25E148', // 新能源绿
} as const;

const solid = (color: string): Fill => ({ kind: 'solid', color });

// 新能源渐变（表1：小型「渐变绿底」、大型「黄绿底」）
// 小型牌底色自下而上分三段：底部 50% 纯绿 → 50%~83.33% 绿白渐变 → 顶部 16.67% 纯白。
// 渐变 stop 方向为上→下（angle 180），换算后：0~1/6 白、1/6~1/2 白→绿、1/2~1 纯绿。
const neSmallFill: Fill = {
  kind: 'gradient',
  angle: 180,
  stops: [
    { at: 0, color: CN_COLORS.white },
    { at: 1 / 6, color: CN_COLORS.white },
    { at: 1 / 2, color: CN_COLORS.neGreen },
    { at: 1, color: CN_COLORS.neGreen },
  ],
};

// ── 字体 ────────────────────────────────────────────────────
const latin = FONTS.latin; // 号牌专用字体：数字/字母
const han = FONTS.han; // 汉字（号牌模具为专用黑体）
// 新能源号牌专用拉丁字形：与普通号牌不同，`1` 带衬线（防涂改/易辨识）
const cnELatin = FONTS.cnELatin;

// ── 外廓尺寸与圆角（表1 + 各「式样」图）──────────────────────
// 边框线宽：GA 36 规定 1.5mm；渲染加粗到 2mm，更贴近实牌观感
const CAR = { w: 440, h: 140, r: 10, border: 2 };
const CAR_REAR = { w: 440, h: 220, r: 10, border: 2 };
const NE = { w: 480, h: 140, r: 10, border: 2 };
const MOTO = { w: 220, h: 140, r: 8, border: 2 };
const TEMP = { w: 220, h: 140, r: 8, border: 2 };

/**
 * 中国号牌边框。
 *
 * - 几何（GA 36-2018 图1 尺寸链）：牌边向内 3mm 为底色，再向内是白边（1.5mm，渲染加粗到 2mm），
 *   即边框线外缘距牌边 3mm，外侧留一圈板体底色的细边；
 * - 号牌为整块金属板冲压成型，边框与字符同为凸起面，开启「模拟冲压」时一并进入浮雕；
 * - 其它国家为印刷描边，不参与。
 */
function cnBorder(width: number, color: string): PlateType['border'] {
  return { width, fill: solid(color), inset: 3, emboss: true };
}

const PROV = '京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿';
/** 表3：序号中不使用 I、O。 */
const SERIAL_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// ── 字符类构造器 ────────────────────────────────────────────
interface ClassOpts {
  width: number;
  height: number;
  color: string;
  /** 该字符之后的间隔（mm） */
  gapAfter?: number;
  font?: FontRef;
  stroke?: number;
  /** 额外描边（mm），把社区字库的笔画补到标准粗细 */
  outline?: number;
  /** 横向补偿加粗（mm），抵消各向异性压缩对竖画的变细 */
  hBold?: number;
  /** 拟合方式：默认等比；两行版式的「扁」字行用 cellFill */
  fit?: GlyphFit;
  /**
   * 按单元格宽度撑满（两行版式的「扁」字）：
   * 以数字 0 为参考撑满单元格宽，其余字形按同一系数缩放（`1` 仍保持窄）。
   */
  cellFill?: boolean;
  id?: string;
}

function mkClass(id: string, o: ClassOpts): CharClass {
  return {
    id,
    height: o.height,
    width: o.width,
    advance: o.width,
    fit: o.fit ?? 'uniform',
    // 号牌字体数字 0 的 ink 宽高比约 0.494；cellFill 时据此把 0 撑满单元格
    xScale: o.cellFill ? o.width / (0.494 * o.height) : undefined,
    stroke: o.stroke,
    outline: o.outline,
    hBold: o.hBold,
    gapAfter: o.gapAfter,
    fill: solid(o.color),
    font: o.font ?? latin,
  };
}

/**
 * 汽车单行版（440×140 / 480×140）的字符类。
 *
 * 间隔取自 GA 36-2018 图1 实测：普通字符间 12mm；分隔点占据 12+10+12 = 34mm，
 * 用加宽的 `gapAfter` 表达（`*Wide` 类），分隔点本身由 CnDot 在间隙内矢量绘制。
 */
function carClasses(o: {
  fg: string;
  /** 省简称单元格宽（440 版 45，新能源 480 版 45） */
  hanW?: number;
  /** 代号与序号单元格宽（440 版 45，新能源 480 版 43） */
  cellW?: number;
  height?: number;
  /** 普通间隔 */
  gap?: number;
  /** 含分隔点的加宽间隔 */
  wideGap?: number;
  /**
   * 字母/数字字体。缺省为普通号牌字体；新能源号牌传入 `cnELatin`，
   * 其 `1` 为衬线字形，缺失字符按字体回退链取 CN 号牌字形。
   */
  latinFont?: FontRef;
}) {
  const hanW = o.hanW ?? 45;
  const cellW = o.cellW ?? 45;
  const height = o.height ?? 90;
  const gap = o.gap ?? 12;
  const wideGap = o.wideGap ?? 34;

  return {
    hanzi: mkClass('hanzi', {
      width: hanW,
      height,
      color: o.fg,
      gapAfter: gap,
      font: han,
      stroke: 12,
    }),
    hanziWide: mkClass('hanziWide', {
      width: hanW,
      height,
      color: o.fg,
      gapAfter: wideGap,
      font: han,
      stroke: 12,
    }),
    letter: mkClass('letter', {
      width: cellW,
      height,
      color: o.fg,
      gapAfter: gap,
      font: o.latinFont,
    }),
    letterWide: mkClass('letterWide', {
      width: cellW,
      height,
      color: o.fg,
      gapAfter: wideGap,
      font: o.latinFont,
    }),
    serial: mkClass('serial', {
      width: cellW,
      height,
      color: o.fg,
      gapAfter: gap,
      font: o.latinFont,
    }),
    suffix: mkClass('suffix', {
      width: hanW,
      height,
      color: o.fg,
      gapAfter: 0,
      font: han,
      stroke: 12,
    }),
    suffixRed: mkClass('suffixRed', {
      width: hanW,
      height,
      color: CN_COLORS.red,
      gapAfter: 0,
      font: han,
      stroke: 12,
    }),
  } as Record<string, CharClass>;
}

// ── 字段规格 ────────────────────────────────────────────────
const fProv = {
  key: 'province',
  label: '发牌机关（省）',
  maxLength: 1,
  charset: PROV,
  placeholder: '京',
  help: '省、自治区、直辖市简称',
};
const fLetter = {
  key: 'letter',
  label: '发牌机关代号',
  maxLength: 1,
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  placeholder: 'A',
};
const fSerial = (n: number, help?: string) => ({
  key: 'serial',
  label: '序号',
  maxLength: n,
  charset: SERIAL_CHARS,
  placeholder: '0'.repeat(n),
  help: help ?? `序号 ${n} 位（不含字母 I、O）`,
});

// ── 分隔点装饰 ──────────────────────────────────────────────
function dotDeco(after = 1, color = '#FFFFFF', runIndex = 0) {
  return { kind: 'component' as const, name: 'cn-dot', props: { runIndex, after, r: 5, color } };
}

// ── 安装孔（表1 图1：孔中心距左右边 107.5，距上下边 12.5）──────
function carScrews(w = CAR.w, h = CAR.h) {
  const xL = 107.5;
  const xR = w - 107.5;
  const yT = 12.5;
  const yB = h - 12.5;
  return {
    kind: 'screws' as const,
    positions: [
      { x: xL, y: yT },
      { x: xR, y: yT },
      { x: xL, y: yB },
      { x: xR, y: yB },
    ],
    r: 7.5, // 长圆孔 15×7mm（图1 顶部尺寸链中的 15 为槽宽）
    height: 7,
    fill: '#FFFFFF',
    stroke: '#999999',
  };
}

function motoScrews() {
  return {
    kind: 'screws' as const,
    positions: [
      { x: 25, y: 15 },
      { x: MOTO.w - 25, y: 15 },
    ],
    r: 3.5, // 圆孔 φ7（图9：2×φ7）
    height: 7,
    fill: '#FFFFFF',
    stroke: '#999999',
  };
}

// ── 版式构造器 ──────────────────────────────────────────────

/** 440×140 单行汽车版：7 个 45mm 单元格，分隔点在 `dotAfter` 所指字符之后。 */
function carRun(opts: {
  dotAfter: 0 | 1;
  serials: number;
  suffixLiteral?: string;
  suffixRed?: boolean;
}) {
  const slots: { classId: string; field?: string; charIndex?: number; literal?: string }[] = [];
  if (opts.dotAfter === 0) {
    slots.push({ classId: 'hanziWide', field: 'province', charIndex: 0 });
    slots.push({ classId: 'letter', field: 'letter', charIndex: 0 });
  } else {
    slots.push({ classId: 'hanzi', field: 'province', charIndex: 0 });
    slots.push({ classId: 'letterWide', field: 'letter', charIndex: 0 });
  }
  for (let i = 0; i < opts.serials; i++) {
    slots.push({ classId: 'serial', field: 'serial', charIndex: i });
  }
  if (opts.suffixLiteral) {
    slots.push({
      classId: opts.suffixRed ? 'suffixRed' : 'suffix',
      literal: opts.suffixLiteral,
    });
  }
  return {
    kind: 'run' as const,
    primary: true,
    origin: { x: 0, y: (CAR.h - 90) / 2 },
    gap: 12,
    align: 'center' as const,
    slots,
  };
}

/** 440×220 双行版（大型汽车后号牌 / 挂车号牌），见图6。 */
function carRearRuns(suffixLiteral?: string): Run[] {
  const serials = suffixLiteral ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const bottom: { classId: string; field?: string; charIndex?: number; literal?: string }[] =
    serials.map((i) => ({ classId: 'bigSerial', field: 'serial', charIndex: i }));
  if (suffixLiteral) bottom.push({ classId: 'bigSuffix', literal: suffixLiteral });
  return [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 15 },
      gap: 25,
      align: 'center',
      slots: [
        { classId: 'bigHanzi', field: 'province', charIndex: 0 },
        { classId: 'bigLetter', field: 'letter', charIndex: 0 },
      ],
    },
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 90 },
      gap: 15,
      align: 'center',
      slots: bottom,
    },
  ];
}

function rearClasses(fg: string) {
  // 两行版式：字宽与字高由单元格决定，字形按单元格拉伸（上行「扁」字）
  const s = (id: string, w: number, h: number, gapAfter: number, font: FontRef = latin) =>
    mkClass(id, { width: w, height: h, color: fg, gapAfter, font, cellFill: true });
  return {
    // 上行 京·A：单元格 80×60，点区 25+10+25
    bigHanzi: s('bigHanzi', 80, 60, 60, han),
    bigLetter: s('bigLetter', 80, 60, 0),
    // 下行 5 位序号：65×110，间隔 15
    bigSerial: s('bigSerial', 65, 110, 15),
    // 尾字（挂车「挂」）：同单元格
    bigSuffix: s('bigSuffix', 65, 110, 0, han),
  } as Record<string, CharClass>;
}

/**
 * 220×140 双行摩托车版（图9/图10/图11/图12）：
 * 上行 省·代号（50×50，点区 30），下行序号（30×60，间隔 10）。
 * 下行末尾可再带一个汉字（教练「学」、警用「警」）。
 */
function motoRuns(opts: {
  serials: number;
  topRight: 'letter' | 'suffix';
  topSuffixLiteral?: string;
  topSuffixRed?: boolean;
  bottomSuffixLiteral?: string;
  bottomSuffixRed?: boolean;
}) {
  const topSlots: { classId: string; field?: string; charIndex?: number; literal?: string }[] = [
    { classId: 'motoHanzi', field: 'province', charIndex: 0 },
  ];
  if (opts.topRight === 'letter') {
    topSlots.push({ classId: 'motoLetter', field: 'letter', charIndex: 0 });
  } else {
    topSlots.push({
      classId: opts.topSuffixRed ? 'motoSuffixRed' : 'motoSuffix',
      literal: opts.topSuffixLiteral ?? '领',
    });
  }
  const bottomSlots: typeof topSlots = [];
  for (let i = 0; i < opts.serials; i++) {
    bottomSlots.push({ classId: 'motoSerial', field: 'serial', charIndex: i });
  }
  if (opts.bottomSuffixLiteral) {
    bottomSlots.push({
      classId: 'motoBottomSuffix',
      literal: opts.bottomSuffixLiteral,
    });
  }
  return [
    {
      kind: 'run' as const,
      primary: true,
      origin: { x: 0, y: 10 },
      gap: 30,
      align: 'center' as const,
      slots: topSlots,
    },
    {
      kind: 'run' as const,
      primary: true,
      origin: { x: 0, y: 70 },
      gap: 10,
      align: 'center' as const,
      slots: bottomSlots,
    },
  ];
}

function motoClasses(fg: string) {
  // 上行 京·A 为「扁」字（50×50），下行序号 30×60；均按单元格拉伸
  const s = (id: string, w: number, h: number, gapAfter: number, font: FontRef = latin) =>
    mkClass(id, { width: w, height: h, color: fg, gapAfter, font, cellFill: true });
  return {
    motoHanzi: s('motoHanzi', 50, 50, 30, han),
    motoLetter: s('motoLetter', 50, 50, 0),
    motoSuffix: s('motoSuffix', 50, 50, 0, han),
    // 底行尾字（教练「学」/警用「警」）：单元格 30×60
    motoBottomSuffix: s('motoBottomSuffix', 30, 60, 0, han),
    motoSuffixRed: mkClass('motoSuffixRed', {
      width: 50,
      height: 50,
      color: CN_COLORS.red,
      gapAfter: 0,
      font: han,
      stroke: 12,
      cellFill: true,
    }),
    motoSerial: s('motoSerial', 30, 60, 10),
  } as Record<string, CharClass>;
}

const types: PlateType[] = [];

// ── 1. 小型汽车号牌（蓝底白字，440×140）── 表1-4 / 图1 ──────
types.push({
  id: 'cn-small-car',
  label: '小型汽车号牌',
  citation: 'GA 36-2018 表1-4 / 图1（440×140，蓝底白字，字高 90）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.blue), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.white),
  charClasses: carClasses({ fg: CN_COLORS.white }),
  runs: [carRun({ dotAfter: 1, serials: 5 })],
  decorations: [carScrews(), dotDeco(1, CN_COLORS.white)],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// ── 2. 大型汽车号牌（前，黄底黑字 440×140）── 表1 / 图1 ──────
types.push({
  id: 'cn-large-car',
  label: '大型汽车号牌（前）',
  citation: 'GA 36-2018 表1 / 图1（前号牌 440×140，黄底黑字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.black),
  charClasses: carClasses({ fg: CN_COLORS.black }),
  runs: [carRun({ dotAfter: 1, serials: 5 })],
  decorations: [carScrews(), dotDeco(1, CN_COLORS.black)],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// ── 3. 大型汽车号牌（后，黄底黑字 440×220）── 表1 / 图6 ──────
types.push({
  id: 'cn-large-car-rear',
  label: '大型汽车号牌（后）',
  citation: 'GA 36-2018 表1 / 图6（后号牌 440×220，两行，黄底黑字）',
  size: { width: CAR_REAR.w, height: CAR_REAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR_REAR.r },
  border: cnBorder(CAR_REAR.border, CN_COLORS.black),
  charClasses: { ...carClasses({ fg: CN_COLORS.black }), ...rearClasses(CN_COLORS.black) },
  runs: carRearRuns(),
  decorations: [carScrews(CAR_REAR.w, CAR_REAR.h), dotDeco(0, CN_COLORS.black, 0)],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'A', serial: 'F0236' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京·A / F0236',
});

// ── 4. 挂车号牌（黄底黑字 440×220）── 表1 / 图6 ──────────────
types.push({
  id: 'cn-trailer',
  label: '挂车号牌',
  citation: 'GA 36-2018 表1 / 图6（挂车 440×220，两行，黄底黑字）',
  size: { width: CAR_REAR.w, height: CAR_REAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR_REAR.r },
  border: cnBorder(CAR_REAR.border, CN_COLORS.black),
  charClasses: { ...carClasses({ fg: CN_COLORS.black }), ...rearClasses(CN_COLORS.black) },
  runs: carRearRuns('挂'),
  decorations: [carScrews(CAR_REAR.w, CAR_REAR.h), dotDeco(0, CN_COLORS.black, 0)],
  fields: [fProv, fLetter, fSerial(4)],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{4}挂$/,
  sample: '京·A / 0001挂',
});

// ── 5/6. 新能源号牌（480×140）── 表1 / 图7 / 图8 ────────────
function neType(opts: {
  id: string;
  label: string;
  fill: Fill;
  /** 大型新能源：左幅橙、右幅绿的双色底 */
  twoTone?: boolean;
  defaultSerial: string;
  help: string;
  sample: string;
}): PlateType {
  return {
    id: opts.id,
    label: opts.label,
    citation: 'GA 36-2018 表1 / 图7 / 图8（480×140，新能源，字高 90）',
    size: { width: NE.w, height: NE.h },
    body: { fill: opts.fill, radius: NE.r },
    border: cnBorder(NE.border, CN_COLORS.black),
    // 新能源：字母/数字使用专用字形（`1` 带衬线），省简称仍用号牌汉字字体
    charClasses: carClasses({
      fg: CN_COLORS.black,
      hanW: 45,
      cellW: 43,
      gap: 9,
      wideGap: 49,
      latinFont: cnELatin,
    }),
    runs: [
      {
        kind: 'run',
        primary: true,
        origin: { x: 0, y: (NE.h - 90) / 2 },
        gap: 9,
        align: 'center',
        slots: [
          { classId: 'hanzi', field: 'province', charIndex: 0 },
          { classId: 'letterWide', field: 'letter', charIndex: 0 },
          ...[0, 1, 2, 3, 4, 5].map((i) => ({ classId: 'serial', field: 'serial', charIndex: i })),
        ],
      },
    ],
    decorations: [
      ...(opts.twoTone
        ? [
            {
              kind: 'component' as const,
              name: 'cn-ne-panel',
              // 上下各留 8mm：不顶着黑色边框（边框内缘在 4.5mm），与实测图比例一致
              props: {
                x: 137,
                y: 8,
                width: NE.w - 137 - 5,
                height: NE.h - 16,
                radius: 10,
                color: CN_COLORS.neGreen,
              },
            },
          ]
        : []),
      carScrews(NE.w, NE.h),
      { kind: 'component' as const, name: 'cn-ne-emblem', props: { cx: 137, cy: 70, r: 14 } },
    ],
    fields: [fProv, fLetter, { ...fSerial(6), placeholder: opts.defaultSerial, help: opts.help }],
    defaults: { province: '京', letter: 'A', serial: opts.defaultSerial },
    pattern:
      /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{6}$/,
    sample: opts.sample,
  };
}

types.push(
  neType({
    id: 'cn-ne-small',
    label: '小型新能源汽车号牌',
    fill: neSmallFill,
    defaultSerial: 'D12345',
    help: '6 位：首位为 D/F 等字母（表5/表6）',
    sample: '京A D12345',
  }),
);

types.push(
  neType({
    id: 'cn-ne-large',
    label: '大型新能源汽车号牌',
    fill: solid(CN_COLORS.yellow),
    twoTone: true,
    defaultSerial: '12345D',
    help: '6 位：末位为 D/A/B/C/E 字母（表5）',
    sample: '京A 12345D',
  }),
);

// ── 7. 教练汽车号牌（黄底黑字，末位「学」，4 位序号）──────────
types.push({
  id: 'cn-coach',
  label: '教练汽车号牌',
  citation: 'GA 36-2018 表1 / 图1（黄底黑字，末位「学」）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.black),
  charClasses: carClasses({ fg: CN_COLORS.black }),
  runs: [carRun({ dotAfter: 1, serials: 4, suffixLiteral: '学' })],
  decorations: [carScrews(), dotDeco(1, CN_COLORS.black)],
  fields: [fProv, fLetter, fSerial(4)],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{4}学$/,
  sample: '京A·0001学',
});

// ── 8. 警用汽车号牌（白底黑字，红「警」，点在省后）────────────
types.push({
  id: 'cn-police',
  label: '警用汽车号牌',
  citation: 'GA 36-2018 表1 / 图4（白底黑字，红「警」，点在省简称后）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.white), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.black),
  charClasses: carClasses({ fg: CN_COLORS.black }),
  runs: [carRun({ dotAfter: 0, serials: 4, suffixLiteral: '警', suffixRed: true })],
  decorations: [carScrews(), dotDeco(0, CN_COLORS.black)],
  fields: [fProv, fLetter, fSerial(4, '序号 4 位，格式：京·A0001警')],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{4}警$/,
  sample: '京·A0001警',
});

// ── 10. 使馆汽车号牌（黑底白字，红「使」，点在第三位后）───────
types.push({
  id: 'cn-embassy',
  label: '使馆汽车号牌',
  citation: 'GA 36-2018 表1 / 图2（黑底白字，红「使」，点在驻华机构编号后）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.black), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.white),
  charClasses: carClasses({ fg: CN_COLORS.white }),
  runs: [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: (CAR.h - 90) / 2 },
      gap: 12,
      align: 'center',
      slots: [
        ...[0, 1, 2].map((i) => ({ classId: 'serial', field: 'serial1', charIndex: i })),
        ...[0, 1, 2].map((i) => ({ classId: 'serial', field: 'serial2', charIndex: i })),
        { classId: 'suffixRed', literal: '使' },
      ],
    },
  ],
  decorations: [carScrews(), dotDeco(2, CN_COLORS.white)],
  fields: [
    {
      key: 'serial1',
      label: '驻华机构编号',
      maxLength: 3,
      charset: '0123456789',
      placeholder: '224',
    },
    { key: 'serial2', label: '序号', maxLength: 3, charset: '0123456789', placeholder: '578' },
  ],
  defaults: { serial1: '224', serial2: '578' },
  pattern: /^[0-9]{3}[0-9]{3}使$/,
  sample: '224·578使',
});

// ── 11. 领馆汽车号牌（黑底白字，红「领」）───────────────────
types.push({
  id: 'cn-consulate',
  label: '领馆汽车号牌',
  citation: 'GA 36-2018 表1 / 图3（黑底白字，红「领」，点在城市代码后）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.black), radius: CAR.r },
  border: cnBorder(CAR.border, CN_COLORS.white),
  charClasses: carClasses({ fg: CN_COLORS.white }),
  runs: [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: (CAR.h - 90) / 2 },
      gap: 12,
      align: 'center',
      slots: [
        { classId: 'hanzi', field: 'province', charIndex: 0 },
        ...[0, 1, 2].map((i) => ({ classId: 'serial', field: 'serial1', charIndex: i })),
        ...[0, 1].map((i) => ({ classId: 'serial', field: 'serial2', charIndex: i })),
        { classId: 'suffixRed', literal: '领' },
      ],
    },
  ],
  decorations: [carScrews(), dotDeco(3, CN_COLORS.white)],
  fields: [
    fProv,
    {
      key: 'serial1',
      label: '驻华外交机构编号',
      maxLength: 3,
      charset: '0123456789',
      placeholder: '224',
    },
    { key: 'serial2', label: '序号', maxLength: 2, charset: '0123456789', placeholder: '78' },
  ],
  defaults: { province: '沪', serial1: '224', serial2: '78' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][0-9]{3}[0-9]{2}领$/,
  sample: '沪224·78领',
});

// ── 12/13. 港澳入出境车号牌（黑底白字，末位「港」/「澳」）─────
for (const [id, ch, label] of [
  ['cn-hk', '港', '港澳入出境车号牌（港）'],
  ['cn-mo', '澳', '港澳入出境车号牌（澳）'],
] as const) {
  types.push({
    id,
    label,
    citation: 'GA 36-2018 表1 / 图1（港澳入出境车，黑底白字，末位「港」/「澳」）',
    size: { width: CAR.w, height: CAR.h },
    body: { fill: solid(CN_COLORS.black), radius: CAR.r },
    border: cnBorder(CAR.border, CN_COLORS.white),
    charClasses: carClasses({ fg: CN_COLORS.white }),
    runs: [carRun({ dotAfter: 1, serials: 4, suffixLiteral: ch })],
    decorations: [carScrews(), dotDeco(1, CN_COLORS.white)],
    fields: [fProv, fLetter, fSerial(4)],
    defaults: { province: '粤', letter: 'Z', serial: '0001' },
    pattern: new RegExp(`^粤[A-Z][0-9A-Z]{4}${ch}$`),
    sample: `粤Z·0001${ch}`,
  });
}

// ── 14. 普通摩托车号牌（黄底黑字，220×140，两行）图9 ──────────
types.push({
  id: 'cn-moto',
  label: '普通摩托车号牌',
  citation: 'GA 36-2018 表1 / 图9（220×140，两行：京·A / 5 位序号，黄底黑字）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.yellow), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.black),
  charClasses: motoClasses(CN_COLORS.black),
  runs: motoRuns({ serials: 5, topRight: 'letter' }),
  decorations: [motoScrews(), dotDeco(0, CN_COLORS.black, 0)],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'A', serial: 'A0062' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京·A / A0062',
});

// ── 15. 轻便摩托车号牌（蓝底白字，220×140，两行）表1 ─────────
types.push({
  id: 'cn-moped',
  label: '轻便摩托车号牌',
  citation: 'GA 36-2018 表1 / 图9（220×140，两行，蓝底白字）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.blue), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.white),
  charClasses: motoClasses(CN_COLORS.white),
  runs: motoRuns({ serials: 5, topRight: 'letter' }),
  decorations: [motoScrews(), dotDeco(0, CN_COLORS.white, 0)],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京·A / 00001',
});

// ── 16. 教练摩托车号牌（黄底黑字，220×140，两行）表1 ─────────
types.push({
  id: 'cn-coach-moto',
  label: '教练摩托车号牌',
  citation: 'GA 36-2018 表1 / 图9（220×140，两行，黄底黑字）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.yellow), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.black),
  charClasses: motoClasses(CN_COLORS.black),
  runs: motoRuns({ serials: 4, topRight: 'letter', bottomSuffixLiteral: '学' }),
  decorations: [motoScrews(), dotDeco(0, CN_COLORS.black, 0)],
  fields: [fProv, fLetter, fSerial(4)],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{4}学$/,
  sample: '京·A / 0001学',
});

// ── 17. 警用摩托车号牌（白底黑字，红「警」，220×140）图12 ────
types.push({
  id: 'cn-police-moto',
  label: '警用摩托车号牌',
  citation: 'GA 36-2018 表1 / 图12（220×140，两行，白底黑字，红「警」）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.white), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.black),
  charClasses: motoClasses(CN_COLORS.black),
  runs: motoRuns({
    serials: 4,
    topRight: 'letter',
    bottomSuffixLiteral: '警',
    bottomSuffixRed: true,
  }),
  decorations: [motoScrews(), dotDeco(0, CN_COLORS.black, 0)],
  fields: [fProv, fLetter, fSerial(4)],
  defaults: { province: '京', letter: 'A', serial: '0006' },
  pattern:
    /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{4}警$/,
  sample: '京·A / 0006警',
});

// ── 使馆摩托车号牌（黑底白字，220×140，两行）图10 ───────────
types.push({
  id: 'cn-embassy-moto',
  label: '使馆摩托车号牌',
  citation: 'GA 36-2018 表1 / 图10（220×140，两行，黑底白字，红「使」）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.black), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.white),
  charClasses: {
    ...motoClasses(CN_COLORS.white),
    motoSerialWide: mkClass('motoSerialWide', {
      width: 35,
      height: 48,
      color: CN_COLORS.white,
      gapAfter: 12.5,
      cellFill: true,
    }),
  },
  runs: [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 11.5 },
      gap: 12.5,
      align: 'center',
      slots: [0, 1, 2].map((i) => ({ classId: 'motoSerialWide', field: 'serial1', charIndex: i })),
    },
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 79.5 },
      gap: 12.5,
      align: 'center',
      slots: [
        ...[0, 1, 2].map((i) => ({ classId: 'motoSerialWide', field: 'serial2', charIndex: i })),
        { classId: 'motoSuffixRed', literal: '使' },
      ],
    },
  ],
  decorations: [motoScrews()],
  fields: [
    {
      key: 'serial1',
      label: '驻华机构编号',
      maxLength: 3,
      charset: '0123456789',
      placeholder: '224',
    },
    { key: 'serial2', label: '序号', maxLength: 3, charset: '0123456789', placeholder: '578' },
  ],
  defaults: { serial1: '224', serial2: '578' },
  pattern: /^[0-9]{3}[0-9]{3}使$/,
  sample: '224 / 578使',
});

// ── 领馆摩托车号牌（黑底白字，220×140，两行）图11 ───────────
types.push({
  id: 'cn-consulate-moto',
  label: '领馆摩托车号牌',
  citation: 'GA 36-2018 表1 / 图11（220×140，两行，沪·领 / 5 位序号）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.black), radius: MOTO.r },
  border: cnBorder(MOTO.border, CN_COLORS.white),
  charClasses: motoClasses(CN_COLORS.white),
  runs: motoRuns({ serials: 5, topRight: 'suffix', topSuffixLiteral: '领', topSuffixRed: true }),
  decorations: [motoScrews(), dotDeco(0, CN_COLORS.white, 0)],
  fields: [fProv, fSerial(5)],
  defaults: { province: '沪', serial: '22478' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿]领[0-9]{5}$/,
  sample: '沪·领 / 22478',
});

// ── 低速车号牌（黄底黑字，300×165，两行）图19 ───────────────
types.push({
  id: 'cn-low-speed',
  label: '低速车号牌',
  citation: 'GA 36-2018 表1 / 图19（300×165，两行：京·M / 5 位序号，黄底黑字）',
  size: { width: 300, height: 165 },
  body: { fill: solid(CN_COLORS.yellow), radius: 10 },
  border: cnBorder(2, CN_COLORS.black),
  charClasses: {
    lowHanzi: mkClass('lowHanzi', {
      width: 45,
      height: 45,
      color: CN_COLORS.black,
      gapAfter: 34,
      font: han,
      stroke: 10,
      cellFill: true,
    }),
    lowLetter: mkClass('lowLetter', {
      width: 45,
      height: 45,
      color: CN_COLORS.black,
      gapAfter: 0,
      cellFill: true,
    }),
    lowSerial: mkClass('lowSerial', {
      width: 45,
      height: 90,
      color: CN_COLORS.black,
      gapAfter: 12,
      cellFill: true,
    }),
  },
  runs: [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 10 },
      gap: 34,
      align: 'center',
      slots: [
        { classId: 'lowHanzi', field: 'province', charIndex: 0 },
        { classId: 'lowLetter', field: 'letter', charIndex: 0 },
      ],
    },
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: 65 },
      gap: 12,
      align: 'center',
      slots: [0, 1, 2, 3, 4].map((i) => ({ classId: 'lowSerial', field: 'serial', charIndex: i })),
    },
  ],
  decorations: [
    {
      kind: 'screws',
      positions: [
        { x: 15, y: 12.5 },
        { x: 285, y: 12.5 },
      ],
      r: 7.5,
      height: 7,
      fill: '#FFFFFF',
      stroke: '#999999',
    },
    dotDeco(0, CN_COLORS.black, 0),
  ],
  fields: [fProv, fLetter, fSerial(5)],
  defaults: { province: '京', letter: 'M', serial: '00000' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9A-Z]{5}$/,
  sample: '京·M / 00000',
});

// ── 18. 临时行驶车号牌（220×140，纸质，天蓝底纹）──────────────
types.push({
  id: 'cn-temp',
  label: '临时行驶车号牌',
  citation: 'GA 36-2018 表1 / 附录 B.19（220×140，纸质，天（酞）蓝底纹黑字）',
  size: { width: TEMP.w, height: TEMP.h },
  body: { fill: solid(CN_COLORS.tempBlue), radius: TEMP.r },
  border: cnBorder(TEMP.border, CN_COLORS.black),
  charClasses: {
    // 220mm 内排 7 个字：30 + 6×27 + 6×3.5 = 213mm，左右各留 3.5mm
    hanzi: mkClass('hanzi', {
      width: 30,
      height: 60,
      color: CN_COLORS.black,
      gapAfter: 3.5,
      font: han,
      stroke: 12,
      cellFill: true,
    }),
    letter: mkClass('letter', {
      width: 27,
      height: 60,
      color: CN_COLORS.black,
      gapAfter: 3.5,
      cellFill: true,
    }),
    digit: mkClass('digit', {
      width: 27,
      height: 60,
      color: CN_COLORS.black,
      gapAfter: 3.5,
      cellFill: true,
    }),
  },
  runs: [
    {
      kind: 'run',
      primary: true,
      origin: { x: 0, y: (TEMP.h - 60) / 2 },
      gap: 3.5,
      align: 'center',
      slots: [
        { classId: 'hanzi', field: 'province', charIndex: 0 },
        { classId: 'letter', field: 'letter', charIndex: 0 },
        ...[0, 1, 2, 3, 4].map((i) => ({ classId: 'digit', field: 'serial', charIndex: i })),
      ],
    },
  ],
  decorations: [],
  fields: [fProv, fLetter, { ...fSerial(5), charset: '0123456789' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿][A-Z][0-9]{5}$/,
  sample: '京A00001',
});

export const cnStandard: Standard = {
  region: 'CN',
  name: '中国',
  citation: 'GA 36-2018《中华人民共和国机动车号牌》',
  types,
};
