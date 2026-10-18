/**
 * 号牌预览舞台：承载 PlatePreview，向上暴露 svg 元素引用（导出用），
 * 并显示号牌物理尺寸 / 校验状态等信息。
 *
 * 预览容器宽度自适应，SVG 以 mm 比例（viewBox）缩放，保证所见即所得。
 * 预览区左下角提供缩放控制（25%–300%），右下角切换全屏预览。
 *
 * 全屏用**应用内覆盖层**而非 Fullscreen API：iOS Safari 没有 requestFullscreen，
 * 且覆盖层不依赖用户手势/权限、Esc 退出与背景滚动锁的行为完全可控、便于 E2E 断言。
 * 缩放与全屏是观看者的本地偏好，不进 URL —— 分享链接只承载号牌配置本身。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { AlertTriangle, CheckCircle2, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { PlatePreview } from './PlatePreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validatePlate } from '@/lib/plate/validate';
import type { PlateType } from '@/types/standard';

/** 缩放档位：25%–300%，步进 25%。 */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/** 吸附到步进并夹在范围内，消除浮点累加误差。 */
function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z / ZOOM_STEP) * ZOOM_STEP));
}

/** 棋盘格背景（便于观察白色/透明号牌边界）。 */
const CHECKER_STYLE = {
  backgroundImage:
    'linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.04) 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
} as const;

export interface PlateStageProps {
  type: PlateType;
  values: Record<string, string>;
  showScrews: boolean;
  emboss: boolean;
}

export const PlateStage = forwardRef<SVGSVGElement, PlateStageProps>(function PlateStage(
  { type, values, showScrews, emboss },
  svgRef,
) {
  const result = validatePlate(type, values);
  const { width, height } = type.size;

  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => clampZoom(z + delta));
  }, []);

  // 缩放后把画布居中：否则内容右上溢出、左侧留白，看起来像右侧边距被吃掉。
  // 100%（无溢出）时居中量为 0，不影响默认布局。
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom, fullscreen]);

  // 全屏：Esc 退出 + 锁定页面滚动，退出时恢复原状
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 号牌预览：棋盘格背景 + 可滚动画布，左下缩放 / 右下全屏 */}
      <div
        data-plate-stage
        data-fullscreen={fullscreen ? 'true' : undefined}
        style={{ '--plate-zoom': zoom } as CSSProperties}
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-xl border bg-muted/30',
          fullscreen && 'fixed inset-0 z-50 rounded-none border-0 bg-background',
        )}
      >
        {/* 滚动视口只负责裁剪/滚动，棋盘格背景铺满整个预览区 */}
        <div
          ref={viewportRef}
          data-plate-viewport
          className={cn('min-h-0 overflow-auto', fullscreen ? 'flex-1' : 'max-h-[70vh]')}
          style={CHECKER_STYLE}
        >
          {/*
              画布宽度 = zoom × 可用宽度 + 两侧留白。留白必须算进画布自身宽度：
              只写在滚动容器 padding 上时，内容溢出后右侧留白不进入可滚动区域，
              放大滚到尽头号牌会贴边（右侧边距为 0）。底部额外留出控制条空间。
            */}
          <div
            className={cn(
              'mx-auto flex min-h-full [--stage-pad:1.5rem] sm:[--stage-pad:2.5rem]',
              fullscreen && '[--stage-pad:2.5rem] sm:[--stage-pad:4rem]',
            )}
            style={{
              width:
                'calc(var(--plate-zoom) * (100% - 2 * var(--stage-pad)) + 2 * var(--stage-pad))',
              padding: 'var(--stage-pad)',
              paddingBottom: 'calc(var(--stage-pad) + 1.5rem)',
            }}
          >
            <div data-plate-zoom className="m-auto w-full shrink-0">
              <PlatePreview
                type={type}
                values={values}
                showScrews={showScrews}
                emboss={emboss}
                svgRef={svgRef}
                className="mx-auto"
              />
            </div>
          </div>
        </div>

        {/* 浮层控件：不拦截画布的拖拽/滚动，仅按钮可点 */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
          <div
            role="group"
            aria-label="预览缩放"
            className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-background/90 p-0.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/70"
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="缩小"
              title="缩小"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => zoomBy(-ZOOM_STEP)}
            >
              <Minus />
            </Button>
            <button
              type="button"
              aria-label="重置缩放为 100%"
              title="重置为 100%"
              onClick={() => setZoom(1)}
              className="min-w-11 rounded-md px-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="放大"
              title="放大"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => zoomBy(ZOOM_STEP)}
            >
              <Plus />
            </Button>
          </div>

          <div className="pointer-events-auto rounded-lg border bg-background/90 p-0.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={fullscreen ? '退出全屏' : '全屏预览'}
              title={fullscreen ? '退出全屏（Esc）' : '全屏预览'}
              aria-pressed={fullscreen}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </div>
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
});
