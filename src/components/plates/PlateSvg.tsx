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
import { EMBOSS, diffuseTransfer } from '@/lib/plate/emboss';
import { gradientVector, resolveFill } from '@/lib/plate/fill';
import { glyphTransform, layoutAny, r } from '@/lib/plate/layout';
import type {
  ComponentDecoration,
  Fill,
  FontRef,
  PlateType,
  RectDecoration,
  ScrewDecoration,
} from '@/types/standard';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** CSS font-family 栈：沿 FontRef.fallback 链，与布局度量的回退顺序一致。 */
function fontStack(font: FontRef): string {
  const families: string[] = [];
  for (let f: FontRef | undefined = font; f; f = f.fallback) families.push(`'${f.family}'`);
  families.push('sans-serif');
  return families.join(', ');
}

/** 组件装饰渲染器注册表：name → 渲染函数。 */
export type DecorationRenderer = (
  dec: ComponentDecoration,
  ctx: {
    type: PlateType;
    values: Record<string, string>;
    idPrefix: string;
    /** 是否模拟冲压（分隔点等矢量装饰需要同步处理） */
    emboss?: boolean;
    /** 冲压模糊滤镜 id（挂在 <g> 上，mm 坐标系） */
    embossFilterId?: string;
  },
) => ReactNode;

export interface PlateSvgProps {
  type: PlateType;
  values: Record<string, string>;
  /** 组件装饰渲染器注册表（欧盟蓝带等） */
  componentDecorations?: Record<string, DecorationRenderer>;
  /** 是否绘制安装孔（编辑器可关闭以获得干净预览） */
  showScrews?: boolean;
  /** 是否模拟冲压：字符左上亮阴影 + 右下暗阴影 */
  emboss?: boolean;
  /** 额外的 className（容器样式） */
  className?: string;
  /** 透传到 svg 元素，导出时用于定位 */
  svgRef?: React.Ref<SVGSVGElement>;
}

/**
 * 冲压滤镜：alpha → 高度场 → 法线 → 定向光。
 *
 * 高斯模糊把字符 alpha 变成圆滑的「高度丘」，再用 `feSpecularLighting`
 * （高光）与 `feDiffuseLighting`（暗面）按同一盏左上方向光计算明暗。
 * 明暗随轮廓法线连续变化，圆弧/转折处不会像偏移剪影那样出现空缺。
 *
 * 坐标：滤镜在 mm 用户坐标系内计算（挂在包裹 <g> 上，而不是带 scale 的 <text>），
 * 因此预览与 4K 导出得到完全一致的倒角宽度。
 */
function EmbossFilter({ id }: { id: string }) {
  const margin = `${Math.round(EMBOSS.regionMargin * 100)}%`;
  const { slope, intercept } = diffuseTransfer();
  const light = <feDistantLight azimuth={EMBOSS.lightAzimuth} elevation={EMBOSS.lightElevation} />;
  return (
    <filter
      id={id}
      x={`-${margin}`}
      y={`-${margin}`}
      width={`${100 + EMBOSS.regionMargin * 200}%`}
      height={`${100 + EMBOSS.regionMargin * 200}%`}
      colorInterpolationFilters="sRGB"
    >
      {/* 高度场 */}
      <feGaussianBlur in="SourceAlpha" stdDeviation={EMBOSS.blurSigmaMm} result="height" />
      {/* 左上高光 */}
      <feSpecularLighting
        in="height"
        surfaceScale={EMBOSS.surfaceScale}
        specularConstant={EMBOSS.specularConstant}
        specularExponent={EMBOSS.specularExponent}
        lightingColor="#FFFFFF"
        result="specular"
      >
        {light}
      </feSpecularLighting>
      <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularIn" />
      {/* 右下暗面：平面归一化为 1，只压暗背光侧 */}
      <feDiffuseLighting
        in="height"
        surfaceScale={EMBOSS.surfaceScale}
        diffuseConstant={1}
        lightingColor="#FFFFFF"
        result="diffuse"
      >
        {light}
      </feDiffuseLighting>
      <feComponentTransfer in="diffuse" result="diffuseNorm">
        <feFuncR type="linear" slope={slope} intercept={intercept} />
        <feFuncG type="linear" slope={slope} intercept={intercept} />
        <feFuncB type="linear" slope={slope} intercept={intercept} />
      </feComponentTransfer>
      <feComposite in="diffuseNorm" in2="SourceAlpha" operator="in" result="shade" />
      {/* 原色 × 明暗，再叠加高光；最后用字形 alpha 收回边缘 */}
      <feBlend in="SourceGraphic" in2="shade" mode="multiply" result="shaded" />
      <feComposite
        in="specularIn"
        in2="shaded"
        operator="arithmetic"
        k1={0}
        k2={1}
        k3={1}
        k4={0}
        result="lit"
      />
      <feComposite in="lit" in2="SourceAlpha" operator="in" result="glyph" />
      {/* 投射阴影：凸起字符在背光侧（右下）落到牌面上的影子 */}
      <feOffset
        in="SourceAlpha"
        dx={EMBOSS.castOffsetMm}
        dy={EMBOSS.castOffsetMm}
        result="castOff"
      />
      <feGaussianBlur in="castOff" stdDeviation={EMBOSS.castBlurMm} result="castBlur" />
      <feFlood floodColor="#000000" floodOpacity={EMBOSS.castOpacity} result="castColor" />
      <feComposite in="castColor" in2="castBlur" operator="in" result="cast" />
      <feComposite in="glyph" in2="cast" operator="over" />
    </filter>
  );
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
      {dec.positions.map((p, i) => {
        // 长圆孔：宽 2r、高 height；两端半圆与高度相切
        const w = dec.r * 2;
        const h = dec.height ?? dec.r;
        return (
          <rect
            key={i}
            x={p.x - w / 2}
            y={p.y - h / 2}
            width={w}
            height={h}
            rx={Math.min(w, h) / 2}
            fill={dec.fill ?? '#FFFFFF'}
            stroke={dec.stroke ?? '#888888'}
            strokeWidth={0.6}
          />
        );
      })}
    </>
  );
}

