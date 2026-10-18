/**
 * 字体子集覆盖校验。
 *
 * 号牌字体按封闭字符集子集化（scripts/subset-fonts.py）。一旦标准数据新增了
 * 省份简称、固定尾缀或输入字符集，而忘记重新子集化，预览/导出就会出现豆腐块。
 * 本测试用生成的覆盖清单逐字符检查，把问题挡在提交前。
 */

import { describe, expect, it } from 'vite-plus/test';
import { FONT_COVERAGE } from './fontCoverage.generated';
import { STANDARDS } from '@/lib/standards';
import type { CharClass, FontRef, FreeRun, PlateType } from '@/types/standard';

const COVERAGE = FONT_COVERAGE as Record<string, string>;

/** 一个字符类的字体链（含 fallback）实际覆盖的字符。 */
function coverageOf(cls: CharClass): Set<string> {
  const chars = new Set<string>();
  for (let font: FontRef | undefined = cls.font; font; font = font.fallback) {
    const text = COVERAGE[font.family];
    if (text === undefined) throw new Error(`字体 ${font.family} 不在覆盖清单中`);
    for (const ch of text) chars.add(ch);
  }
  return chars;
}

/** 与 layout.ts 的自由文本分类保持一致。 */
function classIdForChar(run: FreeRun, ch: string): string {
  if (/[0-9]/.test(ch)) return run.auto.digit;
  if (/[A-Za-z]/.test(ch)) return run.auto.letter;
  return run.auto.other;
}

function checkChars(
  type: PlateType,
  cls: CharClass,
  chars: Iterable<string>,
  where: string,
  problems: string[],
) {
  const covered = coverageOf(cls);
  for (const ch of chars) {
    if (!covered.has(ch)) {
      problems.push(
        `${type.id} / ${where}: 字体 ${cls.font.family} 子集缺少 ${JSON.stringify(ch)}`,
      );
    }
  }
}

/** 按 run 种类整理字段 → 字符类。 */
function fieldClasses(type: PlateType): {
  runFields: Map<string, Set<string>>;
  freeRuns: FreeRun[];
} {
  const runFields = new Map<string, Set<string>>();
  const freeRuns: FreeRun[] = [];
  for (const run of type.runs) {
    if (run.kind === 'free') {
      freeRuns.push(run);
      continue;
    }
    for (const slot of run.slots) {
      if (!slot.field) continue;
      const set = runFields.get(slot.field) ?? new Set<string>();
      set.add(slot.classId);
      runFields.set(slot.field, set);
    }
  }
  return { runFields, freeRuns };
}

describe('字体子集覆盖', () => {
  it('所有标准用到的字符都在对应字体子集内', () => {
    const problems: string[] = [];

    for (const standard of STANDARDS) {
      for (const type of standard.types) {
        const { runFields, freeRuns } = fieldClasses(type);

        // 1. 固定字面量 + 字段可能输入的全部字符
        for (const run of type.runs) {
          if (run.kind !== 'run') continue;
          for (const slot of run.slots) {
            const cls = type.charClasses[slot.classId];
            if (slot.literal) {
              checkChars(type, cls, slot.literal, `literal ${slot.classId}`, problems);
            }
            if (slot.field) {
              const spec = type.fields.find((f) => f.key === slot.field);
              if (spec?.charset) {
                checkChars(type, cls, spec.charset, `字段 ${spec.key}`, problems);
              }
            }
          }
        }

        for (const run of freeRuns) {
          const spec = type.fields.find((f) => f.key === run.field);
          if (!spec?.charset) continue;
          for (const ch of spec.charset) {
            const cls = type.charClasses[classIdForChar(run, ch)];
            checkChars(type, cls, ch, `自由字段 ${spec.key}`, problems);
          }
        }

        // 2. 默认值会直接显示，必须覆盖
        for (const run of type.runs) {
          if (run.kind === 'run') {
            for (const slot of run.slots) {
              if (!slot.field) continue;
              const value = type.defaults[slot.field] ?? '';
              const ch = value[slot.charIndex ?? 0];
              if (!ch) continue;
              checkChars(
                type,
                type.charClasses[slot.classId],
                ch,
                `默认值 ${slot.field}`,
                problems,
              );
            }
          } else {
            const value = type.defaults[run.field] ?? '';
            for (const ch of value) {
              checkChars(
                type,
                type.charClasses[classIdForChar(run, ch)],
                ch,
                `默认值 ${run.field}`,
                problems,
              );
            }
          }
        }

        // 3. runFields 中出现的字段也必须至少被检查过一次（防止漏掉绑定）
        for (const field of runFields.keys()) {
          if (!type.fields.some((f) => f.key === field)) {
            problems.push(`${type.id}: 字段 ${field} 未在 fields 中声明`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('每个字体都有非空覆盖清单', () => {
    for (const [family, chars] of Object.entries(COVERAGE)) {
      expect(chars.length, family).toBeGreaterThan(0);
    }
  });
});
