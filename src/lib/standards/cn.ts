/**
 * 中国机动车号牌标准 —— GA 36-2018《中华人民共和国机动车号牌》。
 *
 * 数据来源（均从仓库 document/ 内 PDF 逐页核对）：
 * - 表1：号牌种类（17 种）
 * - 表2：外形尺寸（汽车 440×140 R13 边框3；摩托 220×140 R5 边框3；轻便摩托/临时 180×110 R9 边框2）
 * - 表3：字符尺寸（汽车 数字/字母 高70 宽30 笔画10/9.5 间隔9；汉字 70×70 间隔15。
 *                 摩托 数字/字母 高45 宽22 间隔4；汉字 45×45 间隔10）
 * - 表4：颜色（Pantone → hex）
 * - §4.1.2：号牌专用字体（数字/字母用 ChePaiZiTi，汉字用 Source Han Sans CN）
 *
 * 说明：表3 给出的是字符 **ink 尺寸**（数字 30×70 比例 0.429 明显窄于 ChePaiZiTi
 * 自然比例 0.565），故中国号牌统一用 `fill`（各向异性）拟合模式。
 */

import { FONTS } from '@/lib/plate/fonts';
import type { Fill, PlateType, Standard } from '@/types/standard';

// ── 颜色（表4 Pantone → hex）──────────────────────────────────
export const CN_COLORS = {
  blue: '#1E4DB7', // PANTONE 294C  蓝牌底
  yellow: '#F9C500', // PANTONE Yellow 012C  黄牌底
  green: '#2E9E4F', // 新能源绿
  greenLight: '#8FD14F', // 新能源渐变浅绿
  black: '#111111', // PANTONE Process Black C  黑牌底
  white: '#FFFFFF',
  red: '#E60012', // 警/应急 红字
} as const;

const solid = (color: string): Fill => ({ kind: 'solid', color });

// 新能源渐变：小型（上白下绿）、大型（上绿下黄）。表4：新能源小型 白/绿渐变，大型 绿/黄渐变。
const neSmallFill: Fill = {
  kind: 'gradient',
  angle: 180,
  stops: [
    { at: 0, color: '#FFFFFF' },
    { at: 0.5, color: '#F2F7EC' },
    { at: 1, color: CN_COLORS.greenLight },
  ],
};
const neLargeFill: Fill = {
  kind: 'gradient',
  angle: 180,
  stops: [
    { at: 0, color: CN_COLORS.greenLight },
    { at: 0.55, color: '#D6E8A8' },
    { at: 1, color: CN_COLORS.yellow },
  ],
};

// ── 字体引用 ────────────────────────────────────────────────
const latin = FONTS.latin; // ChePaiZiTi：数字/字母（号牌专用字体）
const han = FONTS.han; // Source Han Sans CN：汉字

// ── 字符类构造器 ────────────────────────────────────────────
// 汽车类（表3）：数字/字母 高70 宽45（笔画10/9.5，间隔9）；汉字 70×70（笔画10，间隔15）。
// 注：数字/字母 ink 宽 45mm 与汉字 70mm 不同，故 advance 各异；间隔按字符类型区分（gapAfter）。
function carClasses(text: string, redText = false) {
  const digit: PlateType['charClasses']['digit'] = {
    id: 'digit',
    height: 70,
    width: 45,
    advance: 45,
    fit: 'fill',
    stroke: 10,
    gapAfter: 9,
    fill: solid(text),
    font: latin,
  };
  const letter: PlateType['charClasses']['letter'] = {
    id: 'letter',
    height: 70,
    width: 45,
    advance: 45,
    fit: 'fill',
    stroke: 9.5,
    gapAfter: 9,
    fill: solid(text),
    font: latin,
  };
  const hanzi: PlateType['charClasses']['hanzi'] = {
    id: 'hanzi',
    height: 70,
    width: 70,
    advance: 70,
    fit: 'fill',
    stroke: 10,
    gapAfter: 15,
    fill: solid(text),
    font: han,
  };
  const hanziRed: PlateType['charClasses']['hanziRed'] = {
    ...hanzi,
    id: 'hanziRed',
    fill: solid(CN_COLORS.red),
  };
  const classes: PlateType['charClasses'] = { digit, letter, hanzi };
  if (redText) classes.hanziRed = hanziRed;
  return classes;
}

