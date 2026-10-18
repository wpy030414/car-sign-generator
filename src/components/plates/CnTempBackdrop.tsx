/**
 * 临时行驶车号牌底纹与区域签注（GA 36-2018 6.6.2 / 附录 B.18–B.21）。
 *
 * 官方纸质号牌由三层组成：
 *   1. 白色纸基；
 *   2. 满版浅色防伪网格 —— 行政辖区为天（酞）蓝 PB09，其余三类为棕黄 YR06；
 *   3. 中央古代车马线描暗记。
 *
 * 官方底纹是专色印刷的防伪图案，本标准库以 SVG `<pattern>` + 矢量线描**近似重建**：
 * 保留「网格 + 车马暗记」的结构与视觉密度，不追求逐笔复刻。全部为内联矢量，
 * 导出 4K PNG 时不依赖任何外部资源。
 *
 * 另含「限定在 ___ 区域内行驶」的自由填写区域：系统宋体、自然排版，
 * 不参与号牌字体的 mm 单元格拟合。
 */

import { useId } from 'react';

/** 底纹单元尺寸（mm）。实测横向约 9.8、纵向约 9.6，取 9.7 近似。 */
const TILE = 9.8;

export interface CnTempBackdropProps {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** 底纹专色（天蓝 / 棕黄印花近似色） */
  color: string;
  /** 纸基颜色 */
  base?: string;
}

/** 车马暗记：两匹奔马 + 双轮车，归一化到 160×86 的线描。 */
function ChariotMark({
  x,
  y,
  width,
  height,
  color,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}) {
  const s = Math.min(width / 200, height / 105);
  const tx = x + width / 2 - 80 * s;
  const ty = y + height / 2 - 43 * s;

  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return (
      <line
        key={i}
        x1={150 + Math.cos(a) * 2.2}
        y1={63 + Math.sin(a) * 2.2}
        x2={150 + Math.cos(a) * 13}
        y2={63 + Math.sin(a) * 13}
      />
    );
  });

  return (
    <g
      transform={`translate(${tx} ${ty}) scale(${s})`}
      fill="none"
      stroke={color}
      strokeWidth={0.82}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={1}
      data-temp-watermark
    >
      {/* 挽具 / 缰绳 */}
      <path d="M 72 16 C 91 19 108 27 119 36" />
      <path d="M 62 22 C 82 28 103 36 116 43" />

      {/* 前马 */}
      <path d="M 20 42 C 22 31 38 28 52 31 C 60 33 61 42 54 45 C 41 49 25 49 20 42 Z" />
      <path d="M 52 31 C 56 23 60 16 65 12 C 69 10 73 11 75 14 C 72 18 68 22 64 27 L 60 35" />
      <path d="M 65 12 C 70 8 76 7 79 10 C 79 14 73 17 68 16" />
      <path d="M 70 8 L 69 4 M 74 8 L 75 4" />
      <path d="M 58 18 C 62 20 63 26 60 32 M 61 15 C 65 18 67 24 64 30" />
      <path d="M 27 45 L 22 64 M 34 46 L 30 66 M 46 46 L 49 64 M 52 44 L 58 60" />
      <path d="M 20 42 C 12 43 8 50 10 57 C 12 53 15 50 19 48" />

      {/* 后马（略错位，形成两马并驾） */}
      <g transform="translate(14 -3)">
        <path d="M 20 42 C 22 31 38 28 52 31 C 60 33 61 42 54 45 C 41 49 25 49 20 42 Z" />
        <path d="M 52 31 C 56 23 60 16 65 12 C 69 10 73 11 75 14 C 72 18 68 22 64 27 L 60 35" />
        <path d="M 65 12 C 70 8 76 7 79 10 C 79 14 73 17 68 16" />
        <path d="M 70 8 L 69 4 M 74 8 L 75 4" />
        <path d="M 58 18 C 62 20 63 26 60 32 M 61 15 C 65 18 67 24 64 30" />
        <path d="M 27 45 L 22 64 M 34 46 L 30 66 M 46 46 L 49 64 M 52 44 L 58 60" />
        <path d="M 20 42 C 12 43 8 50 10 57 C 12 53 15 50 19 48" />
      </g>

      {/* 车辕与车厢 */}
      <path d="M 80 36 L 120 43" />
      <path d="M 118 38 L 146 38 L 149 57 L 116 57 Z" />
      <path d="M 120 44 L 146 44 M 122 50 L 147 50" />
      <path d="M 124 38 C 128 33 136 33 140 38" />

      {/* 车盖 */}
      <path d="M 124 26 C 131 18 146 18 153 26 C 146 31 131 31 124 26 Z" />
      <path d="M 138 26 L 138 38" />
      <path d="M 128 24 L 124 20 M 148 24 L 152 20 M 133 21 L 131 16 M 143 21 L 145 16" />

      {/* 车轮 */}
      <circle cx={150} cy={63} r={15} />
      <circle cx={150} cy={63} r={12.5} />
      <circle cx={150} cy={63} r={2.2} />
      {spokes}
      <path d="M 146 57 L 150 63" />
    </g>
  );
}

