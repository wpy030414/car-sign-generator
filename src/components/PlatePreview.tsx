/**
 * 号牌预览：包装通用 PlateSvg，注入字体加载与各国装饰组件（欧盟蓝带、中国分隔点）。
 *
 * 字体加载：按号牌类型收集字体并下载。字体就绪前不渲染 SVG，而是显示同比例的
 * 进度条占位 —— 避免 font-display:block 期间先出现一块空白号牌。
 * 字体加载失败时退回系统字体继续渲染（不阻塞预览）。
 */

import { useLayoutEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { CnDot } from './plates/CnDot';
import { CnNeEmblem, CnNeGreenPanel } from './plates/CnNeEmblem';
import { CnTempBackdrop, CnTempRegion } from './plates/CnTempBackdrop';
import { EuBand } from './plates/EuBand';
import { PlateSvg, type DecorationRenderer } from './plates/PlateSvg';
import { usePlateFontLoading, type FontLoadingState } from '@/lib/plate/useFontLoading';
import { getPlateType } from '@/lib/standards';
import type { ComponentDecoration, PlateType } from '@/types/standard';

const DECORATIONS: Record<string, DecorationRenderer> = {
  'eu-band': (dec: ComponentDecoration, ctx) => (
    <EuBand dec={dec} type={ctx.type} values={ctx.values} idPrefix={ctx.idPrefix} />
  ),
  'cn-dot': (dec: ComponentDecoration, ctx) => (
    <CnDot
      dec={dec}
      type={ctx.type}
      values={ctx.values}
      emboss={ctx.emboss}
      embossFilterId={ctx.embossFilterId}
    />
  ),
  'cn-ne-emblem': (dec: ComponentDecoration) => {
    const p = (dec.props ?? {}) as { cx?: number; cy?: number; r?: number };
    return <CnNeEmblem cx={p.cx ?? 137} cy={p.cy ?? 70} r={p.r ?? 14} />;
  },
  'cn-temp-backdrop': (dec: ComponentDecoration) => {
    const p = (dec.props ?? {}) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      radius?: number;
      color?: string;
      base?: string;
    };
    return (
      <CnTempBackdrop
        x={p.x ?? 2.4}
        y={p.y ?? 2.4}
        width={p.width ?? 215.2}
        height={p.height ?? 135.2}
        radius={p.radius ?? 2.2}
        color={p.color ?? '#7AD9DA'}
        base={p.base ?? '#FFFFFF'}
      />
    );
  },
  'cn-temp-region': (dec: ComponentDecoration, ctx) => {
    const p = (dec.props ?? {}) as {
      x?: number;
      y?: number;
      width?: number;
      fontSize?: number;
      field?: string;
    };
    const field = p.field ?? 'region';
    return (
      <CnTempRegion
        x={p.x ?? 103}
        y={p.y ?? 84}
        width={p.width ?? 101}
        fontSize={p.fontSize ?? 11.5}
        text={ctx.values[field] ?? ''}
      />
    );
  },
  'cn-ne-panel': (dec: ComponentDecoration) => {
    const p = (dec.props ?? {}) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      radius?: number;
      color?: string;
    };
    return (
      <CnNeGreenPanel
        x={p.x ?? 137}
        y={p.y ?? 8}
        width={p.width ?? 338}
        height={p.height ?? 124}
        radius={p.radius ?? 10}
        color={p.color ?? '#77CD74'}
      />
    );
  },
};

/** 字体加载占位：保持号牌宽高比，避免字体到达时布局跳动。 */
function FontLoadingPlaceholder({ type, state }: { type: PlateType; state: FontLoadingState }) {
  const percent = Math.round(state.ratio * 100);
  return (
    <div
      data-font-loading
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-lg border bg-muted"
      style={{ aspectRatio: `${type.size.width} / ${type.size.height}` }}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-background/70 via-muted to-background/40" />
      <div className="relative flex w-[min(76%,18rem)] flex-col items-center gap-1.5 px-4 py-3 text-center">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>
            {state.indeterminate && percent === 0 ? '字体加载中…' : `字体加载中… ${percent}%`}
            {state.totalFonts > 1 ? ` · ${state.loadedFonts}/${state.totalFonts}` : ''}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="字体加载进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.indeterminate ? undefined : percent}
          aria-valuetext={state.indeterminate ? '正在加载字体' : `${percent}%`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-background"
        >
          <div
            className={`h-full rounded-full bg-primary transition-[width] duration-200 ${state.indeterminate ? 'animate-pulse' : ''}`}
            style={{
              width: state.indeterminate && percent === 0 ? '35%' : `${percent}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export interface PlatePreviewProps {
  type: PlateType;
  values: Record<string, string>;
  showScrews?: boolean;
  /** 是否模拟冲压 */
  emboss?: boolean;
  /** 导出时用于拿到 svg 元素 */
  svgRef?: React.Ref<SVGSVGElement>;
  /** 字体是否已就绪（导出按钮据此禁用） */
  onFontsReadyChange?: (ready: boolean) => void;
  className?: string;
}

export function PlatePreview({
  type,
  values,
  showScrews = true,
  emboss = false,
  svgRef,
  onFontsReadyChange,
  className,
}: PlatePreviewProps) {
  const fontState = usePlateFontLoading(type);
  const ready = fontState.status !== 'loading';

  // 布局阶段同步通知，避免类型切换时导出按钮短暂停留在可用态
  useLayoutEffect(() => {
    onFontsReadyChange?.(ready);
  }, [ready, onFontsReadyChange]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      {ready ? (
        <PlateSvg
          type={type}
          values={values}
          componentDecorations={DECORATIONS}
          showScrews={showScrews}
          emboss={emboss}
          svgRef={svgRef}
        />
      ) : (
        <FontLoadingPlaceholder type={type} state={fontState} />
      )}
    </div>
  );
}

/** 便捷：按 typeId 渲染。 */
export function PlatePreviewById({
  typeId,
  values,
  ...rest
}: { typeId: string; values: Record<string, string> } & Omit<
  PlatePreviewProps,
  'type' | 'values'
>) {
  const type = getPlateType(typeId);
  return <PlatePreview type={type} values={values} {...rest} />;
}