// 摩托车/拖拉机类（表3）：数字/字母 高45 宽22（笔画7.5/7，间隔4）；汉字 45×45（间隔10）。
function motoClasses(text: string) {
  return {
    digit: {
      id: 'digit', height: 45, width: 22, advance: 22, fit: 'fill' as const,
      stroke: 7.5, gapAfter: 4, fill: solid(text), font: latin,
    },
    letter: {
      id: 'letter', height: 45, width: 22, advance: 22, fit: 'fill' as const,
      stroke: 7, gapAfter: 4, fill: solid(text), font: latin,
    },
    hanzi: {
      id: 'hanzi', height: 45, width: 45, advance: 45, fit: 'fill' as const,
      stroke: 10, gapAfter: 10, fill: solid(text), font: han,
    },
  } satisfies PlateType['charClasses'];
}

const PROV = '京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新';

// ── 通用几何 ────────────────────────────────────────────────
// 汽车号牌 440×140。字符高 70，垂直居中 → 顶边距 (140-70)/2 = 35。
// 边框宽 3，圆角 R13。
const CAR = { w: 440, h: 140, r: 13, border: 3 };
// 新能源汽车号牌表2 同为 440×140（旧实现用 480 系 CSS 变通；国标为 440）。
const MOTO = { w: 220, h: 140, r: 5, border: 3 };
const LIGHT = { w: 180, h: 110, r: 9, border: 2 };

// 安装孔（表2/图A：汽车号牌上下各两个腰形孔，距左右边缘约 96mm，距上下边缘约 8.5mm）
function carScrews() {
  const yTop = 8.5;
  const yBot = CAR.h - 8.5;
  const xL = 96;
  const xR = CAR.w - 96;
  return {
    kind: 'screws' as const,
    positions: [
      { x: xL, y: yTop }, { x: xR, y: yTop },
      { x: xL, y: yBot }, { x: xR, y: yBot },
    ],
    r: 4,
    fill: '#FFFFFF',
    stroke: '#999999',
  };
}

// ── 字段规格 ────────────────────────────────────────────────
const fProv = {
  key: 'province', label: '发牌机关（省）', maxLength: 1, charset: PROV,
  placeholder: '京', help: '省份简称',
};
const fLetter = {
  key: 'letter', label: '发牌机关代号', maxLength: 1, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  placeholder: 'A',
};

/**
 * 构造「省 + 字母 + N 位序号」的标准汽车号牌布局。
 *
 * 采用 `align:center`：字符序列整体在号牌宽度内居中（符合实际号牌观感 ——
 * 字符均匀分布于牌面，而非贴左）。分隔点「·」不在此处，而由 `cn-dot`
 * 组件装饰按真实布局动态定位（见 carDotDeco）。
 */
function serialSlots(n: number, suffixLiteral?: string, suffixClass = 'hanzi') {
  const slots: { classId: string; field?: string; charIndex?: number; literal?: string }[] = [
    { classId: 'hanzi', field: 'province', charIndex: 0 },
    { classId: 'letter', field: 'letter', charIndex: 0 },
  ];
  for (let i = 0; i < n; i++) slots.push({ classId: 'digit', field: 'serial', charIndex: i });
  if (suffixLiteral) slots.push({ classId: suffixClass, literal: suffixLiteral });
  return slots;
}

function carRun(
  n: number,
  suffixLiteral?: string,
  suffixClass: 'hanzi' | 'hanziRed' = 'hanzi',
) {
  return {
    kind: 'run' as const,
    // origin.x 在 center 对齐下仅作基准，实际由布局引擎居中；y 使字符垂直居中
    origin: { x: 0, y: (CAR.h - 70) / 2 },
    gap: 9,
    align: 'center' as const,
    slots: serialSlots(n, suffixLiteral, suffixClass),
  };
}

