/**
 * 导出工具栏：选择分辨率档位（2K/4K/8K）+ 一键下载 PNG。
 *
 * 导出时从预览 SVG 元素克隆，内联 base64 字体，栅格化到目标像素。
 * 导出期间禁用按钮并显示 spinner，失败时弹出错误。
 */

import { useCallback, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPORT_SIZES, exportAndDownload, type ExportSize } from '@/lib/plate/export';
import { fontsOfType } from '@/lib/standards';
import { usePlateStore } from '@/store/plateStore';
import type { PlateType } from '@/types/standard';

const SIZE_LABELS: Record<ExportSize, string> = {
  '2K': '2K（长边 2560px）',
  '4K': '4K（长边 3840px）',
  '8K': '8K（长边 7680px）',
};

export interface ExportBarProps {
  type: PlateType;
  /** 预览 SVG 元素引用（由 PlateStage 通过 ref 暴露，导出时读取 .current） */
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function ExportBar({ type, svgRef }: ExportBarProps) {
  const longEdge = usePlateStore((s) => s.exportLongEdge);
  const setLongEdge = usePlateStore((s) => s.setExportLongEdge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sizeKey =
    (Object.keys(EXPORT_SIZES) as ExportSize[]).find((k) => EXPORT_SIZES[k] === longEdge) ?? '4K';

  const handleExport = useCallback(async () => {
    setError(null);
    const svgEl = svgRef.current;
    if (!svgEl) {
      setError('预览尚未就绪');
      return;
    }
    setBusy(true);
    try {
      const fonts = fontsOfType(type);
      await exportAndDownload(svgEl, type, fonts, {
        longEdge,
        filename: type.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (timer.current) clearTimeout(timer.current);
    }
  }, [svgRef, type, longEdge]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">导出分辨率</Label>
          <Select value={sizeKey} onValueChange={(k) => setLongEdge(EXPORT_SIZES[k as ExportSize])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SIZE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExport} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? '导出中…' : '下载 PNG'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        导出为矢量精度 PNG：字体已 base64 内联，尺寸按号牌物理比例（mm）缩放，长边 {longEdge}px。
      </p>
    </div>
  );
}
