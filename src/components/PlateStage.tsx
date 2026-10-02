/**
 * 号牌预览舞台：承载 PlatePreview，向上暴露 svg 元素引用（导出用），
 * 并显示号牌物理尺寸 / 校验状态等信息。
 *
 * 预览容器宽度自适应，SVG 以 mm 比例（viewBox）缩放，保证所见即所得。
 */

import { forwardRef } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { PlatePreview } from './PlatePreview';
import { Badge } from '@/components/ui/badge';
import { validatePlate } from '@/lib/plate/validate';
import type { PlateType } from '@/types/standard';

export interface PlateStageProps {
  type: PlateType;
  values: Record<string, string>;
  showScrews: boolean;
}

export const PlateStage = forwardRef<SVGSVGElement, PlateStageProps>(
  function PlateStage({ type, values, showScrews }, svgRef) {
    const result = validatePlate(type, values);
    const { width, height } = type.size;

    return (
      <div className="flex flex-col items-center gap-4">
        {/* 号牌预览：放在带棋盘格背景的容器里，便于观察透明/白色号牌边界 */}
        <div
          className="w-full max-w-3xl rounded-xl border bg-muted/30 p-6 sm:p-10"
          style={{
            backgroundImage:
              'linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.04) 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          <PlatePreview
            type={type}
            values={values}
            showScrews={showScrews}
            svgRef={svgRef}
            className="mx-auto"
          />
        </div>

        {/* 信息条：物理尺寸 + 校验状态 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {width} × {height} mm
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            比例 {(width / height).toFixed(2)}:1
          </Badge>
          {result.ok ? (
            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              合法号牌
            </Badge>
          ) : (
            <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {result.patternError ?? result.fieldErrors[0]?.message ?? '格式有误'}
            </Badge>
          )}
        </div>
      </div>
    );
  },
);
