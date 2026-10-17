/**
 * 号牌标准数据模型
 *
 * 设计原则：
 * 1. **mm 为唯一长度单位** —— SVG viewBox 以 mm 为 user unit，所有物理量直接落图。
 * 2. **数据驱动** —— 新增一种号牌「类型」= 新增一个 PlateType 数据对象；
 *    新增一个「国家」= 新增数据文件 + 一个布局适配器。
 * 3. **标准可追溯** —— 每个 Standard 带 citation，指向具体条款（如 GA 36-2018 表2）。
 */

/** 毫米。全项目所有长度量均为 mm。 */
export type Mm = number;

/** 十六进制颜色 `#RRGGBB` 或 CSS 颜色字符串。 */
export type Color = string;

/** 支持的国家/地区。 */
export type Region = 'CN' | 'EU' | 'US' | 'JP';

/** 填充：纯色，或线性渐变（中国新能源号牌为白→绿/黄渐变）。 */
export type Fill =
  | { kind: 'solid'; color: Color }
  | {
      kind: 'gradient';
      /** CSS 线性渐变角度（deg），180 = 自上而下 */
      angle: number;
      stops: { at: number; color: Color }[];
    };

/**
 * 字体引用。`src` 为 Vite `?url` 资源路径，运行时 fetch 后转 base64 内联进导出 SVG
 * —— canvas 栅格化 SVG 时无法访问页面的 document.fonts，必须内联。
 */
export interface FontRef {
  /** 写入 SVG font-family 的名称 */
  family: string;
  weight?: number;
  /** 字体文件 URL（Vite 资源路径） */
  src: string;
  /** woff2 | ttf | otf，用于 @font-face format() 提示 */
  format?: 'woff2' | 'truetype' | 'opentype';
}

/**
 * 字形与 mm 单元格的拟合方式。
 *
 * - `uniform`：**等比缩放**至 cap/ink 高度 = height，保留字体自然宽高比，
 *   ink 在 advance 单元格内水平居中。用于「本身就是按标准设计」的字体
 *   （如中国 ChePaiZiTi、欧盟 FE-Schrift 克隆 —— 实测字形比例与标准一致）。
 * - `fill`：**各向异性拉伸** ink 至精确的 width × height。用于替代字体
 *   （如美国 Roadgeek 复刻 FHWA Series E、日本 Noto 替代 TRM gothic），
 *   其自然比例与标准不符，需压缩/拉伸到规定的 ink 尺寸。
 */
export type GlyphFit = 'uniform' | 'fill';

/**
 * 字符类：号牌上同一类字符共享的物理规格。
 *
 * 中国 GA 36-2018 表3 明确规定了数字/字母/汉字各自的 **宽×高×笔画**，
 * 因此字形必须按「固定 mm 单元格」摆放，而非依赖字体自然 advance。
 */
export interface CharClass {
  id: string;
  /** 标准规定的字符高度（cap/ink 高）；uniform 模式的等比缩放目标 */
  height: Mm;
  /** 标准规定的字符 ink 宽度；fill 模式的横向拉伸目标（uniform 模式下仅作参考） */
  width: Mm;
  /** 字符水平步进（pitch，中心到中心 / 单元格宽）。缺省 = width */
  advance?: Mm;
  /**
   * 该字符之后的间距（mm），覆盖 run.gap。
   * 中国 GA 36-2018 表3 规定汉字后间隔 15mm、数字/字母后间隔 9mm，
   * 用此字段按字符类型区分间距。
   */
  gapAfter?: Mm;
  /** 拟合方式，缺省 'fill' */
  fit?: GlyphFit;
  /**
   * uniform 模式的横向附加倍数。用于「按单元格宽度撑满」的版式：
   * 以参考字形（数字 0）撑满单元格宽，其余字形按同一比例缩放，
   * 因此 `1` 等窄字仍保持窄，不会被拉伸成方块。
   */
  xScale?: number;
  /** 标准规定的笔画宽度（信息性；实际笔画由字体承载） */
  stroke?: Mm;
  /**
   * 额外描边厚度（mm）。用于在不改变字形结构的前提下把笔画补到标准粗细
   * （社区复刻字库的笔画往往略细于官方模具）。以 `vector-effect="non-scaling-stroke"`
   * 施加，故不受各向异性缩放影响。
   */
  outline?: Mm;
  /**
   * 横向补偿加粗（mm）。各向异性压缩会把竖画压细，此值让同一字形再绘制一份
   * 水平偏移副本，只加粗竖画、保持横画不变，用以还原标准字形的笔画对比。
   */
  hBold?: Mm;
  fill: Fill;
  font: FontRef;
  /** 字形在单元格内的垂直微调（某些字体 ink box 偏移时需要） */
  baselineOffset?: Mm;
}

/**
 * 字符槽位：号牌上的一个字位。
 * 要么绑定用户输入（field + charIndex），要么是固定字面量（如「学」「警」「使」）。
 */
export interface Slot {
  classId: string;
  /** 绑定的字段 key，如 'serial' */
  field?: string;
  /** 取该字段的第几个字符 */
  charIndex?: number;
  /** 固定字符（优先于 field） */
  literal?: string;
}

/**
 * 自由文本槽位的自动分类：按实际字符是数字/字母/其他，选用对应 charClass。
 * 用于「通用/自由输入」类型，用户可任意键入字母数字混排。
 */