export function PlateSvg({
  type,
  values,
  componentDecorations = {},
  showScrews = true,
  emboss = false,
  className,
  svgRef,
}: PlateSvgProps) {
  const uid = useId().replace(/:/g, '');
  const { width: W, height: H } = type.size;

  // 号牌底色（可能是渐变）
  const bodyFill = useFillPaint(type.body.fill, 'body');
  const borderFill = useFillPaint(type.border.fill, 'border');
  const inset = type.border.inset ?? 0;

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
      <defs>
        {bodyFill.def}
        {/* 冲压：高度场 + 定向光照（user unit = mm） */}
        {emboss && <EmbossFilter id={`${uid}-emboss`} />}
      </defs>

      {/* 板体 */}
      <rect x={0} y={0} width={W} height={H} rx={type.body.radius} fill={bodyFill.paint} />

      {/*
        边框（内缩描边）；width=0 表示无。
        inset > 0 时边框外侧留一圈板体底色（如 GA 36：牌边 → 3mm 底色 → 2mm 白边）。
        整块冲压成型的号牌（GA 36）边框也参与浮雕。
      */}
      {type.border.width > 0 && (
        <g filter={emboss && type.border.emboss ? `url(#${uid}-emboss)` : undefined}>
          <rect
            data-plate-border
            x={inset + type.border.width / 2}
            y={inset + type.border.width / 2}
            width={W - 2 * inset - type.border.width}
            height={H - 2 * inset - type.border.width}
            rx={Math.max(0, type.body.radius - inset - type.border.width / 2)}
            fill="none"
            stroke={borderFill.paint}
            strokeWidth={type.border.width}
          />
        </g>
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
            <g key={i}>
              {renderer(dec, {
                type,
                values,
                idPrefix: `${idPrefix}-${i}`,
                emboss,
                embossFilterId: `${uid}-emboss`,
              })}
            </g>
          ) : null;
        }
        return null;
      })}

      {/*
        字符序列。冲压滤镜挂在**整层字符**上（而不是每个字符各挂一份）：
        - 高度场取所有字形 alpha 的并集，字符之间的光照与阴影天然一致；
        - 滤镜区域按整层包围盒计算，细小字形（连字符、分隔点）也不会被区域裁掉；
        - 只跑一次滤镜，4K 导出的耗时与字符数量无关。
      */}
      <g filter={emboss ? `url(#${uid}-emboss)` : undefined}>
        {type.runs.map((run, ri) => (
          <g key={ri}>
            {layoutAny(run, type, values).map((g, gi) => {
              if (!g) return null;
              const { transform, fontSize, hBold } = glyphTransform(g.char, g.cls, g.cell);
              const fill = g.cls.fill.kind === 'solid' ? g.cls.fill.color : '#000';
              const weight = g.cls.font.weight ?? 'normal';
              // hBold：再绘制一份水平偏移副本，只加粗竖画（补偿各向异性压缩）
              const copies = hBold > 0 ? [0, hBold / 2, hBold] : [0];
              const tid = `${uid}-g${ri}-${gi}`;
              return (
                <g key={gi}>
                  <text
                    id={tid}
                    transform={transform}
                    fontSize={fontSize}
                    fontFamily={fontStack(g.cls.font)}
                    fontWeight={weight}
                    fill={fill}
                    stroke={g.cls.outline ? fill : undefined}
                    strokeWidth={g.cls.outline}
                    vectorEffect={g.cls.outline ? 'non-scaling-stroke' : undefined}
                    paintOrder={g.cls.outline ? 'stroke' : undefined}
                    // 以 1em=1mm 基准绘制，transform 负责精确缩放定位
                    x={0}
                    y={0}
                    textAnchor="start"
                    dominantBaseline="alphabetic"
                    style={{ whiteSpace: 'pre' }}
                  >
                    {g.char}
                  </text>
                  {/* hBold 副本并入同一高度场，避免加粗笔画在冲压时被割裂 */}
                  {copies.slice(1).map((dx, k) => (
                    <use key={k} href={`#${tid}`} transform={`translate(${r(dx)} 0)`} />
                  ))}
                </g>
              );
            })}
          </g>
        ))}
      </g>
    </svg>
  );
}
