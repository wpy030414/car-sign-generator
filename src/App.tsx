/**
 * 应用主壳：标题栏 + 左右两栏（左编辑器 / 右预览+导出）。
 *
 * 响应式：窄屏（<lg）时上下堆叠，预览在上、编辑器在下。
 */

import { useRef } from 'react';
import { Editor } from '@/components/Editor';
import { ExportBar } from '@/components/ExportBar';
import { GitHubLink } from '@/components/GitHubLink';
import { PlateStage } from '@/components/PlateStage';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getPlateType } from '@/lib/standards';
import { usePlateStore } from '@/store/plateStore';

export default function App() {
  const typeId = usePlateStore((s) => s.typeId);
  const values = usePlateStore((s) => s.values);
  const showScrews = usePlateStore((s) => s.showScrews);
  const setShowScrews = usePlateStore((s) => s.setShowScrews);
  const emboss = usePlateStore((s) => s.emboss);
  const setEmboss = usePlateStore((s) => s.setEmboss);
  const type = getPlateType(typeId);
  const svgRef = useRef<SVGSVGElement | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* 标题栏 */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold leading-tight">机动车号牌生成器</h1>
          <GitHubLink />
        </div>
      </header>

      {/* 主体 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* 左：编辑器 */}
          <Card className="h-fit py-0 lg:sticky lg:top-6">
            <CardContent className="p-5">
              <Editor />
            </CardContent>
          </Card>

          {/* 右：预览 + 导出 */}
          <div className="flex flex-col gap-6">
            <PlateStage
              ref={svgRef}
              type={type}
              values={values}
              showScrews={showScrews}
              emboss={emboss}
            />

            <Card className="py-0">
              <CardContent className="flex flex-col gap-5 p-5">
                <ExportBar type={type} svgRef={svgRef} />

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="screws" className="text-sm">
                      显示安装孔
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      关闭后导出干净图样，便于二次设计
                    </p>
                  </div>
                  <Switch id="screws" checked={showScrews} onCheckedChange={setShowScrews} />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="emboss" className="text-sm">
                      模拟冲压
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      高度场 + 左上定向光，模拟冲压成型的浮雕感
                    </p>
                  </div>
                  <Switch id="emboss" checked={emboss} onCheckedChange={setEmboss} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