export interface AutoClass {
  digit: string;
  letter: string;
  /** 空格或其他字符（如连字符） */
  other: string;
}

/**
 * 自由文本序列：把一个字段整体展开为字符序列，逐字符按 auto 分类选用 charClass。
 * 用于「通用/自由输入」类型（字符数与字母数字构成均可变）。
 */
export interface FreeRun {
  kind: 'free';
  origin: { x: Mm; y: Mm };
  gap: Mm;
  field: string;
  auto: AutoClass;
  /**
   * 对齐方式。对齐在「对齐框」内进行：
   * 框左边缘 = origin.x，框宽 = width（缺省 = 号牌宽 - origin.x，即右对齐到牌右缘）。
   * - left：贴框左缘
   * - center：框内居中
   * - right：贴框右缘
   */
  align?: 'left' | 'center' | 'right';
  /** 对齐框宽度（mm）；缺省 = 号牌宽 - origin.x */
  width?: Mm;
  /**
   * 该序列属于号牌注册号主串（参与整串格式校验与展示）。
   * 牌面上的装饰文字（州名、口号、右侧地区带等）不要标记。
   */
  primary?: boolean;
  /**
   * 内容超出对齐框宽度时，按比例压缩所有字符步进（pitch 与 gap）使其恰好填满框宽。
   * 用于字符数可变的号牌（美国 6–8 位、欧盟地区代码 1–3 位、日本一连番号），
   * 模拟实际号牌软件的「自动压缩」行为。字高不变，仅横向压缩（fill 模式承接）。
   */
  shrinkToFit?: boolean;
}

/** 线性字符序列（绝大多数号牌的布局形式）。 */
export interface CharacterRun {
  kind: 'run';
  /** 序列中第一个单元格左上角（mm，号牌坐标系） */
  origin: { x: Mm; y: Mm };
  /**
   * 单元格之间的附加间距（mm）。
   * 单元格自身的步进（pitch）取自 CharClass.advance（缺省 = width），
   * 因此相邻字符中心距 = advance + gap。中国 GA 36-2018 表3 的「间隔」即此 gap。
   */
  gap: Mm;
  slots: Slot[];
  /** center = 整个序列相对号牌中线居中（用于字符数可变的情况） */
  align?: 'left' | 'center';
  /**
   * 该序列属于号牌注册号主串（参与整串格式校验与展示）。
   * 固定字面量槽位（如中国号牌尾字「挂/学/警」）因此会进入主串。
   */
  primary?: boolean;
}

/** 布局序列：静态槽位（run）或自由文本（free）。 */
export type Run = CharacterRun | FreeRun;

/** 分隔点「·」——矢量绘制，不用字体字形（Latin.ttf 无 U+00B7），也不用外链图片。 */
export interface CircleDecoration {
  kind: 'circle';
  cx: Mm;
  cy: Mm;
  r: Mm;
  fill: Fill;
}

export interface RectDecoration {
  kind: 'rect';
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
  fill: Fill;
  radius?: Mm;
  /** 可选描边 */
  stroke?: { color: Color; width: Mm };
}

/** 安装孔/螺栓。 */
export interface ScrewDecoration {
  kind: 'screws';
  positions: { x: Mm; y: Mm }[];
  r: Mm;
  fill?: Color;
  stroke?: Color;
}

/** 需要真实几何构造的装饰（欧盟 12 星环等），由组件注册表分发。 */
export interface ComponentDecoration {
  kind: 'component';
  name: string;
  props?: Record<string, unknown>;
}

export type Decoration =
  | CircleDecoration
  | RectDecoration
  | ScrewDecoration
  | ComponentDecoration;

/** 用户可编辑字段的输入规格。 */
export interface FieldSpec {
  key: string;
  label: string;
  maxLength: number;
  minLength?: number;
  /** 允许输入的字符集（用于校验与输入约束） */
  charset?: string;
  /** 输入提示，如「京」 */
  placeholder?: string;
  help?: string;
}

/** 号牌类型 —— 一个完整的、可渲染的号牌规格。 */
export interface PlateType {
  id: string;
  /** 显示名，如「小型汽车号牌」 */
  label: string;
  /** 标准出处，如「GA 36-2018 表1 / 表2 / 表3 / 表4」 */
  citation: string;
  size: { width: Mm; height: Mm };
  body: { fill: Fill; radius: Mm };
  /** 边框（内缩描边）；width=0 表示无边框 */
  border: { width: Mm; fill: Fill };
  charClasses: Record<string, CharClass>;
  runs: Run[];
  decorations: Decoration[];
  fields: FieldSpec[];
  /** 各字段默认值 */
  defaults: Record<string, string>;
  /** 完整号牌串校验正则（用于「非法的牌号」提示） */
  pattern?: RegExp;
  /** 生成示例（预设按钮用） */
  sample?: string;
}

/** 一个国家/地区的全部号牌类型。 */
export interface Standard {
  region: Region;
  /** 国家/地区名 */
  name: string;
  /** 标准文件名，如「GA 36-2018 中华人民共和国机动车号牌」 */
  citation: string;
  types: PlateType[];
}

/** 布局结果：一个待绘制的字形。 */
export interface PlacedGlyph {
  char: string;
  cls: CharClass;
  /** 单元格左上角与尺寸（mm） */
  cell: { x: Mm; y: Mm; w: Mm; h: Mm };
}
