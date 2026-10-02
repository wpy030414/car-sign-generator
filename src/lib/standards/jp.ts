/**
 * 日本机动车号牌标准（自動車登録番号標 / 車両番号標）。
 *
 * 数据来源：
 * - 道路運送車両法施行規則 第11条 / 第一号様式（e-Gov 法令 PDF，等比实测）
 * - 国土交通省告示（番号標样式）
 * - JIS D 0201（涂装/耐候，不含字形）
 *
 * 字体：官方番号標用 TRM gothic（数字）+ 小松書体（假名）均非自由许可，
 *   采用开源 **Noto Sans JP Bold**（OFL）替代，用 `fill` 模式压到规定 ink 尺寸。
 *
 * ⚠️ 颜色非法定：法令只规定「营业车用绿底白字、自用车用白底绿字，其余由大臣定」，
 *   hex 为业界实测标准值（非 Wikimedia 示意图的淡化色）。
 *
 * 布局（中板 330×165，原点=左上，实测第一号様式等比图）：
 *   顶部左：地名（品川，cap≈31mm，x2→70）
 *   顶部右：分类番号（500，cap≈36mm，x79→145）
 *   左中：平假名（あ，cap≈44mm，x5→50，y66→114）
 *   右下：一连指定番号（12-34，cap≈100mm，右对齐至 x≈325，贴底）
 */

import { FONTS } from '@/lib/plate/fonts';
import type { PlateType, Run, Standard } from '@/types/standard';

// ── 四色版式（实测业界标准 hex）──────────────────────────────
export const JP_COLORS = {
  white: '#FFFFFF',
  green: '#1A6B33',
  yellow: '#FFD400',
  black: '#1A1A1A',
} as const;

const noto = FONTS.noto;

function jpClass(id: string, color: string, height: number, width: number) {
  return {
    id,
    height,
    width,
    advance: width,
    fit: 'fill' as const,
    fill: { kind: 'solid' as const, color },
    font: noto,
  };
}

// ── 板体尺寸 ────────────────────────────────────────────────
const MID = { w: 330, h: 165 }; // 中板
const LARGE = { w: 440, h: 220 }; // 大板
const SMALL = { w: 230, h: 125 }; // 小板（摩托）
const RADIUS = 5;
const BORDER = 1.5;

const CITATION =
  '道路運送車両法施行規則 第11条 / 第一号様式 + 国土交通省告示；字体以 Noto Sans JP (OFL) 替代 TRM/小松書体';

/** 一连指定番号 charset：数字 + 连字符 + 中黒。 */
const SERIAL_CHARSET = '0123456789-・';
/** 用途文字（平假名）charset：实际使用的假名（排除 お し へ ゐ ゑ ん 及浊音等）。 */
const KANA_CHARSET =
  'あいうえかきくけこをさすせそたちつてとなにぬねのはひふほまみむめもやゆらりるろわれ';
/** 分类番号 charset：数字 + 2018 年起允许的字母后缀（排除 I O 及易混字符）。 */
const CLASSNUM_CHARSET = '0123456789ACFHKLMXY';

interface JpTypeOpts {
  id: string;
  label: string;
  bg: string;
  fg: string;
  size: { w: number; h: number };
  hasClassNum: boolean;
  defaults: Record<string, string>;
  sample: string;
}