/**
 * 分隔点「·」组件装饰：位于第 `after` 个字符（默认字母，索引 1）与下一字符之间。
 * 由 CnDot 组件按真实布局坐标动态绘制，适配居中后的浮动位置。
 */
function carDotDeco(after = 1, color = '#FFFFFF') {
  return {
    kind: 'component' as const,
    name: 'cn-dot',
    props: { runIndex: 0, after, r: 5, color },
  };
}

// ── 各号牌类型 ──────────────────────────────────────────────
//
// 分隔点「·」位置随版式不同（参照旧实现正则与 GA 36-2018 图A）：
//   京A·00001（小型/大型/新能源/教练/港澳/挂车）→ 点在字母后（after=1）
//   京·A0001警（警用/应急）              → 点在省份后（after=0）
//   001·001使（使馆）                    → 点在国家代码后（after=2）
//   京001·01领（领馆）                   → 点在城市代码后（after=3）
// 点色与字符色一致（蓝/黑底用白点，黄/白底用黑点）。

const types: PlateType[] = [];

// 1. 小型汽车号牌（蓝底白字）GA 36-2018 表1/表4
types.push({
  id: 'cn-small-car',
  label: '小型汽车号牌',
  citation: 'GA 36-2018 表1/表2/表3/表4（蓝底白字，PANTONE 294C）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.blue), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#FFFFFF') },
  charClasses: carClasses('#FFFFFF'),
  runs: [carRun(5)],
  decorations: [carScrews(), carDotDeco(1, '#FFFFFF')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 5, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '00001' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// 2. 大型汽车号牌（黄底黑字）
types.push({
  id: 'cn-large-car',
  label: '大型汽车号牌',
  citation: 'GA 36-2018 表1/表4（黄底黑字，PANTONE Yellow 012C）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000'),
  runs: [carRun(5)],
  decorations: [carScrews(), carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 5, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '00001' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// 3. 小型新能源汽车号牌（白→绿渐变底黑字，序号 6 位，首位字母 D/F 等）
types.push({
  id: 'cn-ne-small',
  label: '小型新能源汽车号牌',
  citation: 'GA 36-2018 表1/表4（新能源小型，白→绿渐变底，黑字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: neSmallFill, radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000'),
  runs: [carRun(6)],
  decorations: [carScrews(), carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 6, charset: '0123456789DFABCDEFGHJK', placeholder: 'D00001', help: '首位为 D/F 等字母' }],
  defaults: { province: '京', letter: 'A', serial: 'D00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{6}$/,
  sample: '京A·D00001',
});

// 4. 大型新能源汽车号牌（绿→黄渐变底黑字，序号 6 位，末位字母）
types.push({
  id: 'cn-ne-large',
  label: '大型新能源汽车号牌',
  citation: 'GA 36-2018 表1/表4（新能源大型，绿→黄渐变底，黑字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: neLargeFill, radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000'),
  runs: [carRun(6)],
  decorations: [carScrews(), carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 6, charset: '0123456789DFABCDEFGHJK', placeholder: '00001D', help: '末位为 D/F 等字母' }],
  defaults: { province: '京', letter: 'A', serial: '00001D' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{6}$/,
  sample: '京A·00001D',
});

// 5. 教练车号牌（黄底黑字，末位「学」，序号 4 位）
types.push({
  id: 'cn-coach',
  label: '教练车号牌',
  citation: 'GA 36-2018 表1（教练汽车，黄底黑字，末位汉字「学」）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000'),
  runs: [carRun(4, '学')],
  decorations: [carScrews(), carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 4, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '0001' }],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{4}学$/,
  sample: '京A·0001学',
});

