/**
 * 应用主壳：标题栏 + 左右两栏（左编辑器 / 右预览+导出）+ 页脚免责声明。
 *
 * 响应式：窄屏（<lg）时上下堆叠，预览在上、编辑器在下。
 */

import { useRef } from 'react';
import { Car } from 'lucide-react';
import { Editor } from '@/components/Editor';
import { ExportBar } from '@/components/ExportBar';
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
  const type = getPlateType(typeId);
  const svgRef = useRef<SVGSVGElement | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* 标题栏 */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">机动车号牌生成器</h1>
            <p className="text-xs text-muted-foreground">
              中国 · 欧盟 · 美国 · 日本 —— 严格参照各国标准文件
            </p>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* 左：编辑器 */}
          <Card className="h-fit lg:sticky lg:top-6">
            <CardContent className="p-5">
              <Editor />
            </CardContent>
          </Card>

          {/* 右：预览 + 导出 */}
          <div className="flex flex-col gap-6">
            <PlateStage ref={svgRef} type={type} values={values} showScrews={showScrews} />

            <Card>
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
                  <Switch
                    id="screws"
                    checked={showScrews}
                    onCheckedChange={setShowScrews}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>免责声明：</strong>
          本项目仅供学术研究、字体渲染与设计参考，生成的号牌图像禁止用于任何商业或违法用途（含伪造、变造机动车号牌）。
          使用本项目即表示您了解并愿意承担使用的全部责任。各国官方号牌字体多受版权保护，
          本实现以开源字体（Overpass / Noto Sans JP / GL-Nummernschild 等）替代，详见 README。
        </p>
      </footer>
    </div>
  );
}
