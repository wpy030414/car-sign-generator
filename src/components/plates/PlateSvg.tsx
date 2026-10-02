/**
 * 通用号牌 SVG 渲染引擎。
 *
 * 坐标系：**1 SVG user unit = 1 mm**。viewBox = "0 0 W H"（W/H 为号牌 mm 尺寸），
 * 所有物理量直接落图，无单位换算。屏幕渲染时 SVG 无 width/height（仅 viewBox），
 * 由 CSS 撑满容器、preserveAspectRatio 锁定比例；导出时才写入像素尺寸。
 *
 * 纯函数组件：只依赖 (PlateType, values) props，不访问 store，
 * 因此导出路径可以直接序列化渲染出的同一份 DOM。
 *
 * 特殊几何装饰（欧盟 12 星环等）通过 `componentDecorations` 注册表分发，
 * 由各国布局组件注入。
 */

import { useId, type ReactNode } from 'react';
import { gradientVector, resolveFill } from '@/lib/plate/fill';
import { glyphTransform, layoutAny, pitchOf } from '@/lib/plate/layout';
import type {
  ComponentDecoration,
  Fill,
  PlateType,
  RectDecoration,
  ScrewDecoration,
} from '@/types/standard';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** 组件装饰渲染器注册表：name → 渲染函数。 */
export type DecorationRenderer = (
  dec: ComponentDecoration,
  ctx: { type: PlateType; values: Record<string, string>; idPrefix: string },
) => ReactNode;

export interface PlateSvgProps {
  type: PlateType;
  values: Record<string, string>;
  /** 组件装饰渲染器注册表（欧盟蓝带等） */
  componentDecorations?: Record<string, DecorationRenderer>;
  /** 是否绘制安装孔（编辑器可关闭以获得干净预览） */
  showScrews?: boolean;
  /** 额外的 className（容器样式） */
  className?: string;
  /** 透传到 svg 元素，导出时用于定位 */
  svgRef?: React.Ref<SVGSVGElement>;
}

/** 渲染一个 Fill 到 <defs>（渐变）并返回 paint 引用。 */
function useFillPaint(fill: Fill, key: string): { paint: string; def: ReactNode } {
  const uid = useId().replace(/:/g, '');
  const idPrefix = `${uid}-${key}`;
  const { paint, defs } = resolveFill(fill, idPrefix);
  if (!defs) return { paint, def: null };
  const v = gradientVector(defs.angle);
  const def = (
    <linearGradient id={defs.id} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
      {defs.stops.map((s, i) => (
        <stop key={i} offset={`${s.at * 100}%`} stopColor={s.color} />
      ))}
    </linearGradient>
  );
  return { paint, def };
}

/** 矩形装饰。 */
function RectDeco({ dec }: { dec: RectDecoration }) {
  return (
    <rect
      x={dec.x}
      y={dec.y}
      width={dec.w}
      height={dec.h}
      rx={dec.radius}
      fill={dec.fill.kind === 'solid' ? dec.fill.color : undefined}
      stroke={dec.stroke?.color}
      strokeWidth={dec.stroke?.width}
    />
  );
}

/** 安装孔装饰（腰形孔：用圆角矩形近似）。 */
function ScrewDeco({ dec }: { dec: ScrewDecoration }) {
  return (
    <>
      {dec.positions.map((p, i) => (
        <rect
          key={i}
          x={p.x - dec.r}
          y={p.y - dec.r / 2.6}
          width={dec.r * 2}
          height={dec.r / 1.3}
          rx={dec.r / 2.6}
          fill={dec.fill ?? '#FFFFFF'}
          stroke={dec.stroke ?? '#888888'}
          strokeWidth={0.6}
        />
      ))}
    </>
  );
}

export function PlateSvg({
  type,
  values,
  componentDecorations = {},
  showScrews = true,
  className,
  svgRef,
}: PlateSvgProps) {
  const uid = useId().replace(/:/g, '');
  const { width: W, height: H } = type.size;

  // 号牌底色（可能是渐变）
  const bodyFill = useFillPaint(type.body.fill, 'body');
  const borderFill = useFillPaint(type.border.fill, 'border');

  const idPrefix = uid;

  return (
    <svg
      ref={svgRef}
      xmlns={SVG_NS}
      viewBox={`0 0 ${W} ${H}`}
      data-plate-svg={type.id}
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>{bodyFill.def}</defs>

      {/* 板体 */}
      <rect x={0} y={0} width={W} height={H} rx={type.body.radius} fill={bodyFill.paint} />

      {/* 边框（内缩描边）；width=0 表示无 */}
      {type.border.width > 0 && (
        <rect
          x={type.border.width / 2}
          y={type.border.width / 2}
          width={W - type.border.width}
          height={H - type.border.width}
          rx={Math.max(0, type.body.radius - type.border.width / 2)}
          fill="none"
          stroke={borderFill.paint}
          strokeWidth={type.border.width}
        />
      )}

      {/* 装饰：矩形 / 安装孔 / 组件（欧盟蓝带等） */}
      {type.decorations.map((dec, i) => {
        if (dec.kind === 'rect') return <RectDeco key={i} dec={dec} />;
        if (dec.kind === 'screws') return showScrews ? <ScrewDeco key={i} dec={dec} /> : null;
        if (dec.kind === 'circle') {
          const f = dec.fill.kind === 'solid' ? dec.fill.color : '#000';
          return <circle key={i} cx={dec.cx} cy={dec.cy} r={dec.r} fill={f} />;
        }
        if (dec.kind === 'component') {
          const renderer = componentDecorations[dec.name];
          return renderer ? (
            <g key={i}>{renderer(dec, { type, values, idPrefix: `${idPrefix}-${i}` })}</g>
          ) : null;
        }
        return null;
      })}

      {/* 字符序列 */}
      {type.runs.map((run, ri) => (
        <g key={ri}>
          {layoutAny(run, type, values).map((g, gi) => {
            if (!g) return null;
            const { transform, fontSize } = glyphTransform(g.char, g.cls, g.cell);
            const fill = g.cls.fill.kind === 'solid' ? g.cls.fill.color : '#000';
            const weight = g.cls.font.weight ?? 'normal';
            return (
              <text
                key={gi}
                transform={transform}
                fontSize={fontSize}
                fontFamily={`'${g.cls.font.family}', sans-serif`}
                fontWeight={weight}
                fill={fill}
                // 以 1em=1mm 基准绘制，transform 负责精确缩放定位
                x={0}
                y={0}
                textAnchor="start"
                dominantBaseline="alphabetic"
                style={{ whiteSpace: 'pre' }}
              >
                {g.char}
              </text>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** 导出 pitchOf 以便装饰组件（如圆点定位）复用。 */
export { pitchOf };