// 6. 警用汽车号牌（白底黑字，「警」红字，格式 京·A0001警 —— 点在省份后）
types.push({
  id: 'cn-police',
  label: '警用汽车号牌',
  citation: 'GA 36-2018 表1/表4（警用汽车，白底黑字，「警」为红字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid('#FFFFFF'), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000', true),
  runs: [carRun(4, '警', 'hanziRed')],
  decorations: [carScrews(), carDotDeco(0, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 4, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '0001', help: '格式 京·A0001警' }],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{4}警$/,
  sample: '京·A0001警',
});

// 7. 应急汽车号牌（白底黑字，「应急」红字，格式 京·X0001应急 —— 点在省份后）
types.push({
  id: 'cn-emergency',
  label: '应急汽车号牌',
  citation: 'GA 36-2018 表1（应急汽车，白底黑字，「应急」为红字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid('#FFFFFF'), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: { ...carClasses('#000000', true), emergency: { id: 'emergency', height: 70, width: 70, advance: 70, fit: 'fill', gapAfter: 15, fill: solid(CN_COLORS.red), font: han } },
  runs: [{
    kind: 'run', origin: { x: 0, y: (CAR.h - 70) / 2 }, gap: 9, align: 'center',
    slots: [
      { classId: 'hanzi', field: 'province', charIndex: 0 },
      { classId: 'letter', field: 'letter', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 1 },
      { classId: 'digit', field: 'serial', charIndex: 2 },
      { classId: 'digit', field: 'serial', charIndex: 3 },
      { classId: 'emergency', literal: '应' },
      { classId: 'emergency', literal: '急' },
    ],
  }],
  decorations: [carScrews(), carDotDeco(0, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 4, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '0001', help: '格式 京·X0001应急' }],
  defaults: { province: '京', letter: 'X', serial: '0001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{4}应急$/,
  sample: '京·X0001应急',
});

// 8. 使馆汽车号牌（黑底白字，「使」红字，格式 001·001使 —— 点在国家代码后）
types.push({
  id: 'cn-embassy',
  label: '使馆汽车号牌',
  citation: 'GA 36-2018 表1/表4（使馆汽车，黑底白字，「使」为红字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.black), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#FFFFFF') },
  charClasses: { ...carClasses('#FFFFFF'), embassy: { id: 'embassy', height: 70, width: 70, advance: 70, fit: 'fill', gapAfter: 15, fill: solid(CN_COLORS.red), font: han } },
  runs: [{
    kind: 'run', origin: { x: 0, y: (CAR.h - 70) / 2 }, gap: 12, align: 'center',
    slots: [
      { classId: 'digit', field: 'serial1', charIndex: 0 },
      { classId: 'digit', field: 'serial1', charIndex: 1 },
      { classId: 'digit', field: 'serial1', charIndex: 2 },
      { classId: 'digit', field: 'serial2', charIndex: 0 },
      { classId: 'digit', field: 'serial2', charIndex: 1 },
      { classId: 'digit', field: 'serial2', charIndex: 2 },
      { classId: 'embassy', literal: '使' },
    ],
  }],
  decorations: [carScrews(), carDotDeco(2, '#FFFFFF')],
  fields: [
    { key: 'serial1', label: '国家代码', maxLength: 3, charset: '0123456789', placeholder: '001' },
    { key: 'serial2', label: '序号', maxLength: 3, charset: '0123456789', placeholder: '001' },
  ],
  defaults: { serial1: '001', serial2: '001' },
  pattern: /^[0-9]{3}[0-9]{3}使$/,
  sample: '001·001使',
});

