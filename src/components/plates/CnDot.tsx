/**
 * 中国号牌分隔点「·」装饰组件。
 *
 * 分隔点位于「省 + 发牌机关字母」与「序号」之间。由于字符序列可能居中（align:center），
 * 点的实际位置随布局浮动，故这里复用 layoutRun 计算出字母与序号单元格的真实坐标，
 * 再把圆点放在二者之间的间隙中央 —— 矢量绘制，不依赖字体字形（Latin.ttf 无 U+00B7），
 * 也不用外链图片（旧实现曾引用 imgtp.com 的 PNG，会污染导出画布）。
 */

import { layoutRun, pitchOf } from '@/lib/plate/layout';
import type { ComponentDecoration, PlateType } from '@/types/standard';

export interface CnDotProps {
  dec: ComponentDecoration;
  type: PlateType;
  values: Record<string, string>;
}

export function CnDot({ dec, type, values }: CnDotProps) {
  const props = (dec.props ?? {}) as { runIndex?: number; after?: number; r?: number; color?: string };
  const runIndex = props.runIndex ?? 0;
  const after = props.after ?? 1; // 默认在第 2 个字符（字母）之后
  const r = props.r ?? 5;
  const color = props.color ?? '#000000';

  const run = type.runs[runIndex];
  if (!run || run.kind !== 'run') return null;

  const placed = layoutRun(run, type, values);
  const letter = placed[after]; // 发牌机关字母
  const serial = placed[after + 1]; // 首个序号字符
  if (!letter || !serial) return null;

  const letterRight = letter.cell.x + pitchOf(letter.cls);
  const serialLeft = serial.cell.x;
  const cx = (letterRight + serialLeft) / 2;
  // 垂直居中于字符高度
  const cy = letter.cell.y + letter.cell.h / 2;

  return <circle cx={cx} cy={cy} r={r} fill={color} />;
}
