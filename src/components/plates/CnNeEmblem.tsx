/**
 * 新能源汽车号牌专用标识（GA 36-2018 附录 B.4/B.5）。
 *
 * 使用官方矢量图（Wikimedia Commons「新能源汽车号牌专用标志」）内联渲染：
 * SVG 以 data URI 嵌入，导出栅格化时不依赖任何外部资源。
 */

import neSymbolSvg from '@/assets/ne-symbol.svg?raw';

/** 官方标识的 data URI（构建期由 ?raw 导入的 SVG 编码得到）。 */
const NE_SYMBOL_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(neSymbolSvg)}`;

export interface CnNeEmblemProps {
  cx: number;
  cy: number;
  r: number;
}

export function CnNeEmblem({ cx, cy, r }: CnNeEmblemProps) {
  return (
    <image
      href={NE_SYMBOL_URI}
      x={cx - r}
      y={cy - r}
      width={r * 2}
      height={r * 2}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/** 大型新能源号牌内嵌的绿色圆角矩形。 */
export function CnNeGreenPanel({
  x,
  y,
  width,
  height,
  radius,
  color,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
}) {
  return <rect x={x} y={y} width={width} height={height} rx={radius} fill={color} />;
}
