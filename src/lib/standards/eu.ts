/**
 * 欧盟机动车号牌标准。
 *
 * 数据来源：
 * - Commission Regulation (EU) No 1003/2010 Annex I/II（号牌尺寸、蓝色 EU 带）
 * - Council Regulation (EC) No 2411/98（蓝带 + 国别代码 + 12 星）
 * - Council of Europe《Flag of Europe》graphic spec (2004)（星环几何：R = H/3，星径 = H/9）
 * - 德国 FZV Anlage 4 / DIN 74069（FE-Schrift Mittelschrift 字形度量 —— 实际通行实现）
 *
 * 关键校验：实测 FE-Schrift 克隆字体（GL-Nummernschild-Mtl）数字 ink 宽高比
 *   356/600 = 0.593，与标准数字 44.5mm/75mm = 0.593 **完全一致**，
 *   证明该字体即 FE-Schrift，且应采用 `uniform`（等比）拟合而非拉伸。
 *
 * 字符高度：Reg (EU) 1003/2010 Annex II 允许 50–100mm；实际 110mm 高号牌通行做法为
 *   FE-Schrift Mittelschrift 75mm（上下各留 17.5mm），本实现取 75mm。
 *
 * 布局采用 **free run**（自由文本）：EU 注册号长度可变（地区代码 1–3 位），
 *   静态槽位会留下空隙，故按字段整体展开、逐字符自适应。
 */

import { FONTS } from '@/lib/plate/fonts';
import type { PlateType, Standard } from '@/types/standard';

export const EU_COLORS = {
  reflexBlue: '#003399', // Pantone Reflex Blue —— 蓝带底
  yellow: '#FFCC00', // Pantone Yellow —— 12 星
  white: '#FFFFFF', // 反光白底
  black: '#000000', // 字符
} as const;

// ── 几何常量（Reg 1003/2010 Annex II + FZV Anlage 4）──────────
const PLATE = { w: 520, h: 110, radius: 10 };
const BAND_W = 45; // 蓝带宽（de facto；EU 法规仅给图形附录）
const CHAR_H = 75; // FE-Schrift Mittelschrift 字高
const CELL_W = 47.5; // 字符单元格宽
const CHAR_GAP = 7.5; // 字符间隔（pitch 55 = 47.5 + 7.5）
const MARGIN_LEFT = 15; // 蓝带右侧到首字符
const CHAR_Y = (PLATE.h - CHAR_H) / 2; // 垂直居中 17.5

/** 星环几何（Flag of Europe spec，按蓝带宽缩放）。 */
export const EU_STARS = {
  cx: BAND_W / 2,
  cy: 33,
  radius: 15,
  starRadius: 2.5, // = radius/6，对应旗规 (H/18)/(H/3)
  count: 12,
  color: EU_COLORS.yellow,
};

/** 国别代码：白色大写，字高 20mm，基线距蓝带底 10mm（Reg 2411/98 Annex）。 */
export const EU_COUNTRY_CODE = { height: 20, baseline: PLATE.h - 10, color: EU_COLORS.white };

const fe = FONTS.fe; // GL-Nummernschild-Mtl = FE-Schrift (Mittelschrift) 克隆

function feClass(id: string, color: string) {
  return {
    id,
    height: CHAR_H,
    width: CELL_W,
    advance: CELL_W,
    fit: 'uniform' as const,
    fill: { kind: 'solid' as const, color },
    font: fe,
  };
}

/** 国别代码字符类（小号，20mm 高）。 */
const countryCodeClass = {
  id: 'country',
  height: EU_COUNTRY_CODE.height,
  width: 14,
  advance: 14,
  fit: 'uniform' as const,
  fill: { kind: 'solid' as const, color: EU_COUNTRY_CODE.color },
  font: fe,
};

export const EU_COUNTRY_CODES: { code: string; name: string }[] = [
  { code: 'A', name: '奥地利' }, { code: 'B', name: '比利时' }, { code: 'BG', name: '保加利亚' },
  { code: 'HR', name: '克罗地亚' }, { code: 'CY', name: '塞浦路斯' }, { code: 'CZ', name: '捷克' },
  { code: 'DK', name: '丹麦' }, { code: 'EST', name: '爱沙尼亚' }, { code: 'FIN', name: '芬兰' },
  { code: 'F', name: '法国' }, { code: 'D', name: '德国' }, { code: 'GR', name: '希腊' },
  { code: 'H', name: '匈牙利' }, { code: 'IRL', name: '爱尔兰' }, { code: 'I', name: '意大利' },
  { code: 'LV', name: '拉脱维亚' }, { code: 'LT', name: '立陶宛' }, { code: 'L', name: '卢森堡' },
  { code: 'M', name: '马耳他' }, { code: 'NL', name: '荷兰' }, { code: 'PL', name: '波兰' },
  { code: 'P', name: '葡萄牙' }, { code: 'RO', name: '罗马尼亚' }, { code: 'SK', name: '斯洛伐克' },
  { code: 'SLO', name: '斯洛文尼亚' }, { code: 'E', name: '西班牙' }, { code: 'S', name: '瑞典' },
];