// 9. 领馆汽车号牌（黑底白字，「领」红字，格式 京001·01领 —— 点在城市代码后）
types.push({
  id: 'cn-consulate',
  label: '领馆汽车号牌',
  citation: 'GA 36-2018 表1/表4（领馆汽车，黑底白字，「领」为红字）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.black), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#FFFFFF') },
  charClasses: { ...carClasses('#FFFFFF'), consulate: { id: 'consulate', height: 70, width: 70, advance: 70, fit: 'fill', gapAfter: 15, fill: solid(CN_COLORS.red), font: han } },
  runs: [{
    kind: 'run', origin: { x: 0, y: (CAR.h - 70) / 2 }, gap: 9, align: 'center',
    slots: [
      { classId: 'hanzi', field: 'province', charIndex: 0 },
      { classId: 'digit', field: 'serial1', charIndex: 0 },
      { classId: 'digit', field: 'serial1', charIndex: 1 },
      { classId: 'digit', field: 'serial1', charIndex: 2 },
      { classId: 'digit', field: 'serial2', charIndex: 0 },
      { classId: 'digit', field: 'serial2', charIndex: 1 },
      { classId: 'consulate', literal: '领' },
    ],
  }],
  decorations: [carScrews(), carDotDeco(3, '#FFFFFF')],
  fields: [
    fProv,
    { key: 'serial1', label: '城市代码', maxLength: 3, charset: '0123456789', placeholder: '001' },
    { key: 'serial2', label: '序号', maxLength: 2, charset: '0123456789', placeholder: '01' },
  ],
  defaults: { province: '京', serial1: '001', serial2: '01' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][0-9]{3}[0-9]{2}领$/,
  sample: '京001·01领',
});

// 10. 港澳入出境车号牌（黑底白字，末位「港」/「澳」，粤Z 开头）
for (const [id, ch, label] of [['cn-hk', '港', '港澳入出境车号牌（港）'], ['cn-mo', '澳', '港澳入出境车号牌（澳）']] as const) {
  types.push({
    id,
    label,
    citation: 'GA 36-2018 表1（港澳入出境车，黑底白字，末位「港」/「澳」）',
    size: { width: CAR.w, height: CAR.h },
    body: { fill: solid(CN_COLORS.black), radius: CAR.r },
    border: { width: CAR.border, fill: solid('#FFFFFF') },
    charClasses: carClasses('#FFFFFF'),
    runs: [carRun(4, ch)],
    decorations: [carScrews(), carDotDeco(1, '#FFFFFF')],
    fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 4, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '0001' }],
    defaults: { province: '粤', letter: 'Z', serial: '0001' },
    pattern: new RegExp(`^[粤][A-Z][0-9A-Z]{4}${ch}$`),
    sample: `粤Z·0001${ch}`,
  });
}

// 11. 汽车挂车号牌（黄底黑字，末位「挂」）
types.push({
  id: 'cn-trailer',
  label: '汽车挂车号牌',
  citation: 'GA 36-2018 表1（汽车挂车，黄底黑字，末位「挂」）',
  size: { width: CAR.w, height: CAR.h },
  body: { fill: solid(CN_COLORS.yellow), radius: CAR.r },
  border: { width: CAR.border, fill: solid('#000000') },
  charClasses: carClasses('#000000'),
  runs: [carRun(4, '挂')],
  decorations: [carScrews(), carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 4, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '0001' }],
  defaults: { province: '京', letter: 'A', serial: '0001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{4}挂$/,
  sample: '京A·0001挂',
});