function jpType(opts: JpTypeOpts): PlateType {
  const { bg, fg } = opts;
  const W = opts.size.w;
  const H = opts.size.h;
  const s = W / MID.w; // 相对中板的缩放系数

  // 各元素 cap 高（中板实测，按 s 缩放）
  const placeH = 31 * s;
  const classNumH = 36 * s;
  const kanaH = 44 * s;
  const serialH = 100 * s;

  // 字符类
  const classes: PlateType['charClasses'] = {
    place: jpClass('place', fg, placeH, placeH), // 地名汉字近正方
    classNum: jpClass('classNum', fg, classNumH, classNumH * 0.55),
    kana: jpClass('kana', fg, kanaH, kanaH),
    serialDigit: jpClass('serialDigit', fg, serialH, serialH * 0.5), // 2:1 压缩
    serialOther: jpClass('serialOther', fg, serialH, serialH * 0.26), // 连字符/中黒窄
  };

  // 布局序列
  const runs: Run[] = [
    // 地名（顶部左）
    {
      kind: 'free',
      origin: { x: 8 * s, y: 4 * s },
      gap: 1 * s,
      field: 'place',
      auto: { digit: 'place', letter: 'place', other: 'place' },
      align: 'left',
    },
    // 平假名（左中）
    {
      kind: 'free',
      origin: { x: 6 * s, y: 66 * s },
      gap: 0,
      field: 'kana',
      auto: { digit: 'kana', letter: 'kana', other: 'kana' },
      align: 'left',
    },
    // 一连指定番号（右下，右对齐至 x≈325*s，贴底）
    {
      kind: 'free',
      origin: { x: 0, y: H - serialH - 3 * s },
      gap: 2 * s,
      field: 'serial',
      auto: { digit: 'serialDigit', letter: 'serialDigit', other: 'serialOther' },
      align: 'right',
      width: W - 5 * s, // 右缘留 5mm 边距
      shrinkToFit: true,
    },
  ];

  if (opts.hasClassNum) {
    // 分类番号（顶部，地名右侧固定位）
    runs.splice(1, 0, {
      kind: 'free',
      origin: { x: 82 * s, y: 2 * s },
      gap: 1.5 * s,
      field: 'classNum',
      auto: { digit: 'classNum', letter: 'classNum', other: 'classNum' },
      align: 'left',
    });
  }

  const fields: PlateType['fields'] = [
    { key: 'place', label: '地名', maxLength: 4, charset: '', placeholder: '品川', help: '运输支局名（汉字，如 品川/横浜/名古屋）' },
  ];
  if (opts.hasClassNum) {
    fields.push({
      key: 'classNum', label: '分类番号', maxLength: 3, charset: CLASSNUM_CHARSET,
      placeholder: '500', help: '5=小型乘用 / 3=普通乘用 / 7=軽 等',
    });
  }
  fields.push(
    { key: 'kana', label: '平假名（用途文字）', maxLength: 1, charset: KANA_CHARSET, placeholder: 'あ', help: '自家用：さ～ろ；事业用：あ～を' },
    { key: 'serial', label: '一连指定番号', maxLength: 5, charset: SERIAL_CHARSET, placeholder: '12-34', help: '如 12-34（4 位数字中间加连字符）' },
  );

  return {
    id: opts.id,
    label: opts.label,
    citation: CITATION,
    size: { width: W, height: H },
    body: { fill: { kind: 'solid', color: bg }, radius: RADIUS },
    border: { width: BORDER, fill: { kind: 'solid', color: fg } },
    charClasses: classes,
    runs,
    decorations: [],
    fields,
    defaults: opts.defaults,
    sample: opts.sample,
    pattern: /^.+$/,
  };
}

const types: PlateType[] = [
  jpType({
    id: 'jp-private-mid', label: '自家用・中板（白底绿字）',
    bg: JP_COLORS.white, fg: JP_COLORS.green, size: MID, hasClassNum: true,
    defaults: { place: '品川', classNum: '500', kana: 'さ', serial: '12-34' },
    sample: '品川500 さ 12-34',
  }),
  jpType({
    id: 'jp-commercial-mid', label: '事業用・中板（绿底白字）',
    bg: JP_COLORS.green, fg: JP_COLORS.white, size: MID, hasClassNum: true,
    defaults: { place: '品川', classNum: '500', kana: 'あ', serial: '12-34' },
    sample: '品川500 あ 12-34',
  }),
  jpType({
    id: 'jp-kei-mid', label: '軽自家用・中板（黄底黑字）',
    bg: JP_COLORS.yellow, fg: JP_COLORS.black, size: MID, hasClassNum: true,
    defaults: { place: '品川', classNum: '580', kana: 'さ', serial: '12-34' },
    sample: '品川580 さ 12-34',
  }),
  jpType({
    id: 'jp-kei-commercial-mid', label: '軽事業用・中板（黑底黄字）',
    bg: JP_COLORS.black, fg: JP_COLORS.yellow, size: MID, hasClassNum: true,
    defaults: { place: '品川', classNum: '480', kana: 'り', serial: '12-34' },
    sample: '品川480 り 12-34',
  }),
  jpType({
    id: 'jp-large', label: '大板（440×220・货客/巴士）',
    bg: JP_COLORS.green, fg: JP_COLORS.white, size: LARGE, hasClassNum: true,
    defaults: { place: '品川', classNum: '100', kana: 'あ', serial: '12-34' },
    sample: '品川100 あ 12-34',
  }),
  jpType({
    id: 'jp-small', label: '小板（230×125・摩托）',
    bg: JP_COLORS.white, fg: JP_COLORS.green, size: SMALL, hasClassNum: false,
    defaults: { place: '品川', kana: 'さ', serial: '12-34' },
    sample: '品川 さ 12-34',
  }),
];

export const jpStandard: Standard = {
  region: 'JP',
  name: '日本',
  citation: '道路運送車両法施行規則 第11条 / 第一号様式',
  types,
};

export const JP_GEOM = { MID, LARGE, SMALL, RADIUS, BORDER };