const CITATION =
  'Reg (EU) 1003/2010 Annex II（520×110mm）+ Reg (EC) 2411/98（蓝带/国别代码/12星）+ FZV Anlage 4（FE-Schrift Mittelschrift 75mm）';

function euType(opts: {
  id: string;
  label: string;
  bg?: string;
  codeDefault: string;
  country: string;
  placeholder: string;
  help: string;
  sample: string;
  citation?: string;
}): PlateType {
  const bg = opts.bg ?? EU_COLORS.white;
  const fg = EU_COLORS.black;
  return {
    id: opts.id,
    label: opts.label,
    citation: opts.citation ?? CITATION,
    size: { width: PLATE.w, height: PLATE.h },
    body: { fill: { kind: 'solid', color: bg }, radius: PLATE.radius },
    border: { width: 0, fill: { kind: 'solid', color: bg } }, // EU 无印刷外边框
    charClasses: {
      letter: feClass('letter', fg),
      digit: feClass('digit', fg),
      other: feClass('other', fg),
      country: countryCodeClass,
    },
    runs: [
      {
        kind: 'free',
        origin: { x: BAND_W + MARGIN_LEFT, y: CHAR_Y },
        gap: CHAR_GAP,
        field: 'code',
        auto: { digit: 'digit', letter: 'letter', other: 'other' },
        align: 'left',
        width: PLATE.w - (BAND_W + MARGIN_LEFT) - 15, // 右缘留 15mm
        shrinkToFit: true, // 地区代码 1–3 位 + 数字，长度可变
      },
    ],
    decorations: [
      { kind: 'component', name: 'eu-band', props: { bandWidth: BAND_W, height: PLATE.h, radius: PLATE.radius } },
    ],
    fields: [
      { key: 'code', label: '注册号', maxLength: 9, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -', placeholder: opts.placeholder, help: opts.help },
      { key: 'country', label: '国别代码', maxLength: 3, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: opts.country, help: '蓝带内星环下方' },
    ],
    defaults: { code: opts.codeDefault, country: opts.country },
    sample: opts.sample,
    pattern: /^[A-Z0-9][A-Z0-9 -]{0,8}$/,
  };
}

const types: PlateType[] = [
  euType({
    id: 'eu-de', label: '德国式', country: 'D',
    codeDefault: 'M AB 1234', placeholder: 'M AB 1234',
    help: '地区代码 + 字母 + 数字（空格分组）', sample: 'D ｜ M AB 1234',
  }),
  euType({
    id: 'eu-fr', label: '法国式', country: 'F',
    codeDefault: 'AA-123-BB', placeholder: 'AA-123-BB',
    help: 'AA-123-AA（连字符分组）', sample: 'F ｜ AA-123-BB',
  }),
  euType({
    id: 'eu-it', label: '意大利式', country: 'I',
    codeDefault: 'AA 123 AA', placeholder: 'AA 123 AA',
    help: 'AA 123 AA（空格分组）', sample: 'I ｜ AA 123 AA',
  }),
  euType({
    id: 'eu-nl', label: '荷兰式（黄底）', country: 'NL', bg: '#FFD700',
    codeDefault: 'AB-123-C', placeholder: 'AB-123-C',
    help: '荷兰/卢森堡前后号牌均为黄底', sample: 'NL ｜ AB-123-C',
    citation: CITATION + '；荷兰/卢森堡黄底黑字',
  }),
  euType({
    id: 'eu-generic', label: '通用（自由字符）', country: 'D',
    codeDefault: 'AB 123 CD', placeholder: 'AB 123 CD',
    help: '任意字母数字，空格作组间隔', sample: 'D ｜ AB 123 CD',
  }),
];

export const euStandard: Standard = {
  region: 'EU',
  name: '欧盟',
  citation: 'Regulation (EU) No 1003/2010 + Regulation (EC) No 2411/98',
  types,
};

export const EU_GEOM = { PLATE, BAND_W, CHAR_H, CELL_W, CHAR_GAP, MARGIN_LEFT, CHAR_Y };
