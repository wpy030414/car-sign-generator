/**
 * 号牌预览：包装通用 PlateSvg，注入字体加载与各国装饰组件（欧盟蓝带、中国分隔点）。
 *
 * 字体加载：挂载/切换类型时确保该类型用到的字体已加载（屏幕渲染），
 * 并预热 base64 缓存（导出用）。字体加载是副作用，故用 effect 触发；
 * 但渲染不阻塞于字体就绪 —— 字体到达后浏览器自动重排字形，无需额外 state。
 */

import { useEffect } from 'react';
import { CnDot } from './plates/CnDot';
import { EuBand } from './plates/EuBand';
import { PlateSvg, type DecorationRenderer } from './plates/PlateSvg';
import { ensureFontsLoaded, warmFontCache } from '@/lib/plate/fonts';
import { fontsOfType, getPlateType } from '@/lib/standards';
import type { ComponentDecoration, PlateType } from '@/types/standard';

const DECORATIONS: Record<string, DecorationRenderer> = {
  'eu-band': (dec: ComponentDecoration, ctx) => (
    <EuBand dec={dec} type={ctx.type} values={ctx.values} idPrefix={ctx.idPrefix} />
  ),
  'cn-dot': (dec: ComponentDecoration, ctx) => (
    <CnDot dec={dec} type={ctx.type} values={ctx.values} />
  ),
};

export interface PlatePreviewProps {
  type: PlateType;
  values: Record<string, string>;
  showScrews?: boolean;
  /** 导出时用于拿到 svg 元素 */
  svgRef?: React.Ref<SVGSVGElement>;
  className?: string;
}

export function PlatePreview({ type, values, showScrews = true, svgRef, className }: PlatePreviewProps) {
  useEffect(() => {
    let alive = true;
    const fonts = fontsOfType(type);
    // 屏幕渲染字体；加载失败也继续（回退字形），导出时才严格要求内联
    ensureFontsLoaded(fonts).catch(() => undefined);
    // 空闲时预热 base64（不阻塞首屏）
    const id = window.setTimeout(() => {
      if (alive) warmFontCache(fonts).catch(() => undefined);
    }, 800);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [type]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      <PlateSvg
        type={type}
        values={values}
        componentDecorations={DECORATIONS}
        showScrews={showScrews}
        svgRef={svgRef}
      />
    </div>
  );
}

/** 便捷：按 typeId 渲染。 */
export function PlatePreviewById({
  typeId,
  values,
  ...rest
}: { typeId: string; values: Record<string, string> } & Omit<PlatePreviewProps, 'type' | 'values'>) {
  const type = getPlateType(typeId);
  return <PlatePreview type={type} values={values} {...rest} />;
}