export function CnTempBackdrop({
  x,
  y,
  width,
  height,
  radius,
  color,
  base = '#FFFFFF',
}: CnTempBackdropProps) {
  const uid = useId().replace(/:/g, '');
  const patternId = `temp-pat-${uid}`;
  const clipId = `temp-clip-${uid}`;
  const c = TILE / 2;

  return (
    <g data-temp-backdrop={color}>
      <defs>
        <pattern id={patternId} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <g fill={color} stroke={color}>
            {/* 对角线：把相邻花结连成连续网格 */}
            <path
              d={`M 0 0 L ${TILE} ${TILE} M ${TILE} 0 L 0 ${TILE}`}
              fill="none"
              strokeWidth={0.4}
              opacity={0.5}
            />
            {/* 四角花结：四片斜向花瓣，拼贴后成为完整的蝴蝶结 */}
            {[
              [0, 0],
              [TILE, 0],
              [0, TILE],
              [TILE, TILE],
            ].map(([cx, cy], i) => (
              <g key={i} transform={`translate(${cx} ${cy})`}>
                {[45, -45, 135, -135].map((a, j) => (
                  <ellipse key={j} rx={0.9} ry={2.2} transform={`rotate(${a})`} />
                ))}
                <circle r={0.5} fill={base} stroke="none" />
              </g>
            ))}
            {/* 中央梭形环 + 菱形芯 */}
            <ellipse cx={c} cy={c} rx={2.05} ry={4.35} fill={base} strokeWidth={0.9} />
            <path
              d={`M ${c - 0.95} ${c} L ${c} ${c - 0.95} L ${c + 0.95} ${c} L ${c} ${c + 0.95} Z`}
              stroke="none"
              opacity={0.85}
            />
          </g>
        </pattern>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={radius} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect x={x} y={y} width={width} height={height} fill={base} />
        <rect x={x} y={y} width={width} height={height} fill={`url(#${patternId})`} opacity={0.8} />
        <ChariotMark x={x} y={y} width={width} height={height} color={color} />
      </g>
    </g>
  );
}

/** 系统宋体字族：macOS Songti SC / Windows SimSun / Linux Noto Serif CJK。 */
const SONGTI_STACK =
  "'Songti SC', 'SimSun', 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', serif";

export interface CnTempRegionProps {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  text: string;
}

/**
 * 「限定在 ___ 区域内行驶」的自由填写区域。
 *
 * 区域名称不是号牌注册号，不需要按 mm 单元格做 ink 拟合；这里直接用一条
 * 自然排版的 `<text>`（系统宋体、水平居中）。字体**不内联**：宋体是用户
 * 机器上的系统字体，导出时由浏览器按 font-family 栈解析。
 * 文本过长时用 `textLength` 压缩到签注栏宽度，避免压到两侧固定文字。
 */
export function CnTempRegion({ x, y, width, fontSize, text }: CnTempRegionProps) {
  if (!text) return null;
  const natural = Array.from(text).length * fontSize;
  const squeeze = natural > width;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={fontSize}
      fontFamily={SONGTI_STACK}
      fill="#111111"
      textLength={squeeze ? width : undefined}
      lengthAdjust={squeeze ? 'spacingAndGlyphs' : undefined}
      data-temp-region={text}
    >
      {text}
    </text>
  );
}