// 12. 普通摩托车号牌（黄底黑字，220×140）
types.push({
  id: 'cn-moto',
  label: '普通摩托车号牌',
  citation: 'GA 36-2018 表1/表2/表3（普通摩托车，黄底黑字，220×140）',
  size: { width: MOTO.w, height: MOTO.h },
  body: { fill: solid(CN_COLORS.yellow), radius: MOTO.r },
  border: { width: MOTO.border, fill: solid('#000000') },
  charClasses: motoClasses('#000000'),
  runs: [{
    kind: 'run', origin: { x: 0, y: (MOTO.h - 45) / 2 }, gap: 4, align: 'center',
    slots: [
      { classId: 'hanzi', field: 'province', charIndex: 0 },
      { classId: 'letter', field: 'letter', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 1 },
      { classId: 'digit', field: 'serial', charIndex: 2 },
      { classId: 'digit', field: 'serial', charIndex: 3 },
      { classId: 'digit', field: 'serial', charIndex: 4 },
    ],
  }],
  decorations: [carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 5, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '00001' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// 13. 轻便摩托车号牌（白底蓝字，180×110）
types.push({
  id: 'cn-moped',
  label: '轻便摩托车号牌',
  citation: 'GA 36-2018 表1/表2（轻便摩托车，白底蓝字，180×110）',
  size: { width: LIGHT.w, height: LIGHT.h },
  body: { fill: solid('#FFFFFF'), radius: LIGHT.r },
  border: { width: LIGHT.border, fill: solid(CN_COLORS.blue) },
  charClasses: {
    digit: { id: 'digit', height: 55, width: 35, advance: 35, fit: 'fill', gapAfter: 6, fill: solid(CN_COLORS.blue), font: latin },
    letter: { id: 'letter', height: 55, width: 35, advance: 35, fit: 'fill', gapAfter: 6, fill: solid(CN_COLORS.blue), font: latin },
    hanzi: { id: 'hanzi', height: 55, width: 55, advance: 55, fit: 'fill', gapAfter: 10, fill: solid(CN_COLORS.blue), font: han },
  },
  runs: [{
    kind: 'run', origin: { x: 0, y: (LIGHT.h - 55) / 2 }, gap: 6, align: 'center',
    slots: [
      { classId: 'hanzi', field: 'province', charIndex: 0 },
      { classId: 'letter', field: 'letter', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 1 },
      { classId: 'digit', field: 'serial', charIndex: 2 },
      { classId: 'digit', field: 'serial', charIndex: 3 },
      { classId: 'digit', field: 'serial', charIndex: 4 },
    ],
  }],
  decorations: [carDotDeco(1, CN_COLORS.blue)],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 5, charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: '00001' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9A-Z]{5}$/,
  sample: '京A·00001',
});

// 14. 临时行驶车号牌（白底黑字红框，180×110，纸质）
types.push({
  id: 'cn-temp',
  label: '临时行驶车号牌',
  citation: 'GA 36-2018 表1/表2（临时行驶车，白底黑字红框，180×110）',
  size: { width: LIGHT.w, height: LIGHT.h },
  body: { fill: solid('#FFFFFF'), radius: LIGHT.r },
  border: { width: LIGHT.border, fill: solid(CN_COLORS.red) },
  charClasses: {
    digit: { id: 'digit', height: 55, width: 35, advance: 35, fit: 'fill', gapAfter: 6, fill: solid('#000000'), font: latin },
    letter: { id: 'letter', height: 55, width: 35, advance: 35, fit: 'fill', gapAfter: 6, fill: solid('#000000'), font: latin },
    hanzi: { id: 'hanzi', height: 55, width: 55, advance: 55, fit: 'fill', gapAfter: 10, fill: solid('#000000'), font: han },
  },
  runs: [{
    kind: 'run', origin: { x: 0, y: (LIGHT.h - 55) / 2 }, gap: 6, align: 'center',
    slots: [
      { classId: 'hanzi', field: 'province', charIndex: 0 },
      { classId: 'letter', field: 'letter', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 0 },
      { classId: 'digit', field: 'serial', charIndex: 1 },
      { classId: 'digit', field: 'serial', charIndex: 2 },
      { classId: 'digit', field: 'serial', charIndex: 3 },
      { classId: 'digit', field: 'serial', charIndex: 4 },
    ],
  }],
  decorations: [carDotDeco(1, '#000000')],
  fields: [fProv, fLetter, { key: 'serial', label: '序号', maxLength: 5, charset: '0123456789', placeholder: '00001' }],
  defaults: { province: '京', letter: 'A', serial: '00001' },
  pattern: /^[京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新][A-Z][0-9]{5}$/,
  sample: '京A·00001',
});

export const cnStandard: Standard = {
  region: 'CN',
  name: '中国',
  citation: 'GA 36-2018《中华人民共和国机动车号牌》',
  types,
};
