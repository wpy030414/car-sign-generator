/**
 * 号牌预览：包装通用 PlateSvg，注入字体加载与欧盟蓝带装饰。
 *
 * 字体加载：挂载/切换类型时确保该类型用到的字体已加载（屏幕渲染），
 * 并预热 base64 缓存（导出用）。字体未就绪时用 loading 占位，避免度量错误。
 */

import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  const innerRef = useRef<SVGSVGElement | null>(null);

  // 把内部 ref 同时暴露给外部（导出用）
  const setRefs = (el: SVGSVGElement | null) => {
    innerRef.current = el;
    if (typeof svgRef === 'function') svgRef(el);
    else if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
  };

  useEffect(() => {
    let alive = true;
    const fonts = fontsOfType(type);
    setReady(false);
    ensureFontsLoaded(fonts)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true); // 字体加载失败也渲染（回退字形），导出时才严格
      });
    // 空闲时预热 base64（不阻塞首屏）
    const id = window.setTimeout(() => warmFontCache(fonts).catch(() => undefined), 800);
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
        svgRef={setRefs}
      />
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        />
      )}
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
