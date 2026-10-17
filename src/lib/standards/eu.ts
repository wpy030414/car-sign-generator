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
  fg?: string;
  codeDefault: string;
  country: string;
  placeholder: string;
  help: string;
  sample: string;
  citation?: string;
  /** 右侧第二条蓝带（法国式） */
  rightBand?: boolean;
  /** 右侧蓝带内的地区代码 */
  region?: string;
}): PlateType {
  const bg = opts.bg ?? EU_COLORS.white;
  const fg = opts.fg ?? EU_COLORS.black;
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
      // FE-Mittelschrift 无连字符/点等标点，用含标点的号牌字体补齐
      other: {
        ...feClass('other', fg),
        width: 32,
        advance: 32,
        fit: 'uniform',
        font: FONTS.punct,
      },
      country: countryCodeClass,
    },
    runs: [
      {
        kind: 'free', primary: true,
        origin: { x: BAND_W + MARGIN_LEFT, y: CHAR_Y },
        gap: CHAR_GAP,
        field: 'code',
        auto: { digit: 'digit', letter: 'letter', other: 'other' },
        align: 'left',
        width: PLATE.w - (BAND_W + MARGIN_LEFT) - (opts.rightBand ? BAND_W + 10 : 15),
        shrinkToFit: true, // 地区代码 1–3 位 + 数字，长度可变
      },
    ],
    decorations: [
      { kind: 'component', name: 'eu-band', props: { bandWidth: BAND_W, height: PLATE.h, radius: PLATE.radius } },
      ...(opts.rightBand
        ? [{
            kind: 'component' as const,
            name: 'eu-band',
            props: {
              bandWidth: BAND_W,
              height: PLATE.h,
              radius: PLATE.radius,
              side: 'right',
              code: opts.region ?? 'ARA',
              showStars: false,
            },
          }]
        : []),
    ],
    fields: [
      { key: 'code', label: '注册号', maxLength: 12, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -', placeholder: opts.placeholder, help: opts.help },
      { key: 'country', label: '国别代码', maxLength: 3, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: opts.country, help: '蓝带内星环下方' },
      ...(opts.rightBand
        ? [{ key: 'region', label: '地区代码', maxLength: 3, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', placeholder: opts.region ?? 'ARA', help: '右侧蓝带内' }]
        : []),
    ],
    defaults: {
      code: opts.codeDefault,
      country: opts.country,
      ...(opts.rightBand ? { region: opts.region ?? 'ARA' } : {}),
    },
    sample: opts.sample,
    pattern: /^[A-Z0-9][A-Z0-9 -]{0,10}$/,
  };
}

const types: PlateType[] = [
  // ── 27 个欧盟成员国（标准乘用车牌）──
  // 格式与配色：各国现行标准；蓝带/12 星/国别代码按 Reg 2411/98。
  euType({ id: 'eu-at', label: '奥地利', country: 'A', codeDefault: 'W 12345', placeholder: 'W 12345', help: '1–2 位州代码 + 数字', sample: 'A ｜ W 12345' }),
  euType({ id: 'eu-be', label: '比利时', country: 'B', fg: '#C8102E', codeDefault: '1-ABC-123', placeholder: '1-ABC-123', help: '1 位数字 + 3 字母 + 3 数字（红字）', sample: 'B ｜ 1-ABC-123' }),
  euType({ id: 'eu-bg', label: '保加利亚', country: 'BG', codeDefault: 'CA 1234', placeholder: 'CA 1234', help: '2 字母 + 4 数字', sample: 'BG ｜ CA 1234' }),
  euType({ id: 'eu-hr', label: '克罗地亚', country: 'HR', codeDefault: 'ZG 1234-AB', placeholder: 'ZG 1234-AB', help: '城市代码 + 数字 + 字母', sample: 'HR ｜ ZG 1234-AB' }),
  euType({ id: 'eu-cy', label: '塞浦路斯', country: 'CY', codeDefault: 'ABC 123', placeholder: 'ABC 123', help: '3 字母 + 3 数字', sample: 'CY ｜ ABC 123' }),
  euType({ id: 'eu-cz', label: '捷克', country: 'CZ', codeDefault: '1A2 3456', placeholder: '1A2 3456', help: '地区代码 + 数字', sample: 'CZ ｜ 1A2 3456' }),
  euType({ id: 'eu-dk', label: '丹麦', country: 'DK', codeDefault: 'AB 12 345', placeholder: 'AB 12 345', help: '2 字母 + 5 数字', sample: 'DK ｜ AB 12 345' }),
  euType({ id: 'eu-ee', label: '爱沙尼亚', country: 'EST', codeDefault: '123 ABC', placeholder: '123 ABC', help: '3 数字 + 3 字母', sample: 'EST ｜ 123 ABC' }),
  euType({ id: 'eu-fi', label: '芬兰', country: 'FIN', codeDefault: 'ABC-123', placeholder: 'ABC-123', help: '3 字母 + 3 数字', sample: 'FIN ｜ ABC-123' }),
  euType({ id: 'eu-fr', label: '法国', country: 'F', codeDefault: 'AA-123-AA', placeholder: 'AA-123-AA', help: 'AA-123-AA（左右各一组字母，双蓝带）', sample: 'F ｜ AA-123-AA', rightBand: true, region: 'ARA' }),
  euType({ id: 'eu-de', label: '德国', country: 'D', codeDefault: 'M AB 1234', placeholder: 'M AB 1234', help: '地区代码 + 字母 + 数字', sample: 'D ｜ M AB 1234' }),
  euType({ id: 'eu-gr', label: '希腊', country: 'GR', codeDefault: 'ABC-1234', placeholder: 'ABC-1234', help: '3 字母 + 4 数字', sample: 'GR ｜ ABC-1234' }),
  euType({ id: 'eu-hu', label: '匈牙利', country: 'H', codeDefault: 'AA AA-123', placeholder: 'AA AA-123', help: '4 字母 + 3 数字', sample: 'H ｜ AA AA-123' }),
  euType({ id: 'eu-ie', label: '爱尔兰', country: 'IRL', codeDefault: '231-D-12345', placeholder: '231-D-12345', help: '年份 + 郡代码 + 序号', sample: 'IRL ｜ 231-D-12345' }),
  euType({ id: 'eu-it', label: '意大利', country: 'I', codeDefault: 'AB 123 CD', placeholder: 'AB 123 CD', help: '2 字母 + 3 数字 + 2 字母', sample: 'I ｜ AB 123 CD' }),
  euType({ id: 'eu-lv', label: '拉脱维亚', country: 'LV', codeDefault: 'AB-1234', placeholder: 'AB-1234', help: '2 字母 + 4 数字', sample: 'LV ｜ AB-1234' }),
  euType({ id: 'eu-lt', label: '立陶宛', country: 'LT', codeDefault: 'ABC 123', placeholder: 'ABC 123', help: '3 字母 + 3 数字', sample: 'LT ｜ ABC 123' }),
  euType({ id: 'eu-lu', label: '卢森堡', country: 'L', bg: '#F5D04A', codeDefault: 'AB 1234', placeholder: 'AB 1234', help: '2 字母 + 4 数字（黄底）', sample: 'L ｜ AB 1234' }),
  euType({ id: 'eu-mt', label: '马耳他', country: 'M', codeDefault: 'ABC 123', placeholder: 'ABC 123', help: '3 字母 + 3 数字', sample: 'M ｜ ABC 123' }),
  euType({ id: 'eu-nl', label: '荷兰', country: 'NL', bg: '#F5D04A', codeDefault: 'AB-123-C', placeholder: 'AB-123-C', help: '分组字母数字（黄底）', sample: 'NL ｜ AB-123-C' }),
  euType({ id: 'eu-pl', label: '波兰', country: 'PL', codeDefault: 'WE 12345', placeholder: 'WE 12345', help: '2–3 字母 + 4–5 数字', sample: 'PL ｜ WE 12345' }),
  euType({ id: 'eu-pt', label: '葡萄牙', country: 'P', codeDefault: 'AA-00-AA', placeholder: 'AA-00-AA', help: '2 字母 + 2 数字 + 2 字母', sample: 'P ｜ AA-00-AA' }),
  euType({ id: 'eu-ro', label: '罗马尼亚', country: 'RO', codeDefault: 'B 123 ABC', placeholder: 'B 123 ABC', help: '郡代码 + 数字 + 字母', sample: 'RO ｜ B 123 ABC' }),
  euType({ id: 'eu-sk', label: '斯洛伐克', country: 'SK', codeDefault: 'BA 123 AB', placeholder: 'BA 123 AB', help: '地区代码 + 数字 + 字母', sample: 'SK ｜ BA 123 AB' }),
  euType({ id: 'eu-si', label: '斯洛文尼亚', country: 'SLO', codeDefault: 'LJ AB-123', placeholder: 'LJ AB-123', help: '地区代码 + 字母数字', sample: 'SLO ｜ LJ AB-123' }),
  euType({ id: 'eu-es', label: '西班牙', country: 'E', codeDefault: '1234 ABC', placeholder: '1234 ABC', help: '4 数字 + 3 字母', sample: 'E ｜ 1234 ABC' }),
  euType({ id: 'eu-se', label: '瑞典', country: 'S', codeDefault: 'ABC 123', placeholder: 'ABC 123', help: '3 字母 + 3 数字', sample: 'S ｜ ABC 123' }),
];

export const euStandard: Standard = {
  region: 'EU',
  name: '欧盟',
  citation: 'Regulation (EU) No 1003/2010 + Regulation (EC) No 2411/98',
  types,
};

export const EU_GEOM = { PLATE, BAND_W, CHAR_H, CELL_W, CHAR_GAP, MARGIN_LEFT, CHAR_Y };
