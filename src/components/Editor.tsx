/**
 * 编辑器面板：国家/地区选择 + 号牌类型选择 + 字段输入（带实时校验）。
 *
 * 交互：
 * - 国家用 Tabs（4 个），切换时自动选该国默认类型。
 * - 类型用 Select（该国全部版式）。
 * - 字段逐个 Input，按 charset 即时过滤 + 长度约束，非法时红框提示。
 * - 底部「填入示例」按钮一键恢复默认值。
 */

import { AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sanitizeInput, validateField } from '@/lib/plate/validate';
import { STANDARDS, STANDARD_BY_REGION, getPlateType } from '@/lib/standards';
import { usePlateStore } from '@/store/plateStore';
import type { Region } from '@/types/standard';

export function Editor() {
  const region = usePlateStore((s) => s.region);
  const typeId = usePlateStore((s) => s.typeId);
  const values = usePlateStore((s) => s.values);
  const setRegion = usePlateStore((s) => s.setRegion);
  const setType = usePlateStore((s) => s.setType);
  const setField = usePlateStore((s) => s.setField);
  const applySample = usePlateStore((s) => s.applySample);

  const std = STANDARD_BY_REGION[region];
  const type = getPlateType(typeId);

  const handleRegion = (r: string) => setRegion(r as Region);

  return (
    <div className="flex flex-col gap-5">
      {/* 国家/地区 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">国家 / 地区</Label>
        <Tabs value={region} onValueChange={handleRegion}>
          <TabsList className="grid w-full grid-cols-4">
            {STANDARDS.map((s) => (
              <TabsTrigger key={s.region} value={s.region} className="text-sm">
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">{std.citation}</p>
      </div>

      {/* 号牌类型 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">号牌类型</Label>
        <Select value={typeId} onValueChange={setType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择版式" />
          </SelectTrigger>
          <SelectContent>
            {std.types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{type.citation}</p>
      </div>

      {/* 字段编辑 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">号牌内容</Label>
          <Button variant="ghost" size="sm" onClick={applySample} className="h-7 gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            填入示例
          </Button>
        </div>

        {type.fields.map((f) => {
          const value = values[f.key] ?? '';
          const err = validateField(f, value);
          return (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={f.key} className="text-xs text-muted-foreground">
                  {f.label}
                </Label>
                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                  {value.length}/{f.maxLength}
                </span>
              </div>
              <Input
                id={f.key}
                value={value}
                placeholder={f.placeholder}
                maxLength={f.maxLength}
                onChange={(e) => setField(f.key, sanitizeInput(f, e.target.value))}
                aria-invalid={!!err}
                className={err ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {err && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {err}
                </p>
              )}
              {!err && f.help && (
                <p className="text-xs text-muted-foreground/70">{f.help}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
